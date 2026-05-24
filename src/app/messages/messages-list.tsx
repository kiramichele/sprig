"use client"

import { useState } from 'react'

export interface ChatProfile {
  id: string
  display_name: string | null
  photo_url: string | null
  username: string | null
}

export interface ThreadPreview {
  friendshipId: string
  otherUser: ChatProfile
  lastMessage: string | null
  lastMessageAt: string | null
}

interface Props {
  threads: ThreadPreview[]
}

const AVATAR_COLORS = ['#FFD23F', '#6BCB77', '#4D96FF', '#FF6B6B', '#C780E8']
function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function Avatar({ profile, size = 48 }: { profile: ChatProfile; size?: number }) {
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

function relativeTime(iso: string | null, nowMs: number): string {
  if (!iso) return ''
  const mins = Math.floor((nowMs - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

export default function MessagesList({ threads }: Props) {
  // capture "now" once so render stays pure (react-hooks/purity)
  const [now] = useState(() => Date.now())

  return (
    <div className="max-w-4xl mx-auto p-8">
      <style>{`
        .chunky { border:2.5px solid #1F1A3D; box-shadow:4px 4px 0 0 #1F1A3D; transition:all .12s ease; }
        .chunky:hover { transform:translate(-1px,-1px); box-shadow:5px 5px 0 0 #1F1A3D; }
        .chunky:active { transform:translate(2px,2px); box-shadow:1px 1px 0 0 #1F1A3D; }
      `}</style>

      <h1 className="display" style={{ fontSize: 40, marginBottom: 4 }}>messages 💬</h1>
      <p style={{ opacity: 0.8, marginBottom: 20 }}>your dms with pod friends.</p>

      {threads.length === 0 ? (
        <div className="chunky" style={{ background: 'white', borderRadius: 14, padding: 20, opacity: 0.85 }}>
          no DMs yet — say hi to a friend from the friends page
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {threads.map((t) => (
            <div
              key={t.friendshipId}
              className="chunky"
              style={{
                background: 'white', borderRadius: 12, padding: '12px 16px', display: 'flex',
                alignItems: 'center', gap: 12,
              }}
            >
              {t.otherUser.username ? (
                <a
                  href={`/profile/${t.otherUser.username}`}
                  aria-label="view profile"
                  style={{ display: 'flex', flexShrink: 0, textDecoration: 'none' }}
                >
                  <Avatar profile={t.otherUser} size={48} />
                </a>
              ) : (
                <Avatar profile={t.otherUser} size={48} />
              )}
              <a
                href={`/messages/${t.friendshipId}`}
                style={{
                  flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12,
                  textDecoration: 'none', color: 'inherit',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{t.otherUser.display_name || 'someone'}</div>
                  <div style={{ fontSize: 13, opacity: 0.65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.lastMessage ? truncate(t.lastMessage, 80) : 'no messages yet'}
                  </div>
                </div>
                <div suppressHydrationWarning style={{ fontSize: 12, opacity: 0.55, flexShrink: 0 }}>
                  {relativeTime(t.lastMessageAt, now)}
                </div>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
