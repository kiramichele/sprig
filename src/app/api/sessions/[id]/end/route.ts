import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteDailyRoom } from '@/lib/daily/admin'
import type { SessionDatabase } from '@/lib/session/types'

const MEANINGFUL_MS = 5 * 60 * 1000 // 5 minutes

type ReliabilityInsert = {
  profile_id: string
  session_id: string
  event_type: string
  delta: number
  notes: string
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const admin = createAdminClient() as unknown as SupabaseClient<SessionDatabase>

    const { data: session } = await admin
      .from('pod_sessions')
      .select('pod_id, status')
      .eq('id', sessionId)
      .single()
    if (!session) return NextResponse.json({ error: 'session not found' }, { status: 404 })

    const { data: membership } = await admin
      .from('pod_members')
      .select('profile_id')
      .eq('pod_id', session.pod_id)
      .eq('profile_id', user.id)
      .is('left_at', null)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'not a pod member' }, { status: 403 })

    const nowIso = new Date().toISOString()

    // Idempotency: if the session is already completed, don't re-score.
    if (session.status === 'completed') {
      return NextResponse.json({ ok: true, already_ended: true })
    }

    // 1. close out the session + its call state
    await admin
      .from('pod_sessions')
      .update({ status: 'completed', ended_at: nowIso })
      .eq('id', sessionId)
    await admin
      .from('pod_session_state')
      .update({ call_phase: 'ended', updated_at: nowIso })
      .eq('session_id', sessionId)

    // 2. reliability events
    const [{ data: attendance }, { data: members }] = await Promise.all([
      admin
        .from('session_attendance')
        .select('profile_id, joined_at, left_at')
        .eq('session_id', sessionId),
      admin
        .from('pod_members')
        .select('profile_id')
        .eq('pod_id', session.pod_id)
        .is('left_at', null),
    ])

    const attended = new Map<string, { joined_at: string | null; left_at: string | null }>()
    for (const row of attendance ?? []) {
      attended.set(row.profile_id, { joined_at: row.joined_at, left_at: row.left_at })
    }

    const events: ReliabilityInsert[] = []
    for (const [profileId, record] of attended) {
      events.push({
        profile_id: profileId,
        session_id: sessionId,
        event_type: 'showed_up',
        delta: 1.0,
        notes: 'attended the session',
      })
      const joined = record.joined_at ? Date.parse(record.joined_at) : NaN
      const left = record.left_at ? Date.parse(record.left_at) : Date.now()
      if (!Number.isNaN(joined) && left - joined > MEANINGFUL_MS) {
        events.push({
          profile_id: profileId,
          session_id: sessionId,
          event_type: 'meaningful_attend',
          delta: 0.5,
          notes: 'present for more than 5 minutes',
        })
      }
    }
    for (const member of members ?? []) {
      if (!attended.has(member.profile_id)) {
        events.push({
          profile_id: member.profile_id,
          session_id: sessionId,
          event_type: 'no_show',
          delta: -2.0,
          notes: 'did not attend the session',
        })
      }
    }
    if (events.length) {
      const { error: eventsError } = await admin.from('reliability_events').insert(events)
      if (eventsError) console.error('session end: failed to write reliability events —', eventsError)
    }

    // 3. promote the pod after its first session
    const { data: pod } = await admin
      .from('pods')
      .select('status')
      .eq('id', session.pod_id)
      .single()
    if (pod?.status === 'scheduled') {
      await admin.from('pods').update({ status: 'active' }).eq('id', session.pod_id)
    }

    // 4. best-effort Daily room cleanup — never let this fail the request
    try {
      await deleteDailyRoom(`sprig-${sessionId}`)
    } catch (cleanupError) {
      console.error('session end: Daily room cleanup failed —', cleanupError)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('session end error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed to end session' },
      { status: 500 }
    )
  }
}
