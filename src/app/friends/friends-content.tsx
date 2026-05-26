"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RemoveFriendButton from './remove-friend-button'

export interface FriendProfile {
  id: string
  display_name: string | null
  photo_url: string | null
  username: string | null
}
export interface FriendPod {
  id: string
  name: string | null
  primary_interest: { name: string | null } | null
}
export interface IncomingRequest {
  id: string
  request_note: string | null
  requested_at: string
  requester: FriendProfile | null
  origin_pod: FriendPod | null
}
export interface OutgoingRequest {
  id: string
  requested_at: string
  addressee: FriendProfile | null
  origin_pod: FriendPod | null
}
export interface AcceptedFriend {
  friendshipId: string
  friend: FriendProfile
  origin_pod: FriendPod | null
}

interface Props {
  incoming: IncomingRequest[]
  outgoing: OutgoingRequest[]
  accepted: AcceptedFriend[]
}

const AVATAR_COLORS = ['#FFD23F', '#6BCB77', '#4D96FF', '#FF6B6B', '#C780E8']
function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function Avatar({ profile, size = 48 }: { profile: FriendProfile; size?: number }) {
  const color = AVATAR_COLORS[hash(profile.id || profile.display_name || '?') % AVATAR_COLORS.length]
  const initial = (profile.display_name || '?').slice(0, 1).toUpperCase()
  if (profile.photo_url) {
    return (
      <img
        src={profile.photo_url}
        alt={profile.display_name || 'friend'}
        style={{ width: size, height: size, borderRadius: 9999, objectFit: 'cover', border: '2.5px solid #1F1A3D', flexShrink: 0 }}
      />
    )
  }
  return (
    <span
      style={{
        width: size, height: size, borderRadius: 9999, background: color, border: '2.5px solid #1F1A3D',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.4, flexShrink: 0,
      }}
    >
      {initial}
    </span>
  )
}

function podLabel(pod: FriendPod | null): string {
  if (!pod) return 'a pod'
  return pod.name || (pod.primary_interest?.name ? `${pod.primary_interest.name} pod` : 'a pod')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function FriendsContent({ incoming, outgoing, accepted }: Props) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function updateStatus(id: string, status: 'accepted' | 'declined' | 'withdrawn') {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId: id, response: status }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || 'update failed')
      router.refresh()
    } catch (err) {
      console.error('friends: update failed —', err)
      setError('could not update — try again')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <style>{`
        .chunky { border:2.5px solid #1F1A3D; box-shadow:4px 4px 0 0 #1F1A3D; transition:all .12s ease; }
        .chunky:hover { transform:translate(-1px,-1px); box-shadow:5px 5px 0 0 #1F1A3D; }
        .chunky:active { transform:translate(2px,2px); box-shadow:1px 1px 0 0 #1F1A3D; }
        .chunky:disabled { opacity:.55; cursor:not-allowed; }
        .pod-h2 { font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:.16em; color:#1F1A3D; opacity:.55; margin:28px 0 12px; }
      `}</style>

      <h1 className="display" style={{ fontSize: 40, marginBottom: 4 }}>your people 🌿</h1>
      <p style={{ opacity: 0.8 }}>friends you&apos;ve made through your pods.</p>

      {error ? <div style={{ fontSize: 13, color: '#B00020', fontWeight: 700, marginTop: 8 }}>{error}</div> : null}

      {incoming.length > 0 ? (
        <>
          <div className="pod-h2">
            {incoming.length} pending request{incoming.length === 1 ? '' : 's'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {incoming.map((r) => (
              <div key={r.id} className="chunky" style={{ background: '#FFF8E6', borderRadius: 14, padding: 16 }}>
                {r.requester?.username ? (
                  <a
                    href={`/profile/${r.requester.username}`}
                    style={{ display: 'flex', gap: 12, textDecoration: 'none', color: 'inherit' }}
                  >
                    <Avatar profile={r.requester} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{r.requester.display_name || 'someone'}</div>
                      <div style={{ fontSize: 13, opacity: 0.7 }}>from your pod: {podLabel(r.origin_pod)}</div>
                    </div>
                  </a>
                ) : (
                  <div style={{ display: 'flex', gap: 12 }}>
                    {r.requester ? <Avatar profile={r.requester} /> : null}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{r.requester?.display_name || 'someone'}</div>
                      <div style={{ fontSize: 13, opacity: 0.7 }}>from your pod: {podLabel(r.origin_pod)}</div>
                    </div>
                  </div>
                )}
                {r.request_note ? (
                  <div
                    style={{
                      margin: '10px 0', padding: '8px 12px', borderLeft: '3px solid #1F1A3D',
                      background: 'white', borderRadius: 6, fontSize: 14, fontStyle: 'italic',
                    }}
                  >
                    “{r.request_note}”
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 8, marginTop: r.request_note ? 0 : 10 }}>
                  <button
                    onClick={() => updateStatus(r.id, 'accepted')}
                    disabled={busyId === r.id}
                    className="chunky"
                    style={{ background: '#6BCB77', borderRadius: 10, padding: '7px 16px', fontWeight: 700 }}
                  >
                    accept
                  </button>
                  <button
                    onClick={() => updateStatus(r.id, 'declined')}
                    disabled={busyId === r.id}
                    className="chunky"
                    style={{ background: 'white', borderRadius: 10, padding: '7px 16px', fontWeight: 700 }}
                  >
                    decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {outgoing.length > 0 ? (
        <>
          <div className="pod-h2">sent requests</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {outgoing.map((r) => (
              <div
                key={r.id}
                className="chunky"
                style={{ background: 'white', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                {r.addressee?.username ? (
                  <a
                    href={`/profile/${r.addressee.username}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
                  >
                    <Avatar profile={r.addressee} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{r.addressee.display_name || 'someone'}</div>
                      <div suppressHydrationWarning style={{ fontSize: 13, opacity: 0.7 }}>
                        you sent on {formatDate(r.requested_at)} · {podLabel(r.origin_pod)}
                      </div>
                    </div>
                  </a>
                ) : (
                  <>
                    {r.addressee ? <Avatar profile={r.addressee} size={40} /> : null}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{r.addressee?.display_name || 'someone'}</div>
                      <div suppressHydrationWarning style={{ fontSize: 13, opacity: 0.7 }}>
                        you sent on {formatDate(r.requested_at)} · {podLabel(r.origin_pod)}
                      </div>
                    </div>
                  </>
                )}
                <button
                  onClick={() => updateStatus(r.id, 'withdrawn')}
                  disabled={busyId === r.id}
                  className="chunky"
                  style={{ background: 'white', borderRadius: 10, padding: '6px 12px', fontWeight: 700, fontSize: 13 }}
                >
                  withdraw
                </button>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="pod-h2">friends</div>
      {accepted.length === 0 ? (
        <div
          className="chunky"
          style={{ background: 'white', borderRadius: 14, padding: 22, textAlign: 'center' }}
        >
          <div style={{ fontSize: 32, marginBottom: 6 }}>🌱</div>
          <div className="display" style={{ fontSize: 20, marginBottom: 6 }}>no friends yet</div>
          <p style={{ fontSize: 14, opacity: 0.78, lineHeight: 1.5, margin: '0 auto', maxWidth: 360 }}>
            friendships start in pods. when you click with someone on a call,
            send them a request.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {accepted.map((f) => (
            <div
              key={f.friendshipId}
              className="chunky"
              style={{ background: 'white', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
            >
              {f.friend.username ? (
                <a
                  href={`/profile/${f.friend.username}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
                >
                  <Avatar profile={f.friend} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{f.friend.display_name || 'someone'}</div>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>you connected in {podLabel(f.origin_pod)}</div>
                  </div>
                </a>
              ) : (
                <>
                  <Avatar profile={f.friend} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{f.friend.display_name || 'someone'}</div>
                    <div style={{ fontSize: 13, opacity: 0.7 }}>you connected in {podLabel(f.origin_pod)}</div>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <a
                  href={`/messages/${f.friendshipId}`}
                  className="chunky"
                  style={{ background: '#4D96FF', color: '#1F1A3D', borderRadius: 10, padding: '7px 14px', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
                >
                  open chat
                </a>
                <RemoveFriendButton
                  friendshipId={f.friendshipId}
                  otherUserName={f.friend.display_name || 'this friend'}
                  onRemoved={() => router.refresh()}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
