"use client"

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDebouncedSave } from '@/lib/use-debounced-save'
import SaveStatus from './save-status'
import { DAYS, DAY_LABEL, WINDOWS, WINDOW_LABEL, type SlotToken } from '@/lib/availability/slots'

interface Props {
  userId: string
  initial: SlotToken[] | null
}

export default function AvailabilitySection({ userId, initial }: Props) {
  const [selected, setSelected] = useState<Set<SlotToken>>(
    () => new Set<SlotToken>(initial ?? [])
  )

  // useDebouncedSave wants a string key. Sort so functionally-equivalent sets
  // produce the same key (avoids redundant saves).
  const valuesKey = useMemo(
    () => [...selected].sort().join(','),
    [selected]
  )

  const { status, error } = useDebouncedSave(valuesKey, async (key) => {
    const tokens = key ? (key.split(',') as SlotToken[]) : []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase: any = createClient()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ availability_slots: tokens })
      .eq('id', userId)
    if (updateError) throw new Error(updateError.message)
  })

  function toggle(token: SlotToken) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(token)) next.delete(token)
      else next.add(token)
      return next
    })
  }

  const count = selected.size

  return (
    <section className="chunky" style={{ background: 'white', borderRadius: 16, padding: 20 }}>
      <div
        className="flex items-center justify-between gap-3 mb-2"
      >
        <h2 className="display" style={{ fontSize: 24 }}>availability</h2>
        <SaveStatus status={status} errorMessage={error} />
      </div>
      <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 12, lineHeight: 1.5 }}>
        when are you usually free? we&apos;ll use this to schedule your first
        pod call at a time everyone can make.
      </p>

      {/* Planner-style layout: days across the top, time-of-day rows down
          the side — what people expect from a calendar/availability grid. */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 6 }}>
          <thead>
            <tr>
              <th />
              {DAYS.map((d) => (
                <th
                  key={d}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    opacity: 0.6,
                    textAlign: 'center',
                    padding: '4px 0',
                  }}
                >
                  {DAY_LABEL[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WINDOWS.map((w) => (
              <tr key={w}>
                <th
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    opacity: 0.7,
                    padding: '0 8px 0 0',
                    textAlign: 'right',
                    width: 78,
                  }}
                >
                  {WINDOW_LABEL[w]}
                </th>
                {DAYS.map((d) => {
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

      <p style={{ fontSize: 12, opacity: 0.65, marginTop: 10 }}>
        morning 9am–12pm · afternoon 12–5pm · evening 5–10pm (in your local
        time).{' '}
        {count === 0 ? (
          <span style={{ color: '#B00020', fontWeight: 700 }}>
            pick at least one window — otherwise we&apos;ll default to weekend
            evenings.
          </span>
        ) : (
          <span style={{ opacity: 0.8 }}>{count} window{count === 1 ? '' : 's'} picked.</span>
        )}
      </p>
    </section>
  )
}
