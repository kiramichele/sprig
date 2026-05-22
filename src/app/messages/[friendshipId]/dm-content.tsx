"use client"

import TopNav from '@/components/top-nav'
import DmChat from './dm-chat'
import type { ChatProfile } from '../messages-list'

interface Props {
  profile: { id: string; display_name?: string | null; photo_url?: string | null }
  otherUser: ChatProfile
  threadId: string | null
  currentUserId: string
  pendingRequestCount: number
}

const AVATAR_COLORS = ['#FFD23F', '#6BCB77', '#4D96FF', '#FF6B6B', '#C780E8']
function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function HeaderAvatar({ profile }: { profile: ChatProfile }) {
  const color = AVATAR_COLORS[hash(profile.id || profile.display_name || '?') % AVATAR_COLORS.length]
  const initial = (profile.display_name || '?').slice(0, 1).toUpperCase()
  if (profile.photo_url) {
    return (
      <img
        src={profile.photo_url}
        alt={profile.display_name || 'friend'}
        style={{ width: 44, height: 44, borderRadius: 9999, objectFit: 'cover', border: '2.5px solid #1F1A3D' }}
      />
    )
  }
  return (
    <span
      style={{
        width: 44, height: 44, borderRadius: 9999, background: color, border: '2.5px solid #1F1A3D',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18,
      }}
    >
      {initial}
    </span>
  )
}

export default function DmContent({ profile, otherUser, threadId, currentUserId, pendingRequestCount }: Props) {
  return (
    <div>
      <TopNav profile={profile || { id: currentUserId }} pendingRequestCount={pendingRequestCount} />
      <style>{`
        .chunky { border:2.5px solid #1F1A3D; box-shadow:4px 4px 0 0 #1F1A3D; transition:all .12s ease; }
        .chunky:hover { transform:translate(-1px,-1px); box-shadow:5px 5px 0 0 #1F1A3D; }
        .chunky:active { transform:translate(2px,2px); box-shadow:1px 1px 0 0 #1F1A3D; }
        .chunky:disabled { opacity:.55; cursor:not-allowed; }
        .field { border:2.5px solid #1F1A3D; background:white; border-radius:12px; padding:10px 14px; font-size:15px; width:100%; outline:none; }
        .field:focus { box-shadow:3px 3px 0 0 #1F1A3D; }
      `}</style>

      <div className="max-w-4xl mx-auto p-8">
        <a href="/messages" style={{ fontWeight: 700, fontSize: 14 }}>← back to messages</a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0 20px' }}>
          <HeaderAvatar profile={otherUser} />
          <h1 className="display" style={{ fontSize: 32 }}>{otherUser.display_name || 'someone'}</h1>
        </div>
        <DmChat threadId={threadId} currentUserId={currentUserId} otherUser={otherUser} />
      </div>
    </div>
  )
}
