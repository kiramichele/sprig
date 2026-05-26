"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useToast } from '@/components/toast-provider'

interface Props {
  podId: string
  podName: string
  podStatus: string
  /** Total active members (including the caller). Used only to phrase the
   *  confirm copy more accurately, not for any logic — the server is the
   *  source of truth for whether leaving dissolves the pod. */
  memberCount: number
  /** Required by the spec; not currently used by the UI (no per-user state)
   *  but kept on the prop signature so callers wire it through. */
  currentUserId: string
  /** Optional override for when the parent wants to do something other than
   *  routing back to /home (e.g. show a toast first). */
  onLeft?: () => void
}

/**
 * Subtle "leave pod" control. Click → confirmation modal. Confirm → POST to
 * /api/pods/[id]/leave, which stamps left_at and, if the pod drops below the
 * minimum size, dissolves it and posts a system message into the chat.
 *
 * Modal rendered through a portal so it isn't trapped inside any rotated /
 * transformed ancestor on the pod page.
 */
export default function LeavePodButton({ podId, podName, podStatus, onLeft }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const { showToast } = useToast()
  useEffect(() => {
    setMounted(true)
  }, [])

  const isLiveOrContinuing = podStatus === 'active' || podStatus === 'continuing'
  const headline = `leave the ${podName} pod?`
  const detail = isLiveOrContinuing
    ? "you'll lose access to the group chat and any scheduled sessions."
    : 'your spot will open up, and the rest of the group will be notified.'

  async function handleLeave() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/pods/${podId}/leave`, { method: 'POST' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || 'leave failed')
      setOpen(false)
      showToast(`left ${podName}`, 'info')
      if (onLeft) {
        onLeft()
      } else {
        router.push('/home')
        router.refresh()
      }
    } catch (err) {
      console.error('leave pod: failed —', err)
      setError("couldn't leave the pod — try again?")
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
        style={{
          background: 'transparent',
          border: 'none',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
          opacity: 0.55,
          textDecoration: 'underline',
          color: '#1F1A3D',
          padding: 0,
        }}
      >
        leave pod
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
                style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%' }}
              >
                <h3 className="display" style={{ fontSize: 22, marginBottom: 8 }}>
                  {headline}
                </h3>
                <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 8, lineHeight: 1.5 }}>
                  {detail}
                </p>
                <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 14 }}>
                  you can always be matched into a new pod later.
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
                    onClick={handleLeave}
                    disabled={busy}
                    className="chunky"
                    style={{ background: '#B00020', color: 'white', borderRadius: 12, padding: '9px 16px', fontWeight: 700 }}
                  >
                    {busy ? 'leaving…' : 'leave pod'}
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
