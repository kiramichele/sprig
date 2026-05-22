"use client"

import { useState } from 'react'
import MemberCard from './member-card'
import SessionCard from './session-card'

function relative(iso: string, nowMs: number) {
  const diff = new Date(iso).getTime() - nowMs
  const mins = Math.round(diff / 60000)
  if (mins <= 1) return 'a moment'
  if (mins < 60) return `${mins} minutes`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}

export default function PreFirstState({ pod, members, sessions, currentUserId, podId }: any) {
  // capture "now" once at mount so render stays pure (react-hooks/purity)
  const [now] = useState(() => Date.now())
  const emoji = pod?.primary_interest?.emoji || '🌱'
  const name = pod?.name || (pod?.primary_interest?.name ? `${pod.primary_interest.name} pod` : 'your pod')

  const upcoming = (sessions || [])
    .filter((s: any) => s.status === 'scheduled' && new Date(s.scheduled_for).getTime() > now)
    .sort((a: any, b: any) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())
  const next = upcoming[0] || null
  const soon = !!next && new Date(next.scheduled_for).getTime() - now <= 24 * 60 * 60 * 1000

  return (
    <section>
      <h1 className="display" style={{ fontSize: 40, marginBottom: 8 }}>{name} {emoji}</h1>
      <p style={{ opacity: 0.8, marginBottom: 20 }}>your pod is forming — here&apos;s who you&apos;ll meet.</p>

      {soon && next ? (
        <div className="chunky" style={{ background: '#FFD23F', borderRadius: 14, padding: 20, marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>your first call is in {relative(next.scheduled_for, now)}</div>
          <a
            href={`/pods/${podId}/session/${next.id}`}
            className="chunky"
            style={{ display: 'inline-block', marginTop: 12, background: 'white', borderRadius: 12, padding: '10px 18px', fontWeight: 700, textDecoration: 'none', color: '#1F1A3D' }}
          >
            join call →
          </a>
        </div>
      ) : null}

      <div className="pod-h2">your podmates</div>
      {members.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {members.map((m: any) => (
            <MemberCard
              key={m.profile_id}
              member={m.profile}
              variant="pre-first"
              isYou={m.profile_id === currentUserId}
            />
          ))}
        </div>
      ) : (
        <p style={{ opacity: 0.7, fontSize: 14 }}>we&apos;re still gathering your group.</p>
      )}

      <div className="pod-h2">your first session</div>
      {next ? (
        <SessionCard session={next} podId={podId} />
      ) : (
        <div className="chunky" style={{ background: 'white', borderRadius: 14, padding: 16 }}>
          no session scheduled yet — we&apos;ll let you know when it&apos;s set.
        </div>
      )}
      <p style={{ fontSize: 13, opacity: 0.75, marginTop: 8 }}>
        we&apos;ll guide the first 30 minutes with prompt cards and a structured flow. no need to prep.
      </p>

      <p style={{ fontSize: 13, opacity: 0.7, marginTop: 28 }}>
        this is a one-time meet. you&apos;ll only continue if everyone wants to.
      </p>
    </section>
  )
}
