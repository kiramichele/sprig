import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AdvanceAction, SessionDatabase } from '@/lib/session/types'

const ACTIONS: AdvanceAction[] = [
  'next_card',
  'next_round',
  'skip_to_wrap',
  'rotate_speaker',
  'begin',
]

function pickRandom<T>(items: T[]): T | null {
  return items.length ? items[Math.floor(Math.random() * items.length)] : null
}

/** Next member id in array order, cycling back to the start. */
function nextSpeaker(members: string[], current: string | null): string | null {
  if (members.length === 0) return null
  if (!current) return members[0]
  const index = members.indexOf(current)
  if (index === -1) return members[0]
  return members[(index + 1) % members.length]
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params

  try {
    const payload = (await request.json().catch(() => ({}))) as { action?: AdvanceAction }
    const action = payload.action
    if (!action || !ACTIONS.includes(action)) {
      return NextResponse.json({ error: 'invalid action' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const admin = createAdminClient() as unknown as SupabaseClient<SessionDatabase>

    const { data: session } = await admin
      .from('pod_sessions')
      .select('pod_id')
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

    const [{ data: state }, { data: rounds }, { data: cards }, { data: memberRows }] =
      await Promise.all([
        admin.from('pod_session_state').select('*').eq('session_id', sessionId).single(),
        admin.from('prompt_rounds').select('*').eq('is_active', true).order('display_order'),
        admin.from('prompt_cards').select('*').eq('is_active', true),
        admin
          .from('pod_members')
          .select('profile_id')
          .eq('pod_id', session.pod_id)
          .is('left_at', null)
          .order('profile_id'),
      ])
    if (!state) return NextResponse.json({ error: 'session state not found' }, { status: 404 })

    const allRounds = rounds ?? []
    const allCards = cards ?? []
    const memberIds = (memberRows ?? []).map((m) => m.profile_id)
    const nowIso = new Date().toISOString()
    const currentRound = allRounds.find((r) => r.slug === state.current_round_slug)

    // Build the patch for the requested action.
    const patch: SessionDatabase['public']['Tables']['pod_session_state']['Update'] = {
      updated_at: nowIso,
    }

    if (action === 'begin') {
      patch.call_phase = 'in_progress'
      patch.round_started_at = nowIso
    } else if (action === 'rotate_speaker') {
      patch.current_speaker_id = nextSpeaker(memberIds, state.current_speaker_id)
    } else if (action === 'next_card') {
      const roundCards = currentRound
        ? allCards.filter((c) => c.round_id === currentRound.id)
        : []
      const others = roundCards.filter((c) => c.id !== state.current_card_id)
      const next = pickRandom(others.length ? others : roundCards)
      patch.current_card_id = next?.id ?? state.current_card_id
      patch.current_speaker_id = nextSpeaker(memberIds, state.current_speaker_id)
    } else if (action === 'next_round') {
      const order = currentRound?.display_order ?? 0
      const nextRound = allRounds
        .filter((r) => r.display_order > order)
        .sort((a, b) => a.display_order - b.display_order)[0]
      if (nextRound) {
        const roundCards = allCards.filter((c) => c.round_id === nextRound.id)
        patch.current_round_slug = nextRound.slug
        patch.current_card_id = pickRandom(roundCards)?.id ?? null
        patch.round_started_at = nowIso
        patch.current_speaker_id = nextSpeaker(memberIds, state.current_speaker_id)
      } else {
        // already at the final round — move the call into its wrap-up phase
        patch.call_phase = 'wrap_up'
      }
    } else if (action === 'skip_to_wrap') {
      const wrapRound = allRounds.find((r) => r.slug === 'wrap')
      if (wrapRound) {
        const roundCards = allCards.filter((c) => c.round_id === wrapRound.id)
        patch.current_round_slug = wrapRound.slug
        patch.current_card_id = pickRandom(roundCards)?.id ?? null
        patch.round_started_at = nowIso
      }
    }

    const { data: updated, error: updateError } = await admin
      .from('pod_session_state')
      .update(patch)
      .eq('session_id', sessionId)
      .select('*')
      .single()
    if (updateError || !updated) {
      throw updateError ?? new Error('failed to update session state')
    }

    return NextResponse.json({ session_state: updated })
  } catch (error) {
    console.error('session advance error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'failed to advance session' },
      { status: 500 }
    )
  }
}
