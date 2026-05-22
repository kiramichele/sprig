import type { Database } from '@/lib/supabase/database.types'

/** A user currently waiting in the matching pool. */
export interface PoolUser {
  profile_id: string
  preferred_pod_size: number
  availability_id: string
  widened: boolean
}

/** A pairwise compatibility score between two pool users. */
export interface Pair {
  user_a: string
  user_b: string
  score: number
  shared_interests: string[]
}

/** A pod the algorithm has formed (not yet written to the database). */
export interface Pod {
  members: string[]
  primary_interest: string | null
  average_score: number
  availability_ids: string[]
}

/** Summary of a single matcher run. */
export interface MatcherResult {
  pods_formed: Pod[]
  users_matched: number
  users_remaining: number
  pairs_evaluated: number
  duration_ms: number
}

/**
 * The generated `Database` type is stale (see memory: database-types-stale):
 * `matching_availability` is missing the `cycles_attempted` / `last_cycle_at`
 * columns, and the `compute_pool_compatibility` RPC is absent entirely.
 *
 * `MatcherDatabase` patches those in so the matcher can stay fully typed
 * without resorting to `any`. Both the columns and the function have been
 * verified to exist in the live database.
 */
export type MatcherDatabase = Database & {
  public: {
    Tables: {
      matching_availability: {
        Row: { cycles_attempted: number | null; last_cycle_at: string | null }
        Insert: { cycles_attempted?: number | null; last_cycle_at?: string | null }
        Update: { cycles_attempted?: number | null; last_cycle_at?: string | null }
      }
    }
    Functions: {
      compute_pool_compatibility: {
        Args: Record<string, never>
        Returns: {
          user_a: string
          user_b: string
          score: number
          shared_interests: string[] | null
        }[]
      }
    }
  }
}
