/**
 * Cron-driven cleanup of proposed sessions whose RSVP deadline has passed.
 *
 * Every 15 minutes (see vercel.json):
 *   1. Find pod_sessions with status='proposed' and proposal_deadline < now.
 *   2. For each, flip status → 'canceled'.
 *   3. Post a system message into the pod's chat thread so members see why
 *      the proposal disappeared and feel encouraged to propose another time.
 *
 * Per-proposal try/catch so one bad row doesn't kill the batch — a partial
 * cleanup is better than none.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

const TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
  timeZone: 'America/New_York',
})

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('cron/expire-proposals: CRON_SECRET is not set')
    return NextResponse.json(
      { ok: false, error: 'server misconfigured: CRON_SECRET is not set' },
      { status: 500 }
    )
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = createAdminClient()
  const nowIso = new Date().toISOString()

  const { data: expired, error: queryError } = await db
    .from('pod_sessions')
    .select('id, pod_id, scheduled_for, proposed_by')
    .eq('status', 'proposed')
    .lt('proposal_deadline', nowIso)
  if (queryError) {
    console.error('cron/expire-proposals: query failed —', queryError)
    return NextResponse.json(
      { ok: false, error: queryError.message },
      { status: 500 }
    )
  }

  const rows = (expired as Array<{
    id: string
    pod_id: string
    scheduled_for: string
    proposed_by: string | null
  }>) || []

  let expiredCount = 0
  let errorsCount = 0

  for (const proposal of rows) {
    try {
      // 1. Cancel the proposal. Conditional on status='proposed' so a race
      //    with respond_to_session (which would promote it to 'scheduled')
      //    can't accidentally cancel a confirmed session.
      const { error: cancelError } = await db
        .from('pod_sessions')
        .update({ status: 'canceled' })
        .eq('id', proposal.id)
        .eq('status', 'proposed')
      if (cancelError) throw cancelError

      // 2. Find this pod's chat thread. Continuing pods always have one;
      //    if a proposal somehow exists without a thread we skip the
      //    system message but the cancel still stands.
      const { data: thread } = await db
        .from('message_threads')
        .select('id')
        .eq('pod_id', proposal.pod_id)
        .eq('thread_type', 'pod')
        .maybeSingle()

      if (!thread?.id) continue

      const { data: proposer } = proposal.proposed_by
        ? await db
            .from('profiles')
            .select('display_name')
            .eq('id', proposal.proposed_by)
            .maybeSingle()
        : { data: null as { display_name: string | null } | null }

      const firstName =
        (proposer?.display_name as string | null)?.split(' ')[0] || 'someone'
      const formattedTime = TIME_FORMAT.format(new Date(proposal.scheduled_for))

      const body =
        `${firstName}'s proposal for ${formattedTime} expired — ` +
        `not everyone confirmed in time. you can always propose another time! 🌱`

      const { error: msgError } = await db.from('messages').insert({
        thread_id: thread.id,
        sender_id: null,
        is_system: true,
        body,
      })
      if (msgError) throw msgError

      expiredCount++
    } catch (err) {
      errorsCount++
      console.error(
        'cron/expire-proposals: failed for proposal',
        proposal.id,
        '—',
        err
      )
    }
  }

  return NextResponse.json({ ok: true, expired_count: expiredCount, errors_count: errorsCount })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
