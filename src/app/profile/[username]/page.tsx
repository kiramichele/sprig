import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import TopNav from '@/components/top-nav'
import ProfileContent, {
  type ProfileInterest,
  type ProfileView,
  type Relationship,
} from './profile-content'

const FONT_STYLE = `@import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=DM+Sans:wght@400;500;600;700&display=swap'); .display { font-family: 'Caprasimo', Georgia, serif; }`

export default async function ProfileViewPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params

  const supabase = await createClient()
  // server-page convention for embedded selects (same as home/pod/friends pages)
  const sb: any = supabase

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user
  if (!user) redirect('/login')

  // Viewer's OWN data uses the session client (RLS allows self-access).
  const { data: viewerProfile } = await sb
    .from('profiles')
    .select('id, display_name, photo_url, username')
    .eq('id', user.id)
    .single()

  const { count: pendingRequestCount } = await sb
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('addressee_id', user.id)
    .eq('status', 'pending')

  // Everything about the *target* profile uses the admin client so RLS on
  // `profiles` (which restricts auth'd users to self / pod-mates / friends)
  // doesn't false-404 us before we've even computed the relationship. The UI
  // below gates what gets rendered per relationship, so privacy is preserved.
  const admin: any = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, username, display_name, photo_url, bio, city, deleted_at')
    .eq('username', username)
    .maybeSingle()

  // not-found (genuinely missing or soft-deleted)
  if (!profile || profile.deleted_at) {
    return (
      <main
        className="min-h-screen"
        style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        <style>{FONT_STYLE}</style>
        <TopNav
          profile={viewerProfile || { id: user.id }}
          pendingRequestCount={pendingRequestCount ?? 0}
        />
        <div className="max-w-4xl mx-auto p-8">
          <div
            style={{
              background: 'white',
              border: '2.5px solid #1F1A3D',
              boxShadow: '6px 6px 0 0 #1F1A3D',
              borderRadius: 16,
              padding: 32,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 8 }}>🌿</div>
            <h1 className="display" style={{ fontSize: 28, marginBottom: 8 }}>
              we can&apos;t find that profile
            </h1>
            <p style={{ opacity: 0.8, marginBottom: 20 }}>
              maybe they changed their username, or aren&apos;t on sprig anymore.
            </p>
            <a
              href="/home"
              style={{
                display: 'inline-block',
                background: '#FFD23F',
                border: '2.5px solid #1F1A3D',
                boxShadow: '4px 4px 0 0 #1F1A3D',
                borderRadius: 12,
                padding: '10px 20px',
                fontWeight: 700,
                textDecoration: 'none',
                color: '#1F1A3D',
              }}
            >
              ← back to home
            </a>
          </div>
        </div>
      </main>
    )
  }

  // determine relationship to the viewer
  let relationship: Relationship = 'stranger'
  let friendshipId: string | null = null
  let sharedPodName: string | null = null

  if (profile.id === user.id) {
    relationship = 'self'
  } else {
    // friendship? — admin client so we always get a definitive answer
    const { data: friendship } = await admin
      .from('friendships')
      .select('id')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${user.id})`
      )
      .eq('status', 'accepted')
      .maybeSingle()
    if (friendship) {
      relationship = 'friend'
      friendshipId = friendship.id
    } else {
      // shared pod? — admin client bypasses RLS on pod_members
      const { data: myPods } = await admin
        .from('pod_members')
        .select('pod_id')
        .eq('profile_id', user.id)
        .is('left_at', null)
      const myPodIds = (myPods ?? []).map((row: any) => row.pod_id)
      if (myPodIds.length) {
        const { data: theirs } = await admin
          .from('pod_members')
          .select('pod_id, pod:pods!pod_members_pod_id_fkey(id, name, primary_interest:interests(name))')
          .eq('profile_id', profile.id)
          .in('pod_id', myPodIds)
          .is('left_at', null)
        if (theirs && theirs.length) {
          relationship = 'shared_pod'
          const pod = theirs[0]?.pod
          if (pod) {
            sharedPodName =
              pod.name || (pod.primary_interest?.name ? `${pod.primary_interest.name} pod` : 'a pod')
          }
        }
      }
    }
  }

  // interests (visible if not stranger) — admin client, same reason
  let interests: ProfileInterest[] = []
  if (relationship !== 'stranger') {
    const { data: piData } = await admin
      .from('profile_interests')
      .select('intensity, interest:interests(id, name, emoji)')
      .eq('profile_id', profile.id)
    interests = (piData ?? []) as ProfileInterest[]
  }

  const view: ProfileView = {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    photo_url: profile.photo_url,
    bio: profile.bio,
    city: profile.city,
  }

  return (
    <main
      className="min-h-screen"
      style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <style>{FONT_STYLE}</style>
      <ProfileContent
        viewerProfile={viewerProfile || { id: user.id }}
        pendingRequestCount={pendingRequestCount ?? 0}
        profile={view}
        relationship={relationship}
        friendshipId={friendshipId}
        sharedPodName={sharedPodName}
        interests={interests}
      />
    </main>
  )
}
