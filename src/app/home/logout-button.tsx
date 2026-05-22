'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 font-bold"
      style={{
        background: 'white',
        border: '2.5px solid #1F1A3D',
        boxShadow: '4px 4px 0 0 #1F1A3D',
        borderRadius: '12px',
      }}
    >
      sign out
    </button>
  )
}