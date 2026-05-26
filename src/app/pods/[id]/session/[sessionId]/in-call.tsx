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
  onLeave: () => void
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
  onLeave,
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
  // Local-only view preference — each participant can collapse the prompt
  // card to give the videos more room. Does NOT sync to other participants.
  const [cardMinimized, setCardMinimized] = useState(false)

  // matchMedia-driven viewport flag, used for tile size + rotation. SSR-safe
  // (defaults to false; the effect runs only on the client).
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

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
      {/* top bar — pod name hides on the smallest screens to keep the round
          dots + timer comfortably visible */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5 flex-wrap"
        style={{
          borderBottom: '2px solid rgba(255,255,255,0.1)',
        }}
      >
        <div
          className="display text-base sm:text-xl truncate hidden xs:block sm:block"
          style={{ maxWidth: '40%' }}
        >
          {podName} {podEmoji}
        </div>
        <div className="flex gap-1.5 sm:gap-2">
          {rounds.map((r, i) => (
            <div
              key={r.slug}
              title={r.name}
              className="w-3 h-3 sm:w-3.5 sm:h-3.5"
              style={{
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
        <div className="font-bold text-sm sm:text-base" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {timerLabel}
        </div>
      </div>

      {!cardMinimized ? (
        <>
          {/* participant video row — small sticker tiles, horizontally
              scrollable, with reduced rotation on mobile so they don't look
              chaotic at small sizes */}
          <div className="flex gap-2 sm:gap-3 px-4 sm:px-5 py-3 overflow-x-auto">
            {participantIds.map((id, i) => (
              <VideoTile
                key={id}
                participantId={id}
                isLocal={id === localId}
                size={isMobile ? 76 : 104}
                rotate={isMobile ? 0 : (i % 3) - 1}
              />
            ))}
          </div>

          {/* center: round badge + prompt card */}
          <div className="flex-1 flex flex-col items-center justify-center gap-3 sm:gap-4 px-4 sm:px-5 pb-4 sm:pb-6 pt-1">
            <div
              className="inline-flex items-center gap-2 text-sm sm:text-base"
              style={{
                background: currentRound?.color_hex || '#FFD23F',
                color: '#1F1A3D',
                border: '2.5px solid #1F1A3D',
                boxShadow: '4px 4px 0 0 #1F1A3D',
                borderRadius: 999,
                padding: '5px 14px',
                fontWeight: 700,
              }}
            >
              <span>{currentRound?.emoji || '🌱'}</span>
              <span>{currentRound?.name || 'round'}</span>
            </div>

            <div
              className="chunky w-full px-6 py-7 sm:px-8 sm:py-10"
              style={{
                position: 'relative',
                background: '#FFF6E5',
                color: '#1F1A3D',
                borderRadius: 24,
                maxWidth: 620,
                textAlign: 'center',
              }}
            >
              <button
                onClick={() => setCardMinimized(true)}
                title="hide prompt to make videos bigger"
                aria-label="minimize prompt card"
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  border: '2px solid #1F1A3D',
                  background: 'white',
                  fontWeight: 700,
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: 'pointer',
                  color: '#1F1A3D',
                }}
              >
                −
              </button>
              <div className="display text-xl sm:text-2xl" style={{ lineHeight: 1.3 }}>
                {currentCard?.body || 'take a breath — the next prompt is on its way.'}
              </div>
            </div>

            <div className="text-sm sm:text-base text-center">
              🎤 <strong>{speakerLabel}</strong> turn to share
            </div>
          </div>
        </>
      ) : (
        <>
          {/* minimized prompt strip — just the round + an expand control. */}
          <div className="px-4 sm:px-5 pt-3">
            <button
              onClick={() => setCardMinimized(false)}
              className="chunky w-full sm:w-auto"
              title="show full prompt"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                background: currentRound?.color_hex || '#FFD23F',
                color: '#1F1A3D',
                borderRadius: 999,
                padding: '8px 14px 8px 12px',
                fontWeight: 700,
                fontSize: 14,
                maxWidth: '100%',
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              <span>{currentRound?.emoji || '🌱'}</span>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  textAlign: 'left',
                }}
              >
                {currentCard?.body || currentRound?.name || 'tap to see prompt'}
              </span>
              <span aria-hidden style={{ fontWeight: 700, opacity: 0.8 }}>↥</span>
            </button>
          </div>

          {/* big video grid — fills the freed central space. The narrower
              minmax keeps tiles reasonable on a 375px viewport (~150px ea). */}
          <div
            className="flex-1 grid gap-3 sm:gap-4 px-4 sm:px-5 py-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              alignContent: 'center',
              justifyItems: 'center',
            }}
          >
            {participantIds.map((id, i) => (
              <VideoTile
                key={id}
                participantId={id}
                isLocal={id === localId}
                size={isMobile ? 150 : 240}
                rotate={isMobile ? 0 : (i % 3) - 1}
              />
            ))}
          </div>

          <div className="text-sm text-center px-4 pb-3">
            🎤 <strong>{speakerLabel}</strong> turn to share
          </div>
        </>
      )}

      {/* bottom bar — three button groups. On mobile they stack into three
          rows (A/V + leave, reactions, advance) so nothing wraps awkwardly. */}
      <div
        className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-3.5"
        style={{
          borderTop: '2px solid rgba(255,255,255,0.1)',
        }}
      >
        <div className="flex gap-2 justify-center sm:justify-start">
          <button
            onClick={() => daily?.setLocalAudio(!audioOn)}
            className="callctl"
            style={{ background: audioOn ? 'white' : '#B00020', color: audioOn ? '#1F1A3D' : 'white' }}
            title={audioOn ? 'mute' : 'unmute'}
            aria-label={audioOn ? 'mute' : 'unmute'}
          >
            {audioOn ? '🎙️' : '🔇'}
          </button>
          <button
            onClick={() => daily?.setLocalVideo(!videoOn)}
            className="callctl"
            style={{ background: videoOn ? 'white' : '#B00020', color: videoOn ? '#1F1A3D' : 'white' }}
            title={videoOn ? 'turn camera off' : 'turn camera on'}
            aria-label={videoOn ? 'turn camera off' : 'turn camera on'}
          >
            {videoOn ? '📹' : '🚫'}
          </button>
          <button
            onClick={onLeave}
            className="callctl"
            style={{ background: '#B00020', color: 'white' }}
          >
            leave
          </button>
        </div>

        <div className="flex gap-1.5 justify-center">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => react(emoji)}
              className="callctl"
              style={{ background: 'white' }}
              aria-label={`react with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="flex gap-2 justify-center sm:justify-end">
          <button
            onClick={() => onAdvance('next_card')}
            disabled={advancing}
            className="chunky flex-1 sm:flex-initial"
            style={{ background: '#FFD23F', color: '#1F1A3D', borderRadius: 12, padding: '10px 16px', fontWeight: 700, minHeight: 44 }}
          >
            next card →
          </button>
          <button
            onClick={() => onAdvance('next_round')}
            disabled={advancing}
            className="chunky flex-1 sm:flex-initial"
            style={{ background: 'white', color: '#1F1A3D', borderRadius: 12, padding: '10px 16px', fontWeight: 700, minHeight: 44 }}
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
        .callctl { border:2.5px solid #1F1A3D; box-shadow:3px 3px 0 0 #1F1A3D; border-radius:10px; padding:8px 12px; font-weight:700; font-size:15px; min-height:44px; min-width:44px; transition:all .1s ease; }
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
