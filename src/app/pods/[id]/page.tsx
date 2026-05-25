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

  // pending incoming friend requests, for the nav badge
  const { count: pendingRequestCount } = await sb
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('addressee_id', user.id)
    .eq('status', 'pending')

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
        <TopNav profile={profile || { id: user.id }} pendingRequestCount={pendingRequestCount ?? 0} />
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

  const [membersRes, sessionsRes, proposalsRes, threadRes] = await Promise.all([
    sb
      .from('pod_members')
      .select('profile_id, joined_at, left_at, wants_to_continue, feedback_at, profile:profiles(id, display_name, photo_url, bio, city, username)')
      .eq('pod_id', id)
      .is('left_at', null),
    sb.from('pod_sessions').select('*').eq('pod_id', id).order('scheduled_for', { ascending: true }),
    // Bare proposals — no joins, so a single broken FK shorthand can't take
    // the whole feature offline. We enrich (proposer, rsvps) below.
    sb
      .from('pod_sessions')
      .select('id, pod_id, scheduled_for, duration_minutes, status, proposed_by, proposed_at, proposal_deadline, is_first_session')
      .eq('pod_id', id)
      .eq('status', 'proposed')
      .order('scheduled_for', { ascending: true }),
    sb.from('message_threads').select('id').eq('pod_id', id).limit(1),
  ])
  if (membersRes.error) console.error('pod page: pod_members query failed —', membersRes.error)
  if (sessionsRes.error) console.error('pod page: pod_sessions query failed —', sessionsRes.error)
  if (proposalsRes.error) console.error('pod page: proposed sessions query failed —', proposalsRes.error)
  if (threadRes.error) console.error('pod page: message_threads query failed —', threadRes.error)

  const members = membersRes.data || []
  const sessions = sessionsRes.data || []
  const bareProposals = (proposalsRes.data || []) as Array<{
    id: string
    pod_id: string
    scheduled_for: string
    duration_minutes: number
    status: string
    proposed_by: string | null
    proposed_at: string | null
    proposal_deadline: string | null
    is_first_session: boolean
  }>
  const threadId = threadRes.data && threadRes.data[0] ? threadRes.data[0].id : null
  const currentMember = members.find((m: any) => m.profile_id === user.id) || null

  // Enrich each proposal with proposer profile + all rsvps (each rsvp joined to
  // the rsvper profile). Proposer is usually a pod member, so we can grab from
  // `members` and only fall back to a query for edge cases.
  let proposals: Array<Record<string, unknown>> = []
  if (bareProposals.length) {
    const proposalIds = bareProposals.map((p) => p.id)
    // session_rsvps has a composite PK (session_id, profile_id) — no `id` column.
    const rsvpsRes = await sb
      .from('session_rsvps')
      .select('session_id, profile_id, response, responded_at, rsvper:profiles(id, display_name, photo_url, username)')
      .in('session_id', proposalIds)
    if (rsvpsRes.error) console.error('pod page: session_rsvps query failed —', rsvpsRes.error)
    const rsvpsBySession = new Map<string, unknown[]>()
    for (const r of rsvpsRes.data || []) {
      const arr = rsvpsBySession.get(r.session_id) || []
      arr.push(r)
      rsvpsBySession.set(r.session_id, arr)
    }

    const memberById = new Map(
      (members as Array<{ profile_id: string; profile: unknown }>).map(
        (m) => [m.profile_id, m.profile]
      )
    )
    proposals = bareProposals.map((p) => ({
      ...p,
      proposer: p.proposed_by ? memberById.get(p.proposed_by) || null : null,
      rsvps: rsvpsBySession.get(p.id) || [],
    }))
  }

  return (
    <main className="min-h-screen" style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{FONT_STYLE}</style>
      <PodContent
        profile={profile}
        pod={pod}
        members={members}
        sessions={sessions}
        proposals={proposals}
        currentMember={currentMember}
        currentUserId={user.id}
        threadId={threadId}
        pendingRequestCount={pendingRequestCount ?? 0}
      />
    </main>
  )
}
