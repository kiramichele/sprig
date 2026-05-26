import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotificationEmail, appUrl } from '@/lib/email/send'
import PodMatchedEmail from '@/lib/email/templates/pod-matched'
import { formPods } from './algorithm'
import type { MatcherDatabase, MatcherResult, Pair, Pod, PoolUser } from './types'

const DEFAULT_POD_SIZE = 4
const SESSION_DURATION_MINUTES = 30
const EASTERN_TZ = 'America/New_York'

/**
 * Format a UTC timestamp in the recipient's timezone. Falls back to Eastern
 * if the user hasn't set one (auto-detect normally fills this on first
 * authenticated visit — null here means a brand-new account that's never
 * loaded the UI). Built per-call rather than module-scoped because each
 * recipient gets their own timezone.
 */
function formatSessionTime(iso: string, tz: string | null | undefined): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: tz || EASTERN_TZ,
  })
  return fmt.format(new Date(iso))
}

/**
 * UTC offset (wall-clock minus UTC, in ms) for a timezone at a given instant.
 * Used to convert an Eastern wall-clock time into a real UTC instant.
 */
function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(instant)

  const field: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') field[part.type] = part.value
  }
  const hour = field.hour === '24' ? 0 : Number(field.hour)
  const asIfUtc = Date.UTC(
    Number(field.year),
    Number(field.month) - 1,
    Number(field.day),
    hour,
    Number(field.minute),
    Number(field.second)
  )
  return asIfUtc - instant.getTime()
}

/**
 * The next Saturday at 7:00 PM Eastern. If it is currently Saturday before
 * 7 PM Eastern, returns today. DST-correct (offset is resolved per-instant).
 */
export function nextSaturday7pmEastern(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TZ,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const field: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') field[part.type] = part.value
  }

  const weekdayIndex: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  const dow = weekdayIndex[field.weekday] ?? 6
  const easternHour = field.hour === '24' ? 0 : Number(field.hour)

  // days until Saturday; if it's already Saturday past 7 PM, jump a week
  let daysAhead = (6 - dow + 7) % 7
  if (daysAhead === 0 && easternHour >= 19) daysAhead = 7

  // calendar date (in Eastern) of the target Saturday
  const targetCalendar = new Date(
    Date.UTC(Number(field.year), Number(field.month) - 1, Number(field.day)) +
      daysAhead * 86_400_000
  )
  const year = targetCalendar.getUTCFullYear()
  const month = targetCalendar.getUTCMonth()
  const day = targetCalendar.getUTCDate()

  // resolve Eastern 19:00 -> UTC instant (two passes converge across DST)
  let instant = new Date(Date.UTC(year, month, day, 19, 0, 0))
  for (let i = 0; i < 2; i++) {
    const offset = tzOffsetMs(instant, EASTERN_TZ)
    instant = new Date(Date.UTC(year, month, day, 19, 0, 0) - offset)
  }
  return instant
}

/**
 * Reads the matching pool, scores compatibility, forms pods of 3–5, and writes
 * pods / members / first sessions to the database. Designed to be safe to run
 * repeatedly: one pod failing to write does not abort the rest of the batch.
 */
export async function runMatcher(): Promise<MatcherResult> {
  const startedAt = Date.now()

  // Single documented cast: the generated DB types are stale, so the matcher
  // works against `MatcherDatabase` which patches in the missing columns and
  // RPC. See src/lib/matcher/types.ts.
  const db = createAdminClient() as unknown as SupabaseClient<MatcherDatabase>

  const nowIso = new Date().toISOString()

  // 1. read the open pool
  const { data: poolData, error: poolError } = await db
    .from('matching_availability')
    .select('id, profile_id, preferred_pod_size, cycles_attempted, widened')
    .eq('status', 'open')
    .gt('available_until', nowIso)
    .order('profile_id', { ascending: true }) // deterministic pool order

  if (poolError) {
    console.error('runMatcher: failed to read matching pool —', poolError)
    throw new Error(`failed to read matching pool: ${poolError.message}`)
  }

  const poolRows = poolData ?? []
  const pool: PoolUser[] = poolRows.map((row) => ({
    profile_id: row.profile_id,
    preferred_pod_size: row.preferred_pod_size ?? DEFAULT_POD_SIZE,
    availability_id: row.id,
    widened: row.widened === true,
  }))

  // need at least 3 people to form anything
  if (pool.length < 3) {
    return {
      pods_formed: [],
      users_matched: 0,
      users_remaining: pool.length,
      pairs_evaluated: 0,
      duration_ms: Date.now() - startedAt,
    }
  }

  // 2. pairwise compatibility scores
  const { data: pairData, error: pairError } = await db.rpc('compute_pool_compatibility')

  if (pairError) {
    console.error('runMatcher: compute_pool_compatibility failed —', pairError)
    throw new Error(`compute_pool_compatibility failed: ${pairError.message}`)
  }

  const pairs: Pair[] = (pairData ?? []).map((row) => ({
    user_a: row.user_a,
    user_b: row.user_b,
    // Postgres `numeric` can arrive as a string over the wire — coerce it.
    score: Number(row.score),
    shared_interests: row.shared_interests ?? [],
  }))

  // 3. form the pods (pure)
  const formed: Pod[] = formPods(pool, pairs)

  // 4. interest name -> id, for the pods.primary_interest_id column
  const { data: interestData, error: interestError } = await db
    .from('interests')
    .select('id, name')
  if (interestError) {
    console.error('runMatcher: failed to read interests —', interestError)
  }
  const interestIdByName = new Map<string, string>()
  for (const interest of interestData ?? []) {
    interestIdByName.set(interest.name, interest.id)
  }

  const firstSessionAt = nextSaturday7pmEastern().toISOString()

  const matchedProfileIds = new Set<string>()
  const writtenPods: Pod[] = []

  // 5. write each pod — failures are logged and skipped, never fatal
  for (const pod of formed) {
    let createdPodId: string | null = null
    try {
      const primaryInterestId = pod.primary_interest
        ? interestIdByName.get(pod.primary_interest) ?? null
        : null

      const { data: podRow, error: podInsertError } = await db
        .from('pods')
        .insert({
          name: null,
          primary_interest_id: primaryInterestId,
          status: 'scheduled',
          chat_unlocked: false,
        })
        .select('id')
        .single()
      if (podInsertError || !podRow) {
        throw podInsertError ?? new Error('pod insert returned no row')
      }
      createdPodId = podRow.id

      const memberRows = pod.members.map((profileId) => ({
        pod_id: createdPodId as string,
        profile_id: profileId,
        joined_at: nowIso,
      }))
      const { error: memberError } = await db.from('pod_members').insert(memberRows)
      if (memberError) throw memberError

      const { error: sessionError } = await db.from('pod_sessions').insert({
        pod_id: createdPodId,
        scheduled_for: firstSessionAt,
        duration_minutes: SESSION_DURATION_MINUTES,
        status: 'scheduled',
        is_first_session: true,
        room_url: null,
      })
      if (sessionError) throw sessionError

      const { error: availabilityError } = await db
        .from('matching_availability')
        .update({ status: 'matched', matched_pod_id: createdPodId })
        .in('id', pod.availability_ids)
      if (availabilityError) throw availabilityError

      for (const profileId of pod.members) matchedProfileIds.add(profileId)
      writtenPods.push(pod)

      // Fire pod_matched emails. Each send is independently wrapped so a
      // failure to email one person doesn't keep the others from getting
      // notified — and a total email outage never aborts the matcher.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dbAny: any = db
        // Include timezone so each recipient sees the session time in their
        // own zone, not whichever zone the server happens to be in.
        const { data: profileRows } = await dbAny
          .from('profiles')
          .select('id, display_name, timezone')
          .in('id', pod.members)
        const nameById = new Map<string, string>()
        const tzById = new Map<string, string | null>()
        for (const p of (profileRows as { id: string; display_name: string | null; timezone: string | null }[]) || []) {
          nameById.set(p.id, p.display_name || 'friend')
          tzById.set(p.id, p.timezone)
        }

        const podName = pod.primary_interest
          ? `${pod.primary_interest} pod`
          : 'sprig pod'
        const podPath = `/pods/${createdPodId}`

        for (const recipientId of pod.members) {
          const recipientName = (nameById.get(recipientId) || 'friend').split(' ')[0]
          const memberNames = pod.members
            .filter((id) => id !== recipientId)
            .map((id) => (nameById.get(id) || 'a podmate').split(' ')[0])
          const sessionTimeDisplay = formatSessionTime(firstSessionAt, tzById.get(recipientId) ?? null)
          try {
            await sendNotificationEmail({
              recipientId,
              emailType: 'pod_matched',
              contextId: createdPodId as string,
              subject: "you've been matched! 🌱",
              template: PodMatchedEmail({
                recipientName,
                podName,
                primaryInterest: pod.primary_interest || 'sprig',
                memberNames,
                sessionTime: sessionTimeDisplay,
                podUrl: appUrl(podPath),
              }),
            })
          } catch (emailErr) {
            console.error('runMatcher: pod_matched email failed for', recipientId, '—', emailErr)
          }
        }
      } catch (notifyErr) {
        console.error('runMatcher: failed to send pod_matched emails —', notifyErr)
      }
    } catch (error) {
      console.error('runMatcher: failed to write a pod, skipping —', error)
      // best-effort rollback of a partially-written pod
      if (createdPodId) {
        const { error: cleanupError } = await db.from('pods').delete().eq('id', createdPodId)
        if (cleanupError) {
          console.error('runMatcher: cleanup of partial pod failed —', cleanupError)
        }
      }
    }
  }

  // 6. bump the cycle counter for everyone who did not get matched
  const unmatchedRows = poolRows.filter((row) => !matchedProfileIds.has(row.profile_id))
  for (const row of unmatchedRows) {
    const { error: bumpError } = await db
      .from('matching_availability')
      .update({
        cycles_attempted: (row.cycles_attempted ?? 0) + 1,
        last_cycle_at: nowIso,
      })
      .eq('id', row.id)
    if (bumpError) {
      console.error('runMatcher: failed to bump cycle counter —', bumpError)
    }
  }

  const usersMatched = writtenPods.reduce((total, pod) => total + pod.members.length, 0)

  return {
    pods_formed: writtenPods,
    users_matched: usersMatched,
    users_remaining: pool.length - usersMatched,
    pairs_evaluated: pairs.length,
    duration_ms: Date.now() - startedAt,
  }
}
