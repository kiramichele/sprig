import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import ProfileContent from './profile-content'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = (userData as any)?.user

  if (!user) redirect('/login')

  const [{ data: profile, error: profileError }, { data: interests, error: interestsError }, { data: selections, error: selectionError }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('interests').select('*').eq('is_active', true),
    supabase.from('profile_interests').select('interest_id').eq('profile_id', user.id),
  ])

  if (!profile || profileError || interestsError) {
    redirect('/onboarding')
  }

  const selectedIds = (selections || []).map((row: any) => row.interest_id)

  return (
    <main className="min-h-screen" style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=DM+Sans:wght@400;500;600;700&display=swap'); .display { font-family: 'Caprasimo', Georgia, serif; }`}</style>
      <ProfileContent profile={profile} interests={interests || []} selectedIds={selectedIds} />
    </main>
  )
}
