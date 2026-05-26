'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    // The recovery link Supabase sends will land on /auth/callback, which
    // exchanges the code for a session and then bounces to /reset-password.
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo }
    )
    setLoading(false)
    if (resetError) {
      const m = resetError.message.toLowerCase()
      if (m.includes('rate') || m.includes('too many')) {
        setError('too many reset attempts — wait a minute and try again.')
      } else if (m.includes('network') || m.includes('fetch')) {
        setError('looks like the internet hiccuped — give it another try?')
      } else {
        setError("couldn't send the reset link just now — try again?")
      }
      return
    }
    // Always show "sent" — never reveal whether the address has an account.
    setSent(true)
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
          <p style={{ color: '#1F1A3D99' }}>forgot your password?</p>
        </div>

        {sent ? (
          <div
            className="chunky"
            style={{ background: 'white', borderRadius: 14, padding: 20, color: '#1F1A3D' }}
          >
            <p style={{ fontSize: 15, lineHeight: 1.55, marginBottom: 12 }}>
              if an account exists for <strong>{email}</strong>, we&apos;ve sent a
              link to reset your password. check your inbox (and spam folder).
            </p>
            <p style={{ fontSize: 13, opacity: 0.7 }}>
              the link expires in an hour.
            </p>
            <div style={{ marginTop: 16 }}>
              <Link href="/login" className="font-bold underline" style={{ color: '#FF6B9D' }}>
                back to sign in
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: '#1F1A3D' }}>email</label>
              <input
                type="email"
                className="field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
              <p className="text-xs mt-2" style={{ color: '#1F1A3D99' }}>
                we&apos;ll send a link to reset your password.
              </p>
            </div>

            {error && (
              <div className="text-sm p-3 rounded-lg" style={{ background: '#FFE3EE', color: '#1F1A3D' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="chunky w-full py-3 font-bold text-lg"
              style={{ background: '#FFD23F', borderRadius: '14px', color: '#1F1A3D' }}
            >
              {loading ? 'sending…' : 'send reset link'}
            </button>

            <p className="text-center mt-4 text-sm" style={{ color: '#1F1A3D99' }}>
              remembered it?{' '}
              <Link href="/login" className="font-bold underline" style={{ color: '#FF6B9D' }}>
                back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
