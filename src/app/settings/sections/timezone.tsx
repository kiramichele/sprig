"use client"

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDebouncedSave } from '@/lib/use-debounced-save'
import SaveStatus from './save-status'

interface Props {
  userId: string
  /** Whatever timezone is currently stored on the profile; null if none yet. */
  initial: string | null
}

/** Best-effort list of IANA zones available in this runtime. Falls back to a
 *  curated common-zone list if the browser doesn't implement
 *  Intl.supportedValuesOf — which is the case in older iOS Safari. */
function getZoneList(): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const intl: any = Intl
  if (typeof intl.supportedValuesOf === 'function') {
    try {
      const all: string[] = intl.supportedValuesOf('timeZone')
      if (Array.isArray(all) && all.length > 0) return all
    } catch {
      /* fall through */
    }
  }
  return [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'America/Honolulu',
    'America/Toronto',
    'America/Vancouver',
    'America/Mexico_City',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Dublin',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Amsterdam',
    'Europe/Madrid',
    'Europe/Rome',
    'Europe/Stockholm',
    'Europe/Warsaw',
    'Europe/Athens',
    'Africa/Cairo',
    'Africa/Johannesburg',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Bangkok',
    'Asia/Singapore',
    'Asia/Hong_Kong',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Australia/Perth',
    'Australia/Sydney',
    'Pacific/Auckland',
    'UTC',
  ]
}

export default function TimezoneSection({ userId, initial }: Props) {
  const browserTz = useMemo(
    () => (typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : null),
    []
  )
  const [tz, setTz] = useState<string>(initial || browserTz || 'America/New_York')

  // Make sure whatever the user picks is in the dropdown options.
  const zones = useMemo(() => {
    const base = getZoneList()
    if (tz && !base.includes(tz)) return [tz, ...base]
    return base
  }, [tz])

  const { status, error } = useDebouncedSave(tz, async (next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase: any = createClient()
    const { error: upsertError } = await supabase
      .from('profiles')
      .update({ timezone: next })
      .eq('id', userId)
    if (upsertError) throw new Error(upsertError.message)
  })

  // Show the offset preview so the user knows what they picked.
  const offsetLabel = useMemo(() => {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'shortOffset',
        hour: '2-digit',
        minute: '2-digit',
      })
      const parts = fmt.formatToParts(new Date())
      const off = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
      const time = parts
        .filter((p) => p.type === 'hour' || p.type === 'minute' || p.type === 'literal' || p.type === 'dayPeriod')
        .map((p) => p.value)
        .join('')
        .trim()
      return `${time}  ${off}`
    } catch {
      return ''
    }
  }, [tz])

  // Friendly nudge: if their stored tz doesn't match their current browser tz
  // (they're traveling? moved?), surface a one-click "use this device's zone".
  const showSuggestion = browserTz && browserTz !== tz
  useEffect(() => {
    // no side-effect; suggestion is purely UI
  }, [showSuggestion])

  return (
    <section className="chunky" style={{ background: 'white', borderRadius: 16, padding: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          gap: 12,
        }}
      >
        <h2 className="display" style={{ fontSize: 24 }}>timezone</h2>
        <SaveStatus status={status} errorMessage={error} />
      </div>

      <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 12, lineHeight: 1.5 }}>
        used to show times in your local zone — especially in pod-matched and
        session-reminder emails.
      </p>

      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
        your zone
      </label>
      <select
        className="field"
        value={tz}
        onChange={(e) => setTz(e.target.value)}
        style={{ minHeight: 44 }}
      >
        {zones.map((z) => (
          <option key={z} value={z}>
            {z.replace(/_/g, ' ')}
          </option>
        ))}
      </select>

      <div style={{ fontSize: 12, opacity: 0.65, marginTop: 8 }}>
        right now there: <strong>{offsetLabel || '—'}</strong>
      </div>

      {showSuggestion ? (
        <button
          type="button"
          onClick={() => browserTz && setTz(browserTz)}
          style={{
            marginTop: 10,
            background: 'transparent',
            border: 'none',
            fontWeight: 700,
            fontSize: 13,
            color: '#FF6B9D',
            textDecoration: 'underline',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          this device is in {browserTz.replace(/_/g, ' ')} — use that instead
        </button>
      ) : null}
    </section>
  )
}
