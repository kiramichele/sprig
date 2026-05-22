"use client"

import { useState } from 'react'
import MemberCard from './member-card'
import SessionCard from './session-card'
import PodChat from './pod-chat'

export default function ContinuingState({ pod, members, sessions, currentUserId, podId, threadId }: any) {
  // capture "now" once at mount so render stays pure (react-hooks/purity)
  const [now] = useState(() => Date.now())
  const emoji = pod?.primary_interest?.emoji || '🌱'
  const name = pod?.name || (pod?.primary_interest?.name ? `${pod.primary_interest.name} pod` : 'your pod')

  const upcoming = (sessions || [])
    .filter((s: any) => s.status === 'scheduled' && new Date(s.scheduled_for).getTime() > now)
    .sort((a: any, b: any) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())
  const next = upcoming[0] || null

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <h1 className="display" style={{ fontSize: 40 }}>{name} {emoji}</h1>
        <span style={{ background: '#6BCB77', border: '2.5px solid #1F1A3D', borderRadius: 999, padding: '2px 12px', fontWeight: 700, fontSize: 13 }}>
          continuing
        </span>
      </div>
      <p style={{ opacity: 0.8, marginBottom: 8 }}>your clubhouse — chat, plan, and keep meeting up.</p>

      <div className="pod-h2">next session</div>
      {next ? (
        <SessionCard session={next} podId={podId} />
      ) : (
        <div className="chunky" style={{ background: 'white', borderRadius: 14, padding: 16 }}>
          no session scheduled yet — pick a time together in chat below.
        </div>
      )}
      <button
        onClick={() => alert('session scheduling is coming soon!')}
        className="chunky"
        style={{ marginTop: 12, background: 'white', borderRadius: 12, padding: '8px 16px', fontWeight: 700 }}
      >
        + schedule another session
      </button>

      <div className="pod-h2">your pod</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {members.map((m: any) => (
          <MemberCard
            key={m.profile_id}
            member={m.profile}
            variant="continuing"
            isYou={m.profile_id === currentUserId}
          />
        ))}
      </div>

      <div className="pod-h2">pod chat</div>
      <PodChat threadId={threadId} currentUserId={currentUserId} members={members} />
    </section>
  )
}
