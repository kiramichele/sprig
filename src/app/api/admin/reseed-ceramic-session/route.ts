import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteDailyRoom } from '@/lib/daily/admin'

/**
 * Testing helper: wipe the ceramic pod's sessions (and their session-state /
 * attendance / Daily rooms) and insert a fresh "happening now" first-session
 * so two-person call testing is one click away.
 *
 * Hardcoded to the seeded ceramic pod since that's where the active testing
 * cast (Kira, Maya, Sam) already lives. Auth: Bearer CRON_SECRET, same as the
 * other /api/admin endpoints.
 */
const CERAMIC_POD_ID = 'b1111111-1111-1111-1111-111111111111'

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('reseed-ceramic-session: CRON_SECRET is not set')
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any

    // 1. find every existing session for this pod
    const { data: existing, error: existingError } = await db
      .from('pod_sessions')
      .select('id')
      .eq('pod_id', CERAMIC_POD_ID)
    if (existingError) throw existingError

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const oldIds: string[] = (existing ?? []).map((row: any) => row.id)

    // 2. clean up child rows + Daily rooms, then the sessions themselves
    if (oldIds.length) {
      const { error: stateError } = await db
        .from('pod_session_state')
        .delete()
        .in('session_id', oldIds)
      if (stateError) console.error('reseed: pod_session_state delete failed —', stateError)

      const { error: attendError } = await db
        .from('session_attendance')
        .delete()
        .in('session_id', oldIds)
      if (attendError) console.error('reseed: session_attendance delete failed —', attendError)

      for (const id of oldIds) {
        try {
          await deleteDailyRoom(`sprig-${id}`)
        } catch (cleanupError) {
          console.error('reseed: Daily room cleanup failed for', id, '—', cleanupError)
        }
      }

      const { error: sessError } = await db.from('pod_sessions').delete().in('id', oldIds)
      if (sessError) throw sessError
    }

    // 3. reset the pod itself so it's pre-first-session again
    const { error: podError } = await db
      .from('pods')
      .update({ status: 'scheduled', chat_unlocked: false })
      .eq('id', CERAMIC_POD_ID)
    if (podError) console.error('reseed: pod reset failed —', podError)

    // 4. fresh session, scheduled 30s in the past so the join window is open
    //    immediately (10 min either side of scheduled_for)
    const scheduledFor = new Date(Date.now() - 30_000).toISOString()
    const { data: newSession, error: insertError } = await db
      .from('pod_sessions')
      .insert({
        pod_id: CERAMIC_POD_ID,
        scheduled_for: scheduledFor,
        duration_minutes: 30,
        status: 'scheduled',
        is_first_session: true,
        room_url: null,
        room_provider: 'daily',
      })
      .select('id')
      .single()
    if (insertError || !newSession) {
      throw insertError ?? new Error('failed to insert fresh session')
    }

    return NextResponse.json({
      ok: true,
      sessionId: newSession.id,
      podId: CERAMIC_POD_ID,
    })
  } catch (error) {
    console.error('reseed-ceramic-session error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return handle(request)
}
