'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
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
        .sticker {
          border: 2.5px solid #1F1A3D;
          box-shadow: 3px 3px 0 0 #1F1A3D;
        }
      `}</style>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="display text-6xl mb-2" style={{ color: '#1F1A3D' }}>sprig 🌱</div>
          <p style={{ color: '#1F1A3D99' }}>tiny groups, real friends</p>
        </div>

        {sent ? (
          <div className="sticker p-6 text-center" style={{ background: 'white', borderRadius: '20px' }}>
            <div className="text-5xl mb-3">📬</div>
            <div className="display text-2xl mb-2" style={{ color: '#1F1A3D' }}>check your email</div>
            <p className="text-sm" style={{ color: '#1F1A3D99' }}>
              we sent a confirmation link to <span className="font-bold">{email}</span>.
              click it to verify and finish signing up.
            </p>
          </div>
        ) : (
          <>
            <form onSubmit={handleSignup} className="space-y-4">
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
                  minLength={8}
                  autoComplete="new-password"
                />
                <p className="text-xs mt-1" style={{ color: '#1F1A3D99' }}>at least 8 characters</p>
              </div>

              {error && (
                <div className="text-sm p-3 rounded-lg" style={{ background: '#FFE3EE', color: '#1F1A3D' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="chunky w-full py-3 font-bold text-lg"
                style={{ background: '#6BCB77', borderRadius: '14px', color: 'white' }}
              >
                {loading ? 'creating...' : 'create account'}
              </button>
            </form>

            <p className="text-center mt-6 text-sm" style={{ color: '#1F1A3D99' }}>
              already have an account?{' '}
              <Link href="/login" className="font-bold underline" style={{ color: '#FF6B9D' }}>
                sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  )
}