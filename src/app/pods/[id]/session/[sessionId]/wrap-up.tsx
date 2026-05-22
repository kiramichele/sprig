"use client"

import type { PodSessionState, PromptCard, PromptRound } from '@/lib/session/types'

interface Props {
  sessionState: PodSessionState
  rounds: PromptRound[]
  cards: PromptCard[]
  onEnd: () => void
  ending: boolean
  endError: string | null
}

export default function WrapUp({ sessionState, rounds, cards, onEnd, ending, endError }: Props) {
  // a closing reflection — the current card, falling back to a reflection card
  const reflectionRound = rounds.find((r) => r.slug === 'reflection')
  const reflectionCards = reflectionRound
    ? cards.filter((c) => c.round_id === reflectionRound.id)
    : []
  const currentCard = cards.find((c) => c.id === sessionState.current_card_id)
  const prompt =
    currentCard?.body ||
    reflectionCards[0]?.body ||
    "what's one small thing you'll take away from today?"

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        color: '#1F1A3D',
      }}
    >
      <div style={{ maxWidth: 560, textAlign: 'center' }}>
        <h1 className="display" style={{ fontSize: 44, marginBottom: 12 }}>
          that was nice ✨
        </h1>
        <p style={{ opacity: 0.8, marginBottom: 24 }}>one last thought before you go —</p>

        <div
          className="chunky"
          style={{
            background: 'white',
            borderRadius: 24,
            padding: '32px 28px',
            marginBottom: 28,
          }}
        >
          <div className="display" style={{ fontSize: 24, lineHeight: 1.35 }}>
            {prompt}
          </div>
        </div>

        <button
          onClick={onEnd}
          disabled={ending}
          className="chunky"
          style={{
            background: '#6BCB77',
            color: '#1F1A3D',
            borderRadius: 14,
            padding: '14px 32px',
            fontWeight: 700,
            fontSize: 17,
          }}
        >
          {ending ? 'wrapping up…' : 'end call'}
        </button>
        {endError ? (
          <p style={{ color: '#B00020', fontSize: 13, marginTop: 12, fontWeight: 700 }}>
            {endError}
          </p>
        ) : null}
      </div>
    </div>
  )
}
