"use client"

import { useEffect, useState } from 'react'
import { useDaily, useLocalSessionId, useParticipantIds } from '@daily-co/daily-react'
import VideoTile from './video-tile'
import type { SessionMember } from '@/lib/session/types'

interface Props {
  members: SessionMember[]
  currentUserId: string
  callStartedAt: string
  onBegin: () => void
  beginning: boolean
}

export default function Lobby({ members, currentUserId, callStartedAt, onBegin, beginning }: Props) {
  const daily = useDaily()
  const participantIds = useParticipantIds()
  const localId = useLocalSessionId()

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // which pod members are already in the call (matched via Daily userData)
  const joinedProfileIds = new Set<string>()
  if (daily) {
    const participants = daily.participants()
    for (const key of Object.keys(participants)) {
      const userData = participants[key].userData as { profile_id?: string } | undefined
      if (userData?.profile_id) joinedProfileIds.add(userData.profile_id)
    }
  }

  const deadline = new Date(callStartedAt).getTime() + 5 * 60 * 1000
  const remainingMs = Math.max(0, deadline - now)
  const countdown = `${Math.floor(remainingMs / 60000)}:${String(
    Math.floor((remainingMs % 60000) / 1000)
  ).padStart(2, '0')}`

  const canBegin = participantIds.length >= 2

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 className="display" style={{ fontSize: 40, marginBottom: 6 }}>
          you&apos;re in the green room 🌿
        </h1>
        <p style={{ opacity: 0.8, marginBottom: 18 }}>
          {remainingMs > 0
            ? `we'll begin when everyone's here, or in about ${countdown}.`
            : "we'll begin whenever you're ready."}
        </p>

        <div
          className="chunky"
          style={{ background: '#FFD23F', borderRadius: 16, padding: 18, marginBottom: 22 }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>while we wait 🎧</div>
          <div style={{ fontSize: 14, opacity: 0.85 }}>
            what&apos;s playing in your headphones right now?
          </div>
        </div>

        {participantIds.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
            {participantIds.map((id, i) => (
              <VideoTile
                key={id}
                participantId={id}
                isLocal={id === localId}
                size={150}
                rotate={(i % 3) - 1}
              />
            ))}
          </div>
        ) : (
          <p style={{ opacity: 0.6, marginBottom: 24 }}>connecting your camera…</p>
        )}

        <div className="pod-h2">your podmates</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {members.map((m) => {
            const here = joinedProfileIds.has(m.profile_id)
            return (
              <div
                key={m.profile_id}
                className="chunky"
                style={{
                  background: here ? '#E6FFED' : 'white',
                  borderRadius: 12,
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontWeight: 700 }}>
                  {m.display_name || 'someone'}
                  {m.profile_id === currentUserId ? ' (you)' : ''}
                </span>
                <span style={{ fontSize: 13, opacity: 0.75 }}>{here ? '✓ here' : 'not yet'}</span>
              </div>
            )
          })}
        </div>

        <button
          onClick={onBegin}
          disabled={!canBegin || beginning}
          className="chunky"
          style={{
            background: canBegin ? '#6BCB77' : 'white',
            borderRadius: 14,
            padding: '14px 28px',
            fontWeight: 700,
            fontSize: 17,
            color: '#1F1A3D',
          }}
        >
          {beginning ? 'starting…' : 'begin the hangout'}
        </button>
        {!canBegin ? (
          <p style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>
            we&apos;ll light this up once at least one more podmate joins.
          </p>
        ) : null}
      </div>
    </div>
  )
}
