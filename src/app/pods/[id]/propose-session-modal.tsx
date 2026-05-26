"use client"

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/scheduling/errors'
import Spinner from '@/components/spinner'

interface Props {
  podId: string
  lastSessionAt: string | null
  onClose: () => void
  onProposed: () => void
}

type Duration = 30 | 45 | 60

/**
 * Format a Date in the user's local TZ as a `datetime-local` input value
 * (YYYY-MM-DDTHH:mm). `.toISOString()` returns UTC, which would shift the time
 * the user sees, so we slice the local components manually.
 */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Default time: same day-of-week + same time, one week after the last
 * session. If there's no last session, next Saturday at 7pm.
 */
function defaultProposalTime(lastSessionAt: string | null): Date {
  if (lastSessionAt) {
    const last = new Date(lastSessionAt)
    return new Date(last.getTime() + 7 * 24 * 60 * 60 * 1000)
  }
  const d = new Date()
  // 6 = Saturday in JS's getDay()
  const daysUntilSat = (6 - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + daysUntilSat)
  d.setHours(19, 0, 0, 0)
  return d
}

const LONG_DATE = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function formatLong(d: Date): string {
  // Intl gives "Saturday, May 30, 7:00 PM"; we want "...May 30 at 7:00 PM".
  return LONG_DATE.format(d).replace(/(\d+), (\d+:)/, '$1 at $2')
}

function friendlyError(raw: string): string {
  if (/already scheduled around/i.test(raw)) {
    return 'another session is already scheduled around that time. pick a different slot.'
  }
  if (/must be scheduled for the future/i.test(raw)) {
    return 'that time is in the past. pick a future time.'
  }
  if (/not a pod member/i.test(raw)) {
    return 'something went wrong — refresh and try again.'
  }
  return raw || 'could not propose — try again.'
}

export default function ProposeSessionModal({ podId, lastSessionAt, onClose, onProposed }: Props) {
  const initial = useMemo(() => defaultProposalTime(lastSessionAt), [lastSessionAt])
  const [when, setWhen] = useState<string>(() => toLocalInputValue(initial))
  const [duration, setDuration] = useState<Duration>(30)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // capture "now" at mount so render stays pure (react-hooks/purity); the
  // "is past" check is purely advisory — submit() re-checks against real time.
  const [nowMs] = useState(() => Date.now())

  // ESC to close — small ergonomic win
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const proposedDate = useMemo(() => (when ? new Date(when) : null), [when])
  const isPast = !proposedDate || proposedDate.getTime() <= nowMs
  const previewText = proposedDate
    ? `you'll be proposing ${formatLong(proposedDate)} for ${duration} min.`
    : 'pick a date and time above.'

  async function submit() {
    if (!proposedDate || proposedDate.getTime() <= Date.now() || busy) return
    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = supabase
      const { error: rpcError } = await sb.rpc('propose_session', {
        p_pod_id: podId,
        p_scheduled_for: proposedDate.toISOString(),
        p_duration_minutes: duration,
      })
      if (rpcError) throw rpcError
      onProposed()
    } catch (err) {
      console.error('propose_session failed:', err)
      setError(friendlyError(getErrorMessage(err)))
      setBusy(false)
    }
  }

  return (
    <div
      onClick={() => (!busy ? onClose() : undefined)}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(31,26,61,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, zIndex: 200,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="chunky"
        style={{
          background: '#FFF6E5', borderRadius: 18, padding: 24,
          width: '100%', maxWidth: 460,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 className="display" style={{ fontSize: 26 }}>propose your next hangout 🌱</h2>
        </div>
        <p style={{ opacity: 0.75, fontSize: 14, marginBottom: 16 }}>
          everyone in the pod will see this and rsvp. once everyone says yes, it&apos;s on the books.
        </p>

        <label style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.7 }}>
          when
        </label>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          disabled={busy}
          className="field"
          style={{ marginTop: 6, marginBottom: 16 }}
        />

        <label style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.7 }}>
          how long
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {([30, 45, 60] as Duration[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setDuration(opt)}
              disabled={busy}
              className="chunky"
              style={{
                background: duration === opt ? '#FFD23F' : 'white',
                borderRadius: 10, padding: '7px 14px', fontWeight: 700, fontSize: 14,
              }}
            >
              {opt} min
            </button>
          ))}
        </div>

        <div
          style={{
            background: 'white', border: '2.5px solid #1F1A3D', borderRadius: 12,
            padding: '10px 14px', fontSize: 14, marginBottom: 16,
            opacity: isPast ? 0.55 : 1,
          }}
        >
          {previewText}
        </div>

        {error ? (
          <div
            style={{
              background: '#FFE5E5', border: '2px solid #B00020', color: '#B00020',
              borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, marginBottom: 12,
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            onClick={onClose}
            disabled={busy}
            className="chunky"
            style={{ background: 'white', borderRadius: 12, padding: '9px 18px', fontWeight: 700 }}
          >
            never mind
          </button>
          <button
            onClick={submit}
            disabled={busy || isPast}
            className="chunky"
            style={{ background: '#6BCB77', borderRadius: 12, padding: '9px 18px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            {busy ? (
              <>
                <Spinner size="sm" /> proposing…
              </>
            ) : (
              'propose'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
