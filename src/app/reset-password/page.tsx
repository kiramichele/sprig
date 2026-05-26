'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // null while we're still checking session; true/false once we know
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    async function check() {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      if (!active) return
      setHasSession(!!data.session)
    }
    check()
    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError("passwords don't match")
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      const m = updateError.message.toLowerCase()
      if (m.includes('same') || m.includes('different')) {
        setError('that looks like your current password — try a new one.')
      } else if (m.includes('weak') || m.includes('at least')) {
        setError('password needs to be at least 8 characters.')
      } else if (m.includes('session') || m.includes('expired')) {
        setError('this reset link expired. request a new one from the forgot-password page.')
      } else {
        setError("couldn't save your new password — try again?")
      }
      return
    }
    setDone(true)
    // Give the user a beat to read the success message, then drop them on /home
    setTimeout(() => {
      router.push('/home')
      router.refresh()
    }, 1500)
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=DM+Sans:wght@400;500;600;700&display=swap');
        .display { font-family: 'Caprasimo', Georgia, serif; }
        .chunky { border: 2.5px solid #1F1A3D; box-shadow: 4px 4px 0 0 #1F1A3D; transition: all 0.12s ease; }
        .chunky:hover { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 0 #1F1A3D; }
        .chunky:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 0 #1F1A3D; }
        .field { border: 2.5px solid #1F1A3D; background: white; border-radius: 12px; padding: 12px 16px; font-size: 16px; width: 100%; outline: none; }
        .field:focus { box-shadow: 4px 4px 0 0 #1F1A3D; }
      `}</style>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="display text-5xl sm:text-6xl mb-2" style={{ color: '#1F1A3D' }}>sprig 🌱</div>
          <p style={{ color: '#1F1A3D99' }}>set a new password</p>
        </div>

        {hasSession === false ? (
          <div
            className="chunky"
            style={{ background: 'white', borderRadius: 14, padding: 20, color: '#1F1A3D' }}
          >
            <p style={{ fontSize: 15, lineHeight: 1.55, marginBottom: 12 }}>
              this reset link looks invalid or expired. request a new one from
              the forgot-password page.
            </p>
            <Link
              href="/forgot-password"
              className="chunky inline-block py-2 px-4 font-bold"
              style={{ background: '#FFD23F', borderRadius: 12, color: '#1F1A3D', textDecoration: 'none' }}
            >
              request a new link
            </Link>
          </div>
        ) : done ? (
          <div
            className="chunky"
            style={{ background: 'white', borderRadius: 14, padding: 20, color: '#1F1A3D' }}
          >
            <p style={{ fontSize: 15, lineHeight: 1.55 }}>
              password updated 🌱 taking you home…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: '#1F1A3D' }}>new password</label>
              <input
                type="password"
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
              <p className="text-xs mt-2" style={{ color: '#1F1A3D99' }}>
                at least 8 characters.
              </p>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: '#1F1A3D' }}>confirm new password</label>
              <input
                type="password"
                className="field"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            {error && (
              <div className="text-sm p-3 rounded-lg" style={{ background: '#FFE3EE', color: '#1F1A3D' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || hasSession === null}
              className="chunky w-full py-3 font-bold text-lg"
              style={{ background: '#FFD23F', borderRadius: '14px', color: '#1F1A3D' }}
            >
              {loading ? 'saving…' : 'save new password'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
