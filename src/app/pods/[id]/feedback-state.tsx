"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MemberCard from './member-card'

export default function FeedbackState({ pod, members, currentMember, currentUserId, podId }: any) {
  const router = useRouter()
  // null = idle; true/false = which choice is mid-flight
  const [loading, setLoading] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  const emoji = pod?.primary_interest?.emoji || '🌱'
  const name = pod?.name || 'your pod'
  const vote = currentMember ? currentMember.wants_to_continue : null
  const hasVoted = vote === true || vote === false

  async function submit(choice: boolean) {
    setLoading(choice)
    setError(null)
    try {
      const res = await fetch(`/api/pods/${podId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wantsToContinue: choice }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || 'feedback failed')
      // re-render with the new pod_member / pod state (may land on continuing)
      router.refresh()
    } catch (err) {
      console.error('feedback: submit failed —', err)
      setError('couldn’t save your answer — try again')
      setLoading(null)
    }
  }

  // Case B — already voted, awaiting outcome
  if (hasVoted) {
    return (
      <section>
        <h1 className="display" style={{ fontSize: 36, marginBottom: 12 }}>{name} {emoji}</h1>
        <div className="chunky" style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 560 }}>
          {vote === true ? (
            <p style={{ fontSize: 16 }}>
              thanks for the yes! 🌱 we&apos;ll let you know when 2+ of your podmates also say yes. chat will open up then.
            </p>
          ) : (
            <p style={{ fontSize: 16 }}>
              noted, no worries. 🌱 you won&apos;t be matched with this group again. we&apos;ll find you a better-fitting pod.
            </p>
          )}
          <a href="/home" style={{ display: 'inline-block', marginTop: 16, fontWeight: 700 }}>← back to home</a>
        </div>
      </section>
    )
  }

  // Case A — hasn't voted yet
  const others = (members || []).filter((m: any) => m.profile_id !== currentUserId)

  return (
    <section>
      <h1 className="display" style={{ fontSize: 36, marginBottom: 12 }}>{name} {emoji}</h1>

      <div className="chunky" style={{ background: '#FFD23F', borderRadius: 16, padding: 28, maxWidth: 560 }}>
        <div className="display" style={{ fontSize: 26, marginBottom: 8, lineHeight: 1.2 }}>
          do you want to hang out with this group again?
        </div>
        <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 20 }}>
          your answer is private — only you can see it. we&apos;ll only continue if 2+ of you say yes.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => submit(true)}
            disabled={loading !== null}
            className="chunky"
            style={{ background: '#6BCB77', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: 16 }}
          >
            {loading === true ? 'voting…' : 'yes, please'}
          </button>
          <button
            onClick={() => submit(false)}
            disabled={loading !== null}
            className="chunky"
            style={{ background: 'white', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: 16 }}
          >
            {loading === false ? 'voting…' : 'not this time'}
          </button>
        </div>
        {error ? <div style={{ marginTop: 14, fontSize: 13, color: '#B00020' }}>{error}</div> : null}
      </div>

      {others.length ? (
        <div style={{ marginTop: 28, opacity: 0.65 }}>
          <div className="pod-h2" style={{ marginTop: 0 }}>who you met</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {others.map((m: any) => (
              <MemberCard key={m.profile_id} member={m.profile} variant="pre-first" isYou={false} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
