/**
 * Types for the session-scheduling feature (propose / RSVP / promote).
 *
 * The generated `database.types.ts` is stale (see memory: database-types-stale)
 * — it predates the `session_rsvps` table and the `propose_session` /
 * `respond_to_session` RPCs. Row types are declared as `type` (not `interface`)
 * so they're assignable to `Record<string, unknown>` for supabase-js generics.
 */

export type RsvpResponse = 'yes' | 'no' | 'maybe'

export type SessionRsvpRow = {
  id: string
  session_id: string
  profile_id: string
  response: RsvpResponse
  responded_at: string
}

/** Return shape of respond_to_session. */
export interface RespondToSessionResult {
  status: string
  yes_count: number
  total_members: number
  promoted: boolean
}

/** Light profile shape for proposer/rsvper joins. */
export interface SchedulingProfile {
  id: string
  display_name: string | null
  photo_url: string | null
  username: string | null
}

/** A session_rsvps row joined to the rsvper's profile. */
export interface RsvpWithProfile {
  id: string
  session_id: string
  profile_id: string
  response: RsvpResponse
  responded_at: string
  rsvper: SchedulingProfile | null
}

/**
 * A pod_sessions row in 'proposed' status, plus the bits the UI needs.
 * Matches what `/api/.../page.tsx` selects from supabase.
 */
export interface ProposedSession {
  id: string
  pod_id: string
  scheduled_for: string
  duration_minutes: number
  status: string
  proposed_by: string | null
  proposed_at: string | null
  proposal_deadline: string | null
  is_first_session: boolean
  proposer: SchedulingProfile | null
  rsvps: RsvpWithProfile[]
}
