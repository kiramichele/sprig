import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <main className="min-h-screen p-8" style={{ background: '#FFF6E5' }}>
      <h1>onboarding placeholder</h1>
      <p>building this next</p>
    </main>
  )
}