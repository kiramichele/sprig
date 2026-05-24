import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateDailyRoom } from '@/lib/daily/admin'
import type { JoinResponse, SessionDatabase, SessionMember } from '@/lib/session/types'

type MemberRow = {
  profile_id: string
  profile: {
    id: string
    display_name: string | null
    photo_url: string | null
    username: string | null
  } | null
}

function pickRandom<T>(items: T[]): T | null {
  return items.length ? items[Math.floor(Math.random() * items.length)] : null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    // Single documented cast — see src/lib/session/types.ts (stale generated types).
    const admin = createAdminClient() as unknown as SupabaseClient<SessionDatabase>

    const { data: session, error: sessionError } = await admin
      .from('pod_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()
    if (sessionError || !session) {
      // If this fires for a session id you know exists, the admin client almost
      // certainly isn't acting as service_role — check SUPABASE_SERVICE_ROLE_KEY.
      console.error(
        'session join: pod_sessions lookup returned nothing for',
        sessionId,
        '— sessionError:',
        sessionError
      )
      return NextResponse.json({ error: 'session not found' }, { status: 404 })
    }

    const { data: membership } = await admin
      .from('pod_members')
      .select('profile_id')
      .eq('pod_id', session.pod_id)
      .eq('profile_id', user.id)
      .is('left_at', null)
      .maybeSingle()
    if (!membership) {
      return NextResponse.json({ error: 'not a pod member' }, { status: 403 })
    }

    const nowIso = new Date().toISOString()

    // Daily room — create lazily, store the URL on the session.
    let roomUrl = session.room_url
    if (!roomUrl) {
      const room = await getOrCreateDailyRoom(sessionId)
      roomUrl = room.url
      await admin
        .from('pod_sessions')
        .update({ room_url: room.url, room_provider: 'daily' })
        .eq('id', sessionId)
    }
    if (!roomUrl) {
      return NextResponse.json({ error: 'could not resolve a room url' }, { status: 500 })
    }

    const [{ data: rounds }, { data: cards }] = await Promise.all([
      admin.from('prompt_rounds').select('*').eq('is_active', true).order('display_order'),
      admin.from('prompt_cards').select('*').eq('is_active', true),
    ])
    const allRounds = rounds ?? []
    const allCards = cards ?? []

    // Ensure a session-state row exists. ignoreDuplicates = INSERT ON CONFLICT
    // DO NOTHING — the first joiner sets it up; later joiners never reset it.
    const warmupRound = allRounds.find((r) => r.slug === 'warmup') ?? allRounds[0]
    const warmupCards = warmupRound
      ? allCards.filter((c) => c.round_id === warmupRound.id)
      : []
    const firstCard = pickRandom(warmupCards)

    await admin.from('pod_session_state').upsert(
      {
        session_id: sessionId,
        current_round_slug: warmupRound?.slug ?? 'warmup',
        current_card_id: firstCard?.id ?? null,
        current_speaker_id: user.id,
        driver_id: user.id,
        call_phase: 'lobby',
        round_started_at: nowIso,
      },
      { onConflict: 'session_id', ignoreDuplicates: true }
    )

    const { data: sessionState } = await admin
      .from('pod_session_state')
      .select('*')
      .eq('session_id', sessionId)
      .single()
    if (!sessionState) {
      return NextResponse.json({ error: 'could not load session state' }, { status: 500 })
    }

    // Attendance — first join records joined_at; rejoins are a no-op so the
    // duration used for reliability scoring stays accurate.
    await admin.from('session_attendance').upsert(
      { session_id: sessionId, profile_id: user.id, joined_at: nowIso },
      { onConflict: 'session_id,profile_id', ignoreDuplicates: true }
    )

    if (session.status === 'scheduled') {
      await admin
        .from('pod_sessions')
        .update({ status: 'in_progress', started_at: nowIso })
        .eq('id', sessionId)
    }

    const { data: memberData } = await admin
      .from('pod_members')
      .select('profile_id, profile:profiles(id, display_name, photo_url, username)')
      .eq('pod_id', session.pod_id)
      .is('left_at', null)
    const memberRows = (memberData ?? []) as unknown as MemberRow[]
    const podMembers: SessionMember[] = memberRows.map((m) => ({
      profile_id: m.profile_id,
      display_name: m.profile?.display_name ?? null,
      photo_url: m.profile?.photo_url ?? null,
      username: m.profile?.username ?? null,
    }))

    const body: JoinResponse = {
      room_url: roomUrl,
      session_state: sessionState,
      pod_members: podMembers,
      prompt_rounds: allRounds,
      prompt_cards: allCards,
    }
    return NextResponse.json(body)
  } catch (error) {
    console.error('session join error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed to join session' },
      { status: 500 }
    )
  }
}
