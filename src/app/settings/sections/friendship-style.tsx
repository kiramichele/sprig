"use client"

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDebouncedSave } from '@/lib/use-debounced-save'
import SaveStatus from './save-status'

const SEEKING_OPTIONS = [
  { value: 'deep-talks', label: 'Deep conversations' },
  { value: 'activity-buddy', label: 'Activity buddy' },
  { value: 'casual-hangouts', label: 'Casual hangouts' },
  { value: 'creative-collab', label: 'Creative collaboration' },
  { value: 'venting-buddy', label: 'Venting buddy' },
  { value: 'just-fun', label: 'Just having fun' },
]

const FREQUENCY_OPTIONS = [
  { value: 'rarely', label: 'rarely' },
  { value: 'occasionally', label: 'occasionally' },
  { value: 'regularly', label: 'regularly' },
  { value: 'frequently', label: 'frequently' },
]

interface InitialStyle {
  energy_level: number | null
  communication_pref: number | null
  hangout_frequency: string | null
  seeking: string[] | null
}

interface Props {
  userId: string
  initial: InitialStyle | null
}

export default function FriendshipStyleSection({ userId, initial }: Props) {
  const [energyLevel, setEnergyLevel] = useState<number>(initial?.energy_level ?? 3)
  const [communicationPref, setCommunicationPref] = useState<number>(
    initial?.communication_pref ?? 3
  )
  const [hangoutFrequency, setHangoutFrequency] = useState<string>(
    initial?.hangout_frequency ?? ''
  )
  const [seeking, setSeeking] = useState<string[]>(initial?.seeking ?? [])

  const valuesKey = useMemo(
    () =>
      JSON.stringify({
        energy_level: energyLevel,
        communication_pref: communicationPref,
        hangout_frequency: hangoutFrequency,
        seeking: [...seeking].sort(),
      }),
    [energyLevel, communicationPref, hangoutFrequency, seeking]
  )

  const { status, error } = useDebouncedSave(valuesKey, async (key) => {
    const v = JSON.parse(key) as InitialStyle & { seeking: string[] }
    const supabase = createClient()
    const { error: upsertError } = await supabase
      .from('friendship_styles')
      .upsert(
        {
          profile_id: userId,
          energy_level: v.energy_level,
          communication_pref: v.communication_pref,
          hangout_frequency: v.hangout_frequency || null,
          seeking: v.seeking,
        },
        { onConflict: 'profile_id' }
      )
    if (upsertError) throw new Error(upsertError.message)
  })

  function toggleSeeking(value: string) {
    setSeeking((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    )
  }

  const energyLabel =
    energyLevel <= 2 ? 'more introvert' : energyLevel >= 4 ? 'more extrovert' : 'balanced'

  return (
    <section className="chunky" style={{ background: 'white', borderRadius: 16, padding: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <h2 className="display" style={{ fontSize: 24 }}>friendship style</h2>
        <SaveStatus status={status} errorMessage={error} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>energy level</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{energyLabel}</div>
        <input
          type="range"
          min={1}
          max={5}
          value={energyLevel}
          onChange={(e) => setEnergyLevel(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>communication preference</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
          prefer async/text → prefer live/voice
        </div>
        <input
          type="range"
          min={1}
          max={5}
          value={communicationPref}
          onChange={(e) => setCommunicationPref(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
          how often do you like to hang out?
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FREQUENCY_OPTIONS.map((opt) => {
            const active = hangoutFrequency === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setHangoutFrequency(opt.value)}
                className="chunky"
                style={{
                  background: active ? '#6BCB77' : 'white',
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>what are you seeking?</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SEEKING_OPTIONS.map((opt) => {
            const active = seeking.includes(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => toggleSeeking(opt.value)}
                className="chunky"
                style={{
                  background: active ? '#B388EB' : 'white',
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
