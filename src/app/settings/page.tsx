import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsContent from './settings-content'

const FONT_STYLE = `@import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=DM+Sans:wght@400;500;600;700&display=swap'); .display { font-family: 'Caprasimo', Georgia, serif; }`

export default async function SettingsPage() {
  const supabase = await createClient()
  // server-page convention for embedded selects
  const sb: any = supabase

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user
  if (!user) redirect('/login')

  const [
    profileRes,
    catalogRes,
    profileInterestsRes,
    friendshipStyleRes,
    sensoryRes,
    pendingCountRes,
  ] = await Promise.all([
    sb.from('profiles').select('*').eq('id', user.id).single(),
    sb.from('interests').select('*').eq('is_active', true),
    sb.from('profile_interests').select('interest_id, intensity').eq('profile_id', user.id),
    sb.from('friendship_styles').select('*').eq('profile_id', user.id).maybeSingle(),
    sb.from('sensory_preferences').select('*').eq('profile_id', user.id).maybeSingle(),
    sb
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('addressee_id', user.id)
      .eq('status', 'pending'),
  ])

  if (profileRes.error) console.error('settings: profile query failed —', profileRes.error)
  if (catalogRes.error) console.error('settings: interests catalog query failed —', catalogRes.error)
  if (profileInterestsRes.error) console.error('settings: profile_interests query failed —', profileInterestsRes.error)
  if (friendshipStyleRes.error) console.error('settings: friendship_styles query failed —', friendshipStyleRes.error)
  if (sensoryRes.error) console.error('settings: sensory_preferences query failed —', sensoryRes.error)

  return (
    <main
      className="min-h-screen"
      style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <style>{FONT_STYLE}</style>
      <SettingsContent
        userId={user.id}
        userEmail={user.email ?? null}
        profile={profileRes.data}
        interestsCatalog={catalogRes.data ?? []}
        profileInterests={profileInterestsRes.data ?? []}
        friendshipStyle={friendshipStyleRes.data}
        sensoryPrefs={sensoryRes.data}
        pendingRequestCount={pendingCountRes.count ?? 0}
      />
    </main>
  )
}
