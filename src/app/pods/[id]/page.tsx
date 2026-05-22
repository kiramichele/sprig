import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopNav from '@/components/top-nav'
import PodContent from './pod-content'

const FONT_STYLE = `@import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=DM+Sans:wght@400;500;600;700&display=swap'); .display { font-family: 'Caprasimo', Georgia, serif; }`

export default async function PodPage({ params }: { params: Promise<{ id: string }> }) {
  // Next 15: params is a Promise
  const { id } = await params

  const supabase = await createClient()
  const sb: any = supabase

  const { data: userData } = await sb.auth.getUser()
  const user = (userData as any)?.user
  // redirect() throws NEXT_REDIRECT, so keep it outside any try/catch
  if (!user) redirect('/login')

  const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single()

  // RLS hides the pod entirely if the user isn't a member, so a null result
  // means "not in this pod (or it doesn't exist)".
  const { data: pod, error: podError } = await sb
    .from('pods')
    .select('*, primary_interest:interests(name, emoji)')
    .eq('id', id)
    .maybeSingle()
  if (podError) console.error('pod page: pods query failed —', podError)

  if (!pod) {
    return (
      <main className="min-h-screen" style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <style>{FONT_STYLE}</style>
        <TopNav profile={profile || { id: user.id }} />
        <div className="max-w-4xl mx-auto p-8">
          <div style={{ background: 'white', border: '2.5px solid #1F1A3D', boxShadow: '6px 6px 0 0 #1F1A3D', borderRadius: 16, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🌿</div>
            <h1 className="display" style={{ fontSize: 28, marginBottom: 8 }}>you&apos;re not in this pod</h1>
            <p style={{ opacity: 0.8, marginBottom: 20 }}>this pod doesn&apos;t exist, or you&apos;re not one of its members.</p>
            <a
              href="/home"
              style={{ display: 'inline-block', background: '#FFD23F', border: '2.5px solid #1F1A3D', boxShadow: '4px 4px 0 0 #1F1A3D', borderRadius: 12, padding: '10px 20px', fontWeight: 700, textDecoration: 'none', color: '#1F1A3D' }}
            >
              ← back to home
            </a>
          </div>
        </div>
      </main>
    )
  }

  const [membersRes, sessionsRes, threadRes] = await Promise.all([
    sb
      .from('pod_members')
      .select('profile_id, joined_at, left_at, wants_to_continue, feedback_at, profile:profiles(id, display_name, photo_url, bio, city, username)')
      .eq('pod_id', id)
      .is('left_at', null),
    sb.from('pod_sessions').select('*').eq('pod_id', id).order('scheduled_for', { ascending: true }),
    sb.from('message_threads').select('id').eq('pod_id', id).limit(1),
  ])
  if (membersRes.error) console.error('pod page: pod_members query failed —', membersRes.error)
  if (sessionsRes.error) console.error('pod page: pod_sessions query failed —', sessionsRes.error)
  if (threadRes.error) console.error('pod page: message_threads query failed —', threadRes.error)

  const members = membersRes.data || []
  const sessions = sessionsRes.data || []
  const threadId = threadRes.data && threadRes.data[0] ? threadRes.data[0].id : null
  const currentMember = members.find((m: any) => m.profile_id === user.id) || null

  return (
    <main className="min-h-screen" style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{FONT_STYLE}</style>
      <PodContent
        profile={profile}
        pod={pod}
        members={members}
        sessions={sessions}
        currentMember={currentMember}
        currentUserId={user.id}
        threadId={threadId}
      />
    </main>
  )
}
