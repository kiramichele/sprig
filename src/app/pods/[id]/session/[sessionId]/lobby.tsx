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
    <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="display text-3xl sm:text-5xl mb-2">
          you&apos;re in the green room 🌿
        </h1>
        <p className="opacity-80 mb-4 text-sm sm:text-base">
          {remainingMs > 0
            ? `we'll begin when everyone's here, or in about ${countdown}.`
            : "we'll begin whenever you're ready."}
        </p>

        <div
          className="chunky mb-5 sm:mb-6"
          style={{ background: '#FFD23F', borderRadius: 16, padding: 16 }}
        >
          <div className="font-bold mb-0.5">while we wait 🎧</div>
          <div className="text-sm opacity-85">
            what&apos;s playing in your headphones right now?
          </div>
        </div>

        {participantIds.length > 0 ? (
          <div className="grid gap-3 sm:gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', justifyItems: 'center' }}>
            {participantIds.map((id, i) => (
              <VideoTile
                key={id}
                participantId={id}
                isLocal={id === localId}
                size={140}
                rotate={(i % 3) - 1}
              />
            ))}
          </div>
        ) : (
          <p className="opacity-60 mb-6">connecting your camera…</p>
        )}

        <div className="pod-h2">your podmates</div>
        <div className="flex flex-col gap-2 mb-6">
          {members.map((m) => {
            const here = joinedProfileIds.has(m.profile_id)
            return (
              <div
                key={m.profile_id}
                className="chunky flex justify-between items-center gap-3"
                style={{
                  background: here ? '#E6FFED' : 'white',
                  borderRadius: 12,
                  padding: '10px 14px',
                  minHeight: 44,
                }}
              >
                <span className="font-bold">
                  {m.display_name || 'someone'}
                  {m.profile_id === currentUserId ? ' (you)' : ''}
                </span>
                <span className="text-sm opacity-75">{here ? '✓ here' : 'not yet'}</span>
              </div>
            )
          })}
        </div>

        <button
          onClick={onBegin}
          disabled={!canBegin || beginning}
          className="chunky w-full sm:w-auto"
          style={{
            background: canBegin ? '#6BCB77' : 'white',
            borderRadius: 14,
            padding: '14px 28px',
            fontWeight: 700,
            fontSize: 17,
            color: '#1F1A3D',
            minHeight: 52,
          }}
        >
          {beginning ? 'starting…' : 'begin the hangout'}
        </button>
        {!canBegin ? (
          <p className="text-sm opacity-70 mt-2">
            we&apos;ll light this up once at least one more podmate joins.
          </p>
        ) : null}
      </div>
    </div>
  )
}
