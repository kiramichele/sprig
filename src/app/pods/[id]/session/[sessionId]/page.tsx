import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { SessionMember } from '@/lib/session/types'
import CallExperience from './call-experience'

const FONT_STYLE = `@import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=DM+Sans:wght@400;500;600;700&display=swap'); .display { font-family: 'Caprasimo', Georgia, serif; }`

type MemberRow = {
  profile_id: string
  profile: {
    id: string
    display_name: string | null
    photo_url: string | null
    username: string | null
  } | null
}

type PodRow = {
  name: string | null
  primary_interest: { name: string | null; emoji: string | null } | null
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>
}) {
  const { id: routePodId, sessionId } = await params

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user) redirect('/login')

  const { data: session } = await supabase
    .from('pod_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle()
  if (!session) redirect('/home')

  // verify the caller is a current member of this session's pod
  const { data: membership } = await supabase
    .from('pod_members')
    .select('profile_id')
    .eq('pod_id', session.pod_id)
    .eq('profile_id', user.id)
    .is('left_at', null)
    .maybeSingle()
  if (!membership) redirect('/home')

  const [{ data: podData }, { data: memberData }, { data: profile }] = await Promise.all([
    supabase
      .from('pods')
      .select('name, primary_interest:interests(name, emoji)')
      .eq('id', session.pod_id)
      .maybeSingle(),
    supabase
      .from('pod_members')
      .select('profile_id, profile:profiles(id, display_name, photo_url, username)')
      .eq('pod_id', session.pod_id)
      .is('left_at', null),
    supabase.from('profiles').select('display_name, photo_url').eq('id', user.id).single(),
  ])

  const pod = podData as unknown as PodRow | null
  const podEmoji = pod?.primary_interest?.emoji || '🌱'
  const podName =
    pod?.name ||
    (pod?.primary_interest?.name ? `${pod.primary_interest.name} pod` : 'your pod')

  const members: SessionMember[] = ((memberData ?? []) as unknown as MemberRow[]).map((m) => ({
    profile_id: m.profile_id,
    display_name: m.profile?.display_name ?? null,
    photo_url: m.profile?.photo_url ?? null,
    username: m.profile?.username ?? null,
  }))

  return (
    <main className="min-h-screen" style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{FONT_STYLE}</style>
      <CallExperience
        sessionId={sessionId}
        podId={session.pod_id}
        podName={podName}
        podEmoji={podEmoji}
        members={members}
        currentUser={{
          id: user.id,
          display_name: profile?.display_name ?? 'someone',
          photo_url: profile?.photo_url ?? null,
        }}
      />
      {/* routePodId is informational; the session's real pod_id is authoritative */}
      {routePodId !== session.pod_id ? null : null}
    </main>
  )
}
