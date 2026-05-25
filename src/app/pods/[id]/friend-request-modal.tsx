"use client"

import { useState } from 'react'
import type { Friendship } from './friend-request-button'

interface Props {
  targetUserId: string
  targetDisplayName: string
  podId: string
  onClose: () => void
  onSent: (friendship: Friendship) => void
}

export default function FriendRequestModal({
  targetUserId,
  targetDisplayName,
  podId,
  onClose,
  onSent,
}: Props) {
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = note.trim()
  const valid = trimmed.length >= 5 && trimmed.length <= 300

  async function handleSend() {
    if (!valid || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addresseeId: targetUserId,
          podId,
          note: trimmed,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(payload?.error || 'could not send the request — try again')
        return
      }
      onSent(payload.friendship as Friendship)
      onClose()
    } catch (err) {
      console.error('friend request: send failed —', err)
      setError('could not send the request — try again')
    } finally {
      setSending(false)
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
        zIndex: 60,
        padding: 16,
      }}
    >
      <div className="chunky" style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 440, width: '100%' }}>
        <h3 className="display" style={{ fontSize: 22, marginBottom: 10 }}>
          send {targetDisplayName} a friend request
        </h3>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          maxLength={300}
          placeholder="loved chatting at the ceramics pod — want to keep in touch?"
          className="field"
          style={{ resize: 'vertical' }}
        />
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
          {trimmed.length}/300 · at least 5 characters
        </div>
        {error ? (
          <div style={{ marginTop: 10, fontSize: 13, color: '#B00020', fontWeight: 700 }}>{error}</div>
        ) : null}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            onClick={onClose}
            disabled={sending}
            className="chunky"
            style={{ background: 'white', borderRadius: 12, padding: '9px 16px', fontWeight: 700 }}
          >
            never mind
          </button>
          <button
            onClick={handleSend}
            disabled={!valid || sending}
            className="chunky"
            style={{ background: '#6BCB77', borderRadius: 12, padding: '9px 16px', fontWeight: 700 }}
          >
            {sending ? 'sending…' : 'send request'}
          </button>
        </div>
      </div>
    </div>
  )
}
