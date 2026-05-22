import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { MatcherDatabase } from '@/lib/matcher/types'

/**
 * Testing helper: undoes matcher runs so the matcher can be run again.
 *  - re-opens every matching_availability row (status=open, fresh 14-day
 *    window, cycle counters cleared, matched_pod_id cleared)
 *  - deletes the pods the matcher created, plus their members and sessions
 *
 * Only pods referenced by matching_availability.matched_pod_id are deleted, so
 * hand-made pods are left alone. Protected with the same Bearer CRON_SECRET as
 * the other admin endpoints.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('admin/reset-test-pool: CRON_SECRET is not set')
    return NextResponse.json(
      { ok: false, error: 'server misconfigured: CRON_SECRET is not set' },
      { status: 500 }
    )
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    // Single documented cast — see src/lib/matcher/types.ts for why.
    const db = createAdminClient() as unknown as SupabaseClient<MatcherDatabase>

    // 1. collect the pods the matcher created (referenced via matched_pod_id)
    const { data: matchedRows, error: matchedError } = await db
      .from('matching_availability')
      .select('matched_pod_id')
      .not('matched_pod_id', 'is', null)
    if (matchedError) throw matchedError

    const podIds = Array.from(
      new Set(
        (matchedRows ?? [])
          .map((row) => row.matched_pod_id)
          .filter((id): id is string => id !== null)
      )
    )

    // 2. re-open every availability. This also clears matched_pod_id, which
    //    must happen before the pods are deleted (the FK references them).
    const reopenUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: reopened, error: reopenError } = await db
      .from('matching_availability')
      .update({
        status: 'open',
        matched_pod_id: null,
        available_until: reopenUntil,
        cycles_attempted: 0,
        last_cycle_at: null,
      })
      .not('id', 'is', null) // matches every row
      .select('id')
    if (reopenError) throw reopenError

    // 3. delete the matcher pods — children first, no reliance on cascade
    let podsDeleted = 0
    if (podIds.length) {
      const { error: sessionError } = await db.from('pod_sessions').delete().in('pod_id', podIds)
      if (sessionError) throw sessionError

      const { error: memberError } = await db.from('pod_members').delete().in('pod_id', podIds)
      if (memberError) throw memberError

      const { data: deletedPods, error: podError } = await db
        .from('pods')
        .delete()
        .in('id', podIds)
        .select('id')
      if (podError) throw podError
      podsDeleted = deletedPods?.length ?? 0
    }

    return NextResponse.json({
      ok: true,
      availabilities_reopened: reopened?.length ?? 0,
      pods_deleted: podsDeleted,
    })
  } catch (error) {
    console.error('reset-test-pool error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return handle(request)
}
