import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { trySendWelcomeEmail } from '@/lib/email/welcome-trigger'
import OnboardingWizard from './onboarding-wizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Safety net for the welcome email. If /auth/callback didn't fire (e.g.
  // Supabase used a verify flow that bypassed our route), the email_log
  // unique constraint still makes this a one-time send. Awaited so the
  // serverless function doesn't terminate the request before the send.
  await trySendWelcomeEmail(supabase)

  // availability_slots is added by a recent migration; the generated DB
  // types haven't been regenerated, so we read through a narrow cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = supabase
  const profileRes = await sb
    .from('profiles')
    .select('id, username, photo_url, onboarding_completed, availability_slots')
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

  const availabilityCount =
    (profile?.availability_slots as string[] | null | undefined)?.length ?? 0

  const initialStep = !profile || !profile.username
    ? 1
    : interestsCount < 3
      ? 2
      : friendshipRes.data == null
        ? 3
        : sensoryRes.data == null
          ? 4
          : availabilityCount === 0
            ? 5
            : 6

  return (
    <main className="min-h-screen px-4 py-6 sm:p-8" style={{ background: '#FFF6E5' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
      <div className="max-w-4xl mx-auto">
        <OnboardingWizard userId={user.id} initialStep={initialStep} />
      </div>
    </main>
  )
}
