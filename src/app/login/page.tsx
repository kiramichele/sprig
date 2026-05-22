'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    const searchParams = new URL(window.location.href).searchParams
    if (searchParams.get('error') === 'confirm') {
      setInfo('Please confirm your email by clicking the link we sent, then sign in.')
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/home')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6"
          style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=DM+Sans:wght@400;500;600;700&display=swap');
        .display { font-family: 'Caprasimo', Georgia, serif; }
        .chunky {
          border: 2.5px solid #1F1A3D;
          box-shadow: 4px 4px 0 0 #1F1A3D;
          transition: all 0.12s ease;
        }
        .chunky:hover { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 0 #1F1A3D; }
        .chunky:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 0 #1F1A3D; }
        .field {
          border: 2.5px solid #1F1A3D;
          background: white;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 16px;
          width: 100%;
          outline: none;
        }
        .field:focus { box-shadow: 4px 4px 0 0 #1F1A3D; }
      `}</style>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="display text-6xl mb-2" style={{ color: '#1F1A3D' }}>sprig 🌱</div>
          <p style={{ color: '#1F1A3D99' }}>welcome back</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1.5" style={{ color: '#1F1A3D' }}>email</label>
            <input
              type="email"
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1.5" style={{ color: '#1F1A3D' }}>password</label>
            <input
              type="password"
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {info && (
            <div className="text-sm p-3 rounded-lg" style={{ background: '#E6F6FF', color: '#1F1A3D' }}>
              {info}
            </div>
          )}

          {error && (
            <div className="text-sm p-3 rounded-lg" style={{ background: '#FFE3EE', color: '#1F1A3D' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="chunky w-full py-3 font-bold text-lg"
            style={{ background: '#FFD23F', borderRadius: '14px', color: '#1F1A3D' }}
          >
            {loading ? 'signing in...' : 'sign in'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm" style={{ color: '#1F1A3D99' }}>
          new here?{' '}
          <Link href="/signup" className="font-bold underline" style={{ color: '#FF6B9D' }}>
            create an account
          </Link>
        </p>
      </div>
    </main>
  )
}