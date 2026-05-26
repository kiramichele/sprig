'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Spinner from '@/components/spinner'
import {
  DAYS,
  DAY_LABEL,
  DEFAULT_SLOTS,
  WINDOWS,
  WINDOW_LABEL,
  type SlotToken,
} from '@/lib/availability/slots'

type Props = {
  userId: string
  onComplete: () => void
}

export default function StepAvailability({ userId, onComplete }: Props) {
  const [selected, setSelected] = useState<Set<SlotToken>>(new Set<SlotToken>())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hydrate from existing profile (the wizard can land here mid-stream if the
  // user already partially completed onboarding).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase: any = createClient()
        const { data } = await supabase
          .from('profiles')
          .select('availability_slots')
          .eq('id', userId)
          .maybeSingle()
        if (cancelled) return
        const existing = (data?.availability_slots as SlotToken[] | null) ?? null
        // Default to a reasonable starter pick (weekend evenings) only if the
        // user hasn't set anything yet, so we don't blow away an empty
        // intentional clear.
        if (existing && existing.length > 0) {
          setSelected(new Set(existing))
        } else {
          setSelected(new Set(DEFAULT_SLOTS))
        }
      } catch (err) {
        if (!cancelled) console.error('availability: hydrate failed —', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  function toggle(token: SlotToken) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(token)) next.delete(token)
      else next.add(token)
      return next
    })
  }

  async function save() {
    setError(null)
    if (selected.size === 0) {
      setError('pick at least one window so we can schedule your first call.')
      return
    }
    setSaving(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase: any = createClient()
      const tokens = [...selected]
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ availability_slots: tokens })
        .eq('id', userId)
      if (updateError) throw new Error(updateError.message)
      onComplete()
    } catch (err) {
      console.error('availability: save failed —', err)
      setError("couldn't save your availability — try again?")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="display text-2xl sm:text-4xl mb-2" style={{ color: '#1F1A3D' }}>step 5: availability</div>
      <p className="text-sm opacity-80 mb-5" style={{ color: '#1F1A3D' }}>
        when are you usually free? we&apos;ll use this to schedule your first
        pod call at a time everyone can make. all times are in your local
        zone.
      </p>

      {loading ? (
        <p className="text-sm opacity-70">loading…</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 6 }}>
              <thead>
                <tr>
                  <th />
                  {WINDOWS.map((w) => (
                    <th
                      key={w}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        opacity: 0.6,
                        textAlign: 'center',
                        padding: '4px 0',
                        color: '#1F1A3D',
                      }}
                    >
                      {WINDOW_LABEL[w]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d) => (
                  <tr key={d}>
                    <th
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        opacity: 0.7,
                        padding: '0 8px 0 0',
                        textAlign: 'right',
                        width: 50,
                        color: '#1F1A3D',
                      }}
                    >
                      {DAY_LABEL[d]}
                    </th>
                    {WINDOWS.map((w) => {
                      const token = `${d}_${w}` as SlotToken
                      const on = selected.has(token)
                      return (
                        <td key={token} style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => toggle(token)}
                            aria-pressed={on}
                            aria-label={`${DAY_LABEL[d]} ${WINDOW_LABEL[w]}`}
                            style={{
                              width: '100%',
                              minHeight: 38,
                              background: on ? '#6BCB77' : 'white',
                              border: '2px solid #1F1A3D',
                              borderRadius: 10,
                              fontWeight: 700,
                              fontSize: 18,
                              color: '#1F1A3D',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              boxShadow: on ? '2px 2px 0 0 #1F1A3D' : 'none',
                              transition: 'all .1s ease',
                            }}
                          >
                            {on ? '✓' : ''}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs opacity-65 mt-3" style={{ color: '#1F1A3D' }}>
            morning 9am–12pm · afternoon 12–5pm · evening 5–10pm
          </p>

          {error ? (
            <div className="text-sm p-3 rounded-lg mt-3" style={{ background: '#FFE3EE', color: '#1F1A3D' }}>
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="chunky w-full py-3 font-bold text-lg mt-4"
            style={{ background: '#4D96FF', borderRadius: 14, color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            {saving ? (
              <>
                <Spinner size="sm" color="#FFFFFF" /> saving…
              </>
            ) : (
              'save availability'
            )}
          </button>
        </>
      )}
    </div>
  )
}
