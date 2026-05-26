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
      className="min-h-screen flex items-center justify-center px-4 py-8 sm:px-6"
      style={{ color: '#1F1A3D' }}
    >
      <div className="w-full max-w-xl text-center">
        <h1 className="display text-3xl sm:text-5xl mb-3">
          that was nice ✨
        </h1>
        <p className="opacity-80 mb-6 text-sm sm:text-base">one last thought before you go —</p>

        <div
          className="chunky mb-7 px-6 py-8 sm:px-7 sm:py-9"
          style={{
            background: 'white',
            borderRadius: 24,
          }}
        >
          <div className="display text-xl sm:text-2xl" style={{ lineHeight: 1.35 }}>
            {prompt}
          </div>
        </div>

        <button
          onClick={onEnd}
          disabled={ending}
          className="chunky w-full sm:w-auto"
          style={{
            background: '#6BCB77',
            color: '#1F1A3D',
            borderRadius: 14,
            padding: '14px 32px',
            fontWeight: 700,
            fontSize: 17,
            minHeight: 52,
          }}
        >
          {ending ? 'wrapping up…' : 'end call'}
        </button>
        {endError ? (
          <p className="text-sm font-bold mt-3" style={{ color: '#B00020' }}>
            {endError}
          </p>
        ) : null}
      </div>
    </div>
  )
}
