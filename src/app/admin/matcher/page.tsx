import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { MatcherDatabase } from '@/lib/matcher/types'
import AdminContent, { type PoolEntry, type RecentPod } from './admin-content'

// Admin access is restricted to these profile ids for now.
const ADMIN_USER_IDS = [
  '3ad0c516-b0eb-414f-a0f0-55104d97d002', // Kira
]

export default async function MatcherAdminPage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user

  // redirect() throws NEXT_REDIRECT, so keep these outside any try/catch
  if (!user) redirect('/login')
  if (!ADMIN_USER_IDS.includes(user.id)) redirect('/home')

  // Admin client: RLS would otherwise hide other users' rows from this page.
  // Single documented cast — see src/lib/matcher/types.ts for why.
  const admin = createAdminClient() as unknown as SupabaseClient<MatcherDatabase>

  const now = new Date()
  const nowIso = now.toISOString()
  const dayAgoIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const [poolResult, podsResult] = await Promise.all([
    admin
      .from('matching_availability')
      .select(
        'id, preferred_pod_size, available_until, preferred_interests, cycles_attempted, profile:profiles(display_name, username)'
      )
      .eq('status', 'open')
      .gt('available_until', nowIso)
      .order('created_at', { ascending: true }),
    admin
      .from('pods')
      .select(
        'id, name, status, created_at, primary_interest:interests(name, emoji), pod_members(profile_id), pod_sessions(scheduled_for, is_first_session)'
      )
      .gte('created_at', dayAgoIso)
      .order('created_at', { ascending: false }),
  ])

  if (poolResult.error) console.error('matcher admin: pool query failed —', poolResult.error)
  if (podsResult.error) console.error('matcher admin: recent pods query failed —', podsResult.error)

  // Narrow the Supabase results to the explicit display shapes.
  const pool = (poolResult.data ?? []) as unknown as PoolEntry[]
  const pods = (podsResult.data ?? []) as unknown as RecentPod[]

  return (
    <main
      className="min-h-screen"
      style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=DM+Sans:wght@400;500;600;700&display=swap'); .display { font-family: 'Caprasimo', Georgia, serif; }`}</style>
      <AdminContent pool={pool} pods={pods} cronSecret={process.env.CRON_SECRET ?? ''} />
    </main>
  )
}
