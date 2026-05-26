"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/toast-provider'

interface Props {
  userId: string
  userEmail: string | null
}

export default function AccountSection({ userId, userEmail }: Props) {
  const router = useRouter()
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)

  return (
    <div>
      <section
        className="chunky"
        style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 18 }}
      >
        <h2 className="display" style={{ fontSize: 24, marginBottom: 12 }}>account</h2>

        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>email</div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 14 }}>{userEmail || '—'}</div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
            contact support to change your email.
          </div>
        </div>

        <button
          onClick={() => setShowPasswordModal(true)}
          className="chunky"
          style={{
            background: 'white',
            borderRadius: 12,
            padding: '8px 16px',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          change password
        </button>
      </section>

      <section
        style={{
          marginBottom: 24,
          border: '2.5px dashed #B00020',
          borderRadius: 16,
          padding: 20,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#B00020', marginBottom: 6 }}>
          deactivate account
        </h3>
        <p style={{ fontSize: 13, opacity: 0.85, marginBottom: 12 }}>
          this will sign you out and hide your profile. you can reactivate by contacting support
          within 30 days. after 30 days, your data is permanently deleted.
        </p>
        <button
          onClick={() => setShowDeactivateModal(true)}
          className="chunky"
          style={{
            background: '#B00020',
            color: 'white',
            borderRadius: 12,
            padding: '8px 16px',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          deactivate
        </button>
      </section>

      {showPasswordModal ? (
        <PasswordModal
          userEmail={userEmail}
          onClose={() => setShowPasswordModal(false)}
        />
      ) : null}
      {showDeactivateModal ? (
        <DeactivateModal
          userId={userId}
          onClose={() => setShowDeactivateModal(false)}
          onDone={() => {
            router.push('/login?deactivated=1')
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function PasswordModal({
  userEmail,
  onClose,
}: {
  userEmail: string | null
  onClose: () => void
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { showToast } = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 8) {
      setError('new password must be at least 8 characters')
      return
    }
    if (next !== confirm) {
      setError("new passwords don't match")
      return
    }
    if (!userEmail) {
      setError('cannot verify current password — please sign out and use "forgot password" instead')
      return
    }
    if (next === current) {
      setError('new password must be different from current password')
      return
    }
    setBusy(true)
    try {
      const supabase = createClient()
      // Supabase doesn't expose a "verify password" RPC, so we re-authenticate
      // with the current password to confirm the user actually knows it before
      // letting them set a new one. signInWithPassword refreshes the session
      // for the same user, so it's safe to call here.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: current,
      })
      if (verifyError) {
        setError('current password is incorrect')
        setBusy(false)
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: next })
      if (updateError) throw updateError
      setSuccess(true)
      showToast('password updated', 'success')
      setTimeout(onClose, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "couldn't change password — try again?")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 70,
        padding: 16,
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="chunky"
        style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%' }}
      >
        <h3 className="display" style={{ fontSize: 22, marginBottom: 12 }}>change password</h3>
        <label className="block" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>current password</div>
          <input
            type="password"
            className="field"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </label>
        <label className="block" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>new password</div>
          <input
            type="password"
            className="field"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <label className="block" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>confirm new password</div>
          <input
            type="password"
            className="field"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        {error ? (
          <div style={{ fontSize: 13, color: '#B00020', fontWeight: 700, marginBottom: 10 }}>
            {error}
          </div>
        ) : null}
        {success ? (
          <div style={{ fontSize: 13, color: '#1F7A3D', fontWeight: 700, marginBottom: 10 }}>
            password updated ✓
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="chunky"
            style={{ background: 'white', borderRadius: 12, padding: '8px 16px', fontWeight: 700 }}
          >
            cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="chunky"
            style={{ background: '#6BCB77', borderRadius: 12, padding: '8px 16px', fontWeight: 700 }}
          >
            {busy ? 'updating…' : 'update password'}
          </button>
        </div>
      </form>
    </div>
  )
}

function DeactivateModal({
  userId,
  onClose,
  onDone,
}: {
  userId: string
  onClose: () => void
  onDone: () => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = confirmText === 'DEACTIVATE'

  async function handleDeactivate() {
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      const nowIso = new Date().toISOString()

      const { error: profErr } = await supabase
        .from('profiles')
        .update({ deleted_at: nowIso })
        .eq('id', userId)
      if (profErr) throw profErr

      // best-effort: cancel any open availabilities so the matcher doesn't pick them up
      const { error: availErr } = await supabase
        .from('matching_availability')
        .update({ status: 'canceled' })
        .eq('profile_id', userId)
        .eq('status', 'open')
      if (availErr) console.error('deactivate: could not cancel availabilities —', availErr)

      // leave active pods
      const { error: memErr } = await supabase
        .from('pod_members')
        .update({ left_at: nowIso })
        .eq('profile_id', userId)
        .is('left_at', null)
      if (memErr) console.error('deactivate: could not leave pods —', memErr)

      await supabase.auth.signOut()
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not deactivate account')
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 70,
        padding: 16,
      }}
    >
      <div
        className="chunky"
        style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 440, width: '100%' }}
      >
        <h3 className="display" style={{ fontSize: 22, marginBottom: 8 }}>are you sure?</h3>
        <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 12 }}>
          this will hide your profile and sign you out. you have 30 days to reactivate before data
          is permanently deleted.
        </p>
        <label className="block" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            type <strong>DEACTIVATE</strong> to confirm
          </div>
          <input
            className="field"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </label>
        {error ? (
          <div style={{ fontSize: 13, color: '#B00020', fontWeight: 700, marginBottom: 10 }}>
            {error}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={busy}
            className="chunky"
            style={{ background: 'white', borderRadius: 12, padding: '8px 16px', fontWeight: 700 }}
          >
            never mind
          </button>
          <button
            onClick={handleDeactivate}
            disabled={!valid || busy}
            className="chunky"
            style={{
              background: '#B00020',
              color: 'white',
              borderRadius: 12,
              padding: '8px 16px',
              fontWeight: 700,
            }}
          >
            {busy ? 'deactivating…' : 'deactivate account'}
          </button>
        </div>
      </div>
    </div>
  )
}
