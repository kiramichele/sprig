import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingWizard from './onboarding-wizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profileRes = await supabase
    .from('profiles')
    .select('id, username, photo_url, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle()

  const interestsRes = await supabase
    .from('profile_interests')
    .select('interest_id')
    .eq('profile_id', user.id)

  const friendshipRes = await supabase
    .from('friendship_styles')
    .select('profile_id')
    .eq('profile_id', user.id)
    .maybeSingle()

  const sensoryRes = await supabase
    .from('sensory_preferences')
    .select('profile_id')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (profileRes.error || interestsRes.error || friendshipRes.error || sensoryRes.error) {
    throw new Error('Failed to load onboarding data')
  }

  const profile = profileRes.data
  const interestsCount = interestsRes.data?.length ?? 0
  const onboardingCompleted = profile?.onboarding_completed === true

  if (onboardingCompleted) {
    redirect('/home')
  }

  const initialStep = !profile || !profile.username
    ? 1
    : interestsCount < 3
      ? 2
      : friendshipRes.data == null
        ? 3
        : sensoryRes.data == null
          ? 4
          : 5

  return (
    <main className="min-h-screen p-8" style={{ background: '#FFF6E5' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
      <div className="max-w-4xl mx-auto">
        <OnboardingWizard userId={user.id} initialStep={initialStep} />
      </div>
    </main>
  )
}
