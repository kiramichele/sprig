import type { Database } from '@/lib/supabase/database.types'

export type PromptRound = Database['public']['Tables']['prompt_rounds']['Row']
export type PromptCard = Database['public']['Tables']['prompt_cards']['Row']
export type PodSessionRow = Database['public']['Tables']['pod_sessions']['Row']

/** call_phase values for pod_session_state. */
export type CallPhase = 'lobby' | 'in_progress' | 'wrap_up' | 'ended'

/**
 * Actions the /advance endpoint accepts. `begin` (lobby -> in_progress) is an
 * addition to the original spec — the lobby needs a way to flip call_phase and
 * clients can't write pod_session_state directly (it's admin-only).
 */
export type AdvanceAction =
  | 'next_card'
  | 'next_round'
  | 'skip_to_wrap'
  | 'rotate_speaker'
  | 'begin'

/**
 * A row of pod_session_state (missing from the generated DB types).
 * Declared as a `type` (not `interface`) so it's assignable to
 * `Record<string, unknown>` — supabase-js requires that of table Row types.
 */
export type PodSessionState = {
  session_id: string
  current_round_slug: string
  current_card_id: string | null
  current_speaker_id: string | null
  driver_id: string | null
  round_started_at: string
  call_started_at: string
  call_phase: string
  updated_at: string
}

/** A pod member, flattened for the call UI. */
export interface SessionMember {
  profile_id: string
  display_name: string | null
  photo_url: string | null
  username: string | null
}

/** Response body of POST /api/sessions/[id]/join. */
export interface JoinResponse {
  room_url: string
  session_state: PodSessionState
  pod_members: SessionMember[]
  prompt_rounds: PromptRound[]
  prompt_cards: PromptCard[]
}

/**
 * The generated `Database` type is missing the `pod_session_state` table
 * entirely (see memory: database-types-stale). `SessionDatabase` patches it in
 * so the session endpoints stay typed without `any`.
 */
export type SessionDatabase = Database & {
  public: {
    Tables: {
      pod_session_state: {
        Row: PodSessionState
        Insert: {
          session_id: string
          current_round_slug?: string
          current_card_id?: string | null
          current_speaker_id?: string | null
          driver_id?: string | null
          round_started_at?: string
          call_started_at?: string
          call_phase?: string
          updated_at?: string
        }
        Update: {
          session_id?: string
          current_round_slug?: string
          current_card_id?: string | null
          current_speaker_id?: string | null
          driver_id?: string | null
          round_started_at?: string
          call_started_at?: string
          call_phase?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
  }
}
