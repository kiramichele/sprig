"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Friendship } from './friend-request-button'

interface Props {
  targetUserId: string
  targetDisplayName: string
  podId: string
  currentUserId: string
  onClose: () => void
  onSent: (friendship: Friendship) => void
}

export default function FriendRequestModal({
  targetUserId,
  targetDisplayName,
  podId,
  currentUserId,
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
      const supabase = createClient()
      const { data, error: insertError } = await supabase
        .from('friendships')
        .insert({
          requester_id: currentUserId,
          addressee_id: targetUserId,
          request_note: trimmed,
          origin_pod_id: podId,
        })
        .select('id, requester_id, addressee_id, status')
        .single()

      if (insertError) {
        // RLS rejects requests between people who haven't shared a pod
        if (insertError.code === '42501' || /row-level security/i.test(insertError.message)) {
          setError("you can only send friend requests to people you've shared a pod with.")
        } else {
          setError('could not send the request — try again')
        }
        return
      }

      onSent(data as Friendship)
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
