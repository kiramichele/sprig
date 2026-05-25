"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import FriendRequestModal from './friend-request-modal'

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: string
}

interface Props {
  targetUserId: string
  targetDisplayName: string
  podId: string
  currentUserId: string
  existingFriendship?: Friendship | null
}

function btnStyle(background: string): React.CSSProperties {
  return { background, borderRadius: 10, padding: '6px 12px', fontWeight: 700, fontSize: 13, color: '#1F1A3D' }
}

export default function FriendRequestButton({
  targetUserId,
  targetDisplayName,
  podId,
  currentUserId,
  existingFriendship,
}: Props) {
  const router = useRouter()
  const [friendship, setFriendship] = useState<Friendship | null>(existingFriendship ?? null)
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function respond(status: 'accepted' | 'declined') {
    if (!friendship || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId: friendship.id, response: status }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || 'update failed')
      setFriendship({ ...friendship, status })
      router.refresh()
    } catch (err) {
      console.error('friend request: respond failed —', err)
      setError('could not update — try again')
    } finally {
      setBusy(false)
    }
  }

  // no friendship yet → offer to send a request
  if (!friendship) {
    return (
      <>
        <button onClick={() => setModalOpen(true)} className="chunky" style={btnStyle('#FFD23F')}>
          send friend request
        </button>
        {modalOpen ? (
          <FriendRequestModal
            targetUserId={targetUserId}
            targetDisplayName={targetDisplayName}
            podId={podId}
            onClose={() => setModalOpen(false)}
            onSent={(f) => {
              setFriendship(f)
              router.refresh()
            }}
          />
        ) : null}
      </>
    )
  }

  const { status } = friendship

  if (status === 'pending' && friendship.requester_id === currentUserId) {
    return (
      <button disabled className="chunky" style={{ ...btnStyle('white'), opacity: 0.6 }}>
        request sent
      </button>
    )
  }

  if (status === 'pending' && friendship.addressee_id === currentUserId) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => respond('accepted')} disabled={busy} className="chunky" style={btnStyle('#6BCB77')}>
          accept
        </button>
        <button onClick={() => respond('declined')} disabled={busy} className="chunky" style={btnStyle('white')}>
          decline
        </button>
        {error ? <span style={{ fontSize: 12, color: '#B00020' }}>{error}</span> : null}
      </div>
    )
  }

  if (status === 'accepted') {
    return (
      <a
        href={`/messages/${friendship.id}`}
        className="chunky"
        style={{ ...btnStyle('#4D96FF'), textDecoration: 'none', display: 'inline-block' }}
      >
        open chat
      </a>
    )
  }

  // declined / withdrawn / blocked → show nothing
  return null
}
