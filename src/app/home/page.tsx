import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HomeContent from './home-content'

export default async function HomePage() {
  const supabase = await createClient()
  const sb: any = supabase

  const { data: userData } = await sb.auth.getUser()
  const user = (userData as any)?.user
  // redirect() throws NEXT_REDIRECT, so it must stay outside any try/catch
  if (!user) redirect('/login')

  // fetch profile
  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (profileError) console.error('home: profile query failed —', profileError)

  // pending incoming friend requests, for the nav badge
  const { count: pendingRequestCount } = await sb
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('addressee_id', user.id)
    .eq('status', 'pending')

  // fetch current status view
  const { data: status, error: statusError } = await sb
    .from('user_current_status')
    .select('*')
    .eq('profile_id', profile?.id)
    .maybeSingle()
  if (statusError) console.error('home: user_current_status query failed —', statusError)

  // fetch pod memberships
  const { data: membershipRows, error: membershipError } = await sb
    .from('pod_members')
    .select('pod_id')
    .eq('profile_id', profile?.id)
    .is('left_at', null)
  if (membershipError) console.error('home: pod_members query failed —', membershipError)

  const podIds = (membershipRows || []).map((row: any) => row.pod_id)

  let pods: any[] = []
  if (podIds.length) {
    // Exclude wound-down pods so the home page doesn't keep showing a pod the
    // user can't actually do anything with. Matches the status filter that
    // user_current_status.active_pod_count uses.
    const { data, error: podsError } = await sb
      .from('pods')
      .select('*, primary_interest:interests(name)')
      .in('id', podIds)
      .not('status', 'in', '(dissolved,canceled)')
    if (podsError) console.error('home: pods query failed —', podsError)
    pods = data || []
  }

  // upcoming sessions — scope to *active* pod ids so a recently-dissolved
  // pod can't leave a stale session in the upcoming list.
  const activePodIds = pods.map((p: any) => p.id)
  let sessions: any[] = []
  if (activePodIds.length) {
    // 15-minute grace window: sessions that started up to 15 minutes ago still
    // appear here so latecomers see the join prompt. Pairs with the join-call
    // logic that activates within ~10 minutes of the scheduled time.
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { data, error: sessionsError } = await sb
      .from('pod_sessions')
      .select('*')
      .in('pod_id', activePodIds)
      .eq('status', 'scheduled')
      .gt('scheduled_for', cutoff)
      .order('scheduled_for', { ascending: true })
      .limit(3)
    if (sessionsError) console.error('home: pod_sessions query failed —', sessionsError)
    sessions = data || []
  }

  // open availability
  const now = new Date().toISOString()
  const { data: availability, error: availabilityError } = await sb
    .from('matching_availability')
    .select('*')
    .eq('profile_id', profile?.id)
    .eq('status', 'open')
    .gt('available_until', now)
  if (availabilityError) console.error('home: matching_availability query failed —', availabilityError)

  // Show the widen offer if the user has cycled through twice without a match
  // and we haven't already asked them this cycle.
  const openSignal = Array.isArray(availability) && availability.length > 0
    ? availability[0]
    : null
  const showWidenOffer =
    !!openSignal &&
    (openSignal.cycles_attempted ?? 0) >= 2 &&
    openSignal.widen_offered_at === null &&
    openSignal.widen_declined !== true

  return (
    <main className="min-h-screen" style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=DM+Sans:wght@400;500;600;700&display=swap'); .display { font-family: 'Caprasimo', Georgia, serif; }`}</style>
      <HomeContent profile={profile} status={status} pods={pods} sessions={sessions} availability={availability} showWidenOffer={showWidenOffer} pendingRequestCount={pendingRequestCount ?? 0} />
    </main>
  )
}
