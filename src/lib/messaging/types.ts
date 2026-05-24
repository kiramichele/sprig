import type { Database } from '@/lib/supabase/database.types'

/**
 * Row of `dm_thread_reads` — per-user, per-thread "last read" markers, used
 * to compute the unread-DM badge. Declared as a `type` (not `interface`) so
 * it's assignable to `Record<string, unknown>` — supabase-js requires that of
 * table Row types.
 */
export type DmThreadReadRow = {
  profile_id: string
  thread_id: string
  last_read_at: string
}

/**
 * The generated `Database` type doesn't include `dm_thread_reads` yet (the
 * table was added in a migration after types were last generated). This
 * augmentation patches it in, same approach as MatcherDatabase /
 * SessionDatabase elsewhere in the project.
 */
export type MessagingDatabase = Database & {
  public: {
    Tables: {
      dm_thread_reads: {
        Row: DmThreadReadRow
        Insert: {
          profile_id: string
          thread_id: string
          last_read_at?: string
        }
        Update: {
          profile_id?: string
          thread_id?: string
          last_read_at?: string
        }
        Relationships: []
      }
    }
  }
}
