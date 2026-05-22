"use client"

import { useState } from 'react'

function formatWhen(iso: string, nowMs: number) {
  const dt = new Date(iso)
  const now = new Date(nowMs)
  const sameDay = dt.toDateString() === now.toDateString()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const isTomorrow = dt.toDateString() === tomorrow.toDateString()

  const day = sameDay
    ? 'today'
    : isTomorrow
      ? 'tomorrow'
      : new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(dt)
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(dt)
  return `${day} at ${time}`
}

export default function SessionCard({ session, podId }: any) {
  // capture "now" once at mount so render stays pure (react-hooks/purity)
  const [nowMs] = useState(() => Date.now())
  if (!session) return null

  const when = formatWhen(session.scheduled_for, nowMs)
  const duration = session.duration_minutes ? `${session.duration_minutes} min` : '30 min'
  const startsInMs = new Date(session.scheduled_for).getTime() - nowMs
  // joinable when the call is scheduled and within 10 minutes either side of "now"
  const joinable = session.status === 'scheduled' && Math.abs(startsInMs) <= 10 * 60 * 1000

  return (
    <div className="chunky" style={{ background: 'white', borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        {session.is_first_session ? (
          <span style={{ background: '#FFD23F', border: '2px solid #1F1A3D', borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>
            first call
          </span>
        ) : null}
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.55 }}>
          {session.status}
        </span>
      </div>

      <div style={{ fontWeight: 700, fontSize: 18 }}>{when}</div>
      <div style={{ fontSize: 13, opacity: 0.7 }}>{duration}</div>

      {joinable ? (
        <a
          href={`/pods/${podId}/session/${session.id}`}
          className="chunky"
          style={{ display: 'inline-block', marginTop: 12, background: '#6BCB77', borderRadius: 12, padding: '8px 16px', fontWeight: 700, textDecoration: 'none', color: '#1F1A3D' }}
        >
          join call →
        </a>
      ) : null}
    </div>
  )
}
