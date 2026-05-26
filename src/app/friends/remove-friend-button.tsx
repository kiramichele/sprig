"use client"

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/components/toast-provider'

interface Props {
  friendshipId: string
  otherUserName: string
  onRemoved: () => void
}

/**
 * "remove friend" control + confirmation modal. Reuses the existing
 * /api/friends/respond endpoint with response='withdrawn' — RLS on
 * message_threads gates DM access by friendship.status='accepted', so the chat
 * becomes inaccessible the moment the status flips. No hard delete, no email.
 *
 * Modal is rendered via a portal so a transformed/rotated ancestor can't trap
 * its position: fixed (same issue we hit on the pod page friend-request modal).
 */
export default function RemoveFriendButton({ friendshipId, otherUserName, onRemoved }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const { showToast } = useToast()
  useEffect(() => {
    setMounted(true)
  }, [])

  async function handleRemove() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId, response: 'withdrawn' }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || 'remove failed')
      setOpen(false)
      showToast(`removed ${otherUserName}`, 'info')
      onRemoved()
    } catch (err) {
      console.error('remove friend: failed —', err)
      setError("couldn't remove — try again?")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        title="remove friend — they won't be notified"
        style={{
          background: 'transparent',
          border: 'none',
          fontWeight: 700,
          fontSize: 12,
          cursor: 'pointer',
          opacity: 0.55,
          textDecoration: 'underline',
          color: '#1F1A3D',
          padding: 0,
        }}
      >
        remove friend
      </button>

      {open && mounted
        ? createPortal(
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 200,
                padding: 16,
              }}
            >
              <div
                className="chunky"
                style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 420, width: '100%' }}
              >
                <h3 className="display" style={{ fontSize: 22, marginBottom: 8 }}>
                  remove {otherUserName} as a friend?
                </h3>
                <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 14, lineHeight: 1.5 }}>
                  you&apos;ll need to share another pod to reconnect. they won&apos;t be
                  notified.
                </p>
                {error ? (
                  <div style={{ fontSize: 13, color: '#B00020', fontWeight: 700, marginBottom: 10 }}>
                    {error}
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setOpen(false)}
                    disabled={busy}
                    className="chunky"
                    style={{ background: 'white', borderRadius: 12, padding: '9px 16px', fontWeight: 700 }}
                  >
                    never mind
                  </button>
                  <button
                    onClick={handleRemove}
                    disabled={busy}
                    className="chunky"
                    style={{ background: '#B00020', color: 'white', borderRadius: 12, padding: '9px 16px', fontWeight: 700 }}
                  >
                    {busy ? 'removing…' : 'remove friend'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
