import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from './logout-button'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <main className="min-h-screen p-8" style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=DM+Sans:wght@400;500;600;700&display=swap'); .display { font-family: 'Caprasimo', Georgia, serif; }`}</style>
      <div className="max-w-2xl mx-auto">
        <h1 className="display text-5xl mb-3">you&apos;re in 🌱</h1>
        <p className="mb-2">signed in as <strong>{user.email}</strong></p>
        <p className="mb-6 opacity-70 text-sm">home page coming soon — pod discovery, friend list, upcoming sessions.</p>
        <LogoutButton />
      </div>
    </main>
  )
}