"use client"

import { useEffect, useRef, useState } from 'react'
import {
  useAppMessage,
  useDaily,
  useLocalSessionId,
  useParticipantIds,
  useParticipantProperty,
} from '@daily-co/daily-react'
import VideoTile from './video-tile'
import type {
  AdvanceAction,
  PodSessionState,
  PromptCard,
  PromptRound,
  SessionMember,
} from '@/lib/session/types'

interface Props {
  members: SessionMember[]
  currentUserId: string
  sessionState: PodSessionState
  rounds: PromptRound[]
  cards: PromptCard[]
  advancing: boolean
  onAdvance: (action: AdvanceAction) => void
  podName: string
  podEmoji: string
}

interface ReactionMsg {
  type: 'reaction'
  emoji: string
}

interface FloatingReaction {
  id: number
  emoji: string
  left: number
}

const REACTIONS = ['❤️', '😂', '👏', '🎉', '🌱']

export default function InCall({
  members,
  currentUserId,
  sessionState,
  rounds,
  cards,
  advancing,
  onAdvance,
  podName,
  podEmoji,
}: Props) {
  const daily = useDaily()
  const localId = useLocalSessionId()
  const participantIds = useParticipantIds()
  const audioOn = useParticipantProperty(localId ?? '', 'audio')
  const videoOn = useParticipantProperty(localId ?? '', 'video')

  const [floating, setFloating] = useState<FloatingReaction[]>([])
  const reactionSeq = useRef(0)

  function spawnReaction(emoji: string) {
    const id = reactionSeq.current++
    setFloating((prev) => [...prev, { id, emoji, left: 8 + Math.random() * 84 }])
    setTimeout(() => setFloating((prev) => prev.filter((r) => r.id !== id)), 2500)
  }

  const sendAppMessage = useAppMessage<ReactionMsg>({
    onAppMessage: (ev) => {
      if (ev.data?.type === 'reaction') spawnReaction(ev.data.emoji)
    },
  })

  function react(emoji: string) {
    sendAppMessage({ type: 'reaction', emoji })
    spawnReaction(emoji) // sendAppMessage does not echo to the sender
  }

  const currentRound = rounds.find((r) => r.slug === sessionState.current_round_slug) ?? rounds[0]
  const currentCard: PromptCard | undefined = cards.find(
    (c) => c.id === sessionState.current_card_id
  )
  const speaker = members.find((m) => m.profile_id === sessionState.current_speaker_id)
  const roundIndex = rounds.findIndex((r) => r.slug === sessionState.current_round_slug)
  const isWrapRound = sessionState.current_round_slug === 'wrap'

  // decorative round timer — guidance only, never auto-advances
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const roundDuration = (currentRound?.duration_seconds ?? 240) * 1000
  const remaining = Math.max(
    0,
    roundDuration - (now - new Date(sessionState.round_started_at).getTime())
  )
  const timerLabel =
    remaining > 0
      ? `${Math.floor(remaining / 60000)}:${String(
          Math.floor((remaining % 60000) / 1000)
        ).padStart(2, '0')}`
      : "time's up ⏰"

  const speakerLabel = speaker
    ? speaker.profile_id === currentUserId
      ? 'your'
      : `${speaker.display_name || 'someone'}'s`
    : "someone's"

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#241F3D',
        color: '#FFF6E5',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '2px solid rgba(255,255,255,0.1)',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div className="display" style={{ fontSize: 22 }}>
          {podName} {podEmoji}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {rounds.map((r, i) => (
            <div
              key={r.slug}
              title={r.name}
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                border: '2px solid #FFF6E5',
                background:
                  i === roundIndex
                    ? r.color_hex || '#FFD23F'
                    : i < roundIndex
                      ? 'rgba(255,255,255,0.55)'
                      : 'transparent',
              }}
            />
          ))}
        </div>
        <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{timerLabel}</div>
      </div>

      {/* participant video row */}
      <div style={{ display: 'flex', gap: 12, padding: '14px 20px', overflowX: 'auto' }}>
        {participantIds.map((id, i) => (
          <VideoTile
            key={id}
            participantId={id}
            isLocal={id === localId}
            size={104}
            rotate={(i % 3) - 1}
          />
        ))}
      </div>

      {/* center: round badge + prompt card */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 20px 24px',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: currentRound?.color_hex || '#FFD23F',
            color: '#1F1A3D',
            border: '2.5px solid #1F1A3D',
            boxShadow: '4px 4px 0 0 #1F1A3D',
            borderRadius: 999,
            padding: '6px 16px',
            fontWeight: 700,
          }}
        >
          <span>{currentRound?.emoji || '🌱'}</span>
          <span>{currentRound?.name || 'round'}</span>
        </div>

        <div
          className="chunky"
          style={{
            background: '#FFF6E5',
            color: '#1F1A3D',
            borderRadius: 24,
            padding: '40px 32px',
            maxWidth: 620,
            width: '100%',
            textAlign: 'center',
          }}
        >
          <div className="display" style={{ fontSize: 28, lineHeight: 1.3 }}>
            {currentCard?.body || 'take a breath — the next prompt is on its way.'}
          </div>
        </div>

        <div style={{ fontSize: 15 }}>
          🎤 <strong>{speakerLabel}</strong> turn to share
        </div>
      </div>

      {/* bottom bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 20px',
          borderTop: '2px solid rgba(255,255,255,0.1)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => daily?.setLocalAudio(!audioOn)}
            className="callctl"
            style={{ background: audioOn ? 'white' : '#B00020', color: audioOn ? '#1F1A3D' : 'white' }}
            title={audioOn ? 'mute' : 'unmute'}
          >
            {audioOn ? '🎙️' : '🔇'}
          </button>
          <button
            onClick={() => daily?.setLocalVideo(!videoOn)}
            className="callctl"
            style={{ background: videoOn ? 'white' : '#B00020', color: videoOn ? '#1F1A3D' : 'white' }}
            title={videoOn ? 'turn camera off' : 'turn camera on'}
          >
            {videoOn ? '📹' : '🚫'}
          </button>
          <button
            onClick={() => daily?.leave()}
            className="callctl"
            style={{ background: '#B00020', color: 'white' }}
          >
            leave
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => react(emoji)}
              className="callctl"
              style={{ background: 'white' }}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onAdvance('next_card')}
            disabled={advancing}
            className="chunky"
            style={{ background: '#FFD23F', color: '#1F1A3D', borderRadius: 12, padding: '10px 16px', fontWeight: 700 }}
          >
            next card →
          </button>
          <button
            onClick={() => onAdvance('next_round')}
            disabled={advancing}
            className="chunky"
            style={{ background: 'white', color: '#1F1A3D', borderRadius: 12, padding: '10px 16px', fontWeight: 700 }}
          >
            {isWrapRound ? 'wrap up →' : 'skip round →'}
          </button>
        </div>
      </div>

      {/* floating reactions */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {floating.map((r) => (
          <div
            key={r.id}
            style={{
              position: 'absolute',
              bottom: 90,
              left: `${r.left}%`,
              fontSize: 38,
              animation: 'floatUp 2.5s ease-out forwards',
            }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      <style>{`
        .callctl { border:2.5px solid #1F1A3D; box-shadow:3px 3px 0 0 #1F1A3D; border-radius:10px; padding:8px 12px; font-weight:700; font-size:15px; transition:all .1s ease; }
        .callctl:hover { transform:translate(-1px,-1px); }
        .callctl:active { transform:translate(2px,2px); box-shadow:1px 1px 0 0 #1F1A3D; }
        .callctl:disabled { opacity:.55; cursor:not-allowed; }
        @keyframes floatUp {
          0% { transform:translateY(0) scale(.6); opacity:0 }
          15% { opacity:1; transform:translateY(-24px) scale(1.1) }
          100% { transform:translateY(-340px) scale(1); opacity:0 }
        }
      `}</style>
    </div>
  )
}
