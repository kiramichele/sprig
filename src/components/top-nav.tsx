"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  id: string
  display_name?: string | null
  photo_url?: string | null
}

export default function TopNav({ profile }: { profile: Profile }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (err) {
      console.error('sign out failed', err)
    }
  }

  const initial = (profile.display_name || profile.id || 'U').slice(0, 1).toUpperCase()

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: '#FFF6E5', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
      <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
        <a href="/home" className="display text-2xl" style={{ fontFamily: 'Caprasimo, Georgia, serif' }}>
          sprig 🌱
        </a>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen(v => !v)}
            aria-haspopup="menu"
            style={{ width: 40, height: 40, borderRadius: 9999, border: '2.5px solid #1F1A3D', background: 'white', boxShadow: '4px 4px 0 0 #1F1A3D' }}
          >
            {profile.photo_url ? (
              <img src={profile.photo_url} alt={profile.display_name || 'avatar'} style={{ width: 36, height: 36, borderRadius: 9999 }} />
            ) : (
              <span style={{ display: 'inline-block', lineHeight: '36px', width: 36, height: 36, textAlign: 'center', fontWeight: 700 }}>{initial}</span>
            )}
          </button>

          {open && (
            <div style={{ position: 'absolute', right: 0, marginTop: 8, background: 'white', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}>
              <a href="/profile" className="block px-4 py-2">Profile</a>
              <a href="/settings" className="block px-4 py-2">Settings</a>
              <button onClick={handleSignOut} className="w-full text-left px-4 py-2">Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
