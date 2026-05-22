import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HomeContent from './home-content'

export default async function HomePage() {
  const supabase = await createClient()
  const sb: any = supabase

  try {
    const { data: userData } = await sb.auth.getUser()
    const user = (userData as any)?.user
    if (!user) redirect('/login')

    // fetch profile
    const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single()

    // fetch current status view
    const { data: status } = await sb.from('user_current_status').select('*').eq('profile_id', profile?.id).maybeSingle()

    // fetch active pod memberships and related pods
    const { data: membershipRows } = await sb
      .from('pod_members')
      .select('pod_id, pod:pods(*, primary_interest:interests(name))')
      .eq('profile_id', profile?.id)
      .is('left_at', null)

    const pods = (membershipRows || [])
      .map((row: any) => row.pod)
      .filter(Boolean)

    const podIds = pods.map((pod: any) => pod.id)

    // upcoming sessions
    let sessions: any[] = []
    if (podIds.length) {
      const now = new Date().toISOString()
      const { data } = await sb.from('pod_sessions').select('*').in('pod_id', podIds).eq('status', 'scheduled').gt('scheduled_for', now).order('scheduled_for', { ascending: true }).limit(3)
      sessions = data || []
    }

    // open availability
    const now = new Date().toISOString()
    const { data: availability } = await sb.from('matching_availability').select('*').eq('profile_id', profile?.id).eq('status', 'open').gt('available_until', now)

    return (
      <main className="min-h-screen" style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=DM+Sans:wght@400;500;600;700&display=swap'); .display { font-family: 'Caprasimo', Georgia, serif; }`}</style>
        <HomeContent profile={profile} status={status} pods={pods} sessions={sessions} availability={availability} />
      </main>
    )
  } catch (err) {
    console.error('home page error', err)
    redirect('/login')
  }
}