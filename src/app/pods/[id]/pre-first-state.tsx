"use client"

import { useState } from 'react'
import MemberCard from './member-card'
import SessionCard from './session-card'
import LeavePodButton from './leave-pod-button'

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

  // a session stays "joinable-or-upcoming" until 10 minutes past its start, so
  // latecomers still see the join prompt (status flips to 'in_progress' once the
  // first person joins, and scheduled_for moves into the past).
  const LATE_GRACE_MS = 15 * 60 * 1000
  const upcoming = (sessions || [])
    .filter(
      (s: any) =>
        (s.status === 'scheduled' || s.status === 'in_progress') &&
        new Date(s.scheduled_for).getTime() > now - LATE_GRACE_MS
    )
    .sort((a: any, b: any) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())
  const next = upcoming[0] || null
  const startMs = next ? new Date(next.scheduled_for).getTime() : 0
  const hasStarted = !!next && startMs <= now
  const soon = !!next && startMs - now <= 24 * 60 * 60 * 1000

  return (
    <section>
      <h1 className="display text-3xl sm:text-4xl mb-2">{name} {emoji}</h1>
      <p className="opacity-80 mb-5 text-sm sm:text-base">your pod is forming — here&apos;s who you&apos;ll meet.</p>

      {soon && next ? (
        <div className="chunky mb-2 px-5 py-4 sm:p-5" style={{ background: '#FFD23F', borderRadius: 14 }}>
          <div suppressHydrationWarning className="font-bold text-base sm:text-lg">
            {hasStarted
              ? 'your first call is happening now — hop in 🎥'
              : `your first call is in ${relative(next.scheduled_for, now)}`}
          </div>
          <a
            href={`/pods/${podId}/session/${next.id}`}
            className="chunky inline-flex items-center justify-center mt-3 px-5 font-bold w-full sm:w-auto"
            style={{ background: 'white', borderRadius: 12, textDecoration: 'none', color: '#1F1A3D', minHeight: 48 }}
          >
            join call →
          </a>
        </div>
      ) : null}

      <div className="pod-h2">your podmates</div>
      {members.length ? (
        <div className="flex flex-wrap gap-3 sm:gap-4 justify-center sm:justify-start">
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
        <p className="opacity-70 text-sm">we&apos;re still gathering your group.</p>
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

      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        <LeavePodButton
          podId={podId}
          podName={name}
          podStatus={pod?.status || 'scheduled'}
          memberCount={members?.length ?? 0}
          currentUserId={currentUserId}
        />
      </div>
    </section>
  )
}
