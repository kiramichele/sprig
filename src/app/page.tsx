import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/home')

  return (
    <main className="min-h-screen flex items-center justify-center px-6"
          style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=DM+Sans:wght@400;500;600;700&display=swap'); .display { font-family: 'Caprasimo', Georgia, serif; } .chunky { border: 2.5px solid #1F1A3D; box-shadow: 4px 4px 0 0 #1F1A3D; transition: all .12s ease; } .chunky:hover { transform: translate(-1px,-1px); box-shadow: 5px 5px 0 0 #1F1A3D; }`}</style>
      <div className="text-center max-w-lg">
        <div className="display text-8xl mb-4">sprig 🌱</div>
        <p className="text-xl mb-8 opacity-80">tiny groups, real friends.</p>
        <div className="flex gap-4 justify-center">
          <Link href="/signup" className="chunky px-8 py-3 font-bold text-lg"
                style={{ background: '#6BCB77', borderRadius: '14px', color: 'white' }}>
            get started
          </Link>
          <Link href="/login" className="chunky px-8 py-3 font-bold text-lg"
                style={{ background: 'white', borderRadius: '14px', color: '#1F1A3D' }}>
            sign in
          </Link>
        </div>
      </div>
    </main>
  )
}