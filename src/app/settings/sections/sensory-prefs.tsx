"use client"

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDebouncedSave } from '@/lib/use-debounced-save'
import SaveStatus from './save-status'

const TOGGLES = [
  {
    key: 'hide_alcohol_present',
    title: 'hide events with alcohol present',
    helper: 'coffee shops where they happen to serve beer are still shown, but flagged.',
  },
  {
    key: 'hide_alcohol_centered',
    title: 'hide alcohol-centered events',
    helper: 'bar nights, wine tastings, brewery tours.',
  },
  {
    key: 'prefers_quiet',
    title: 'prefer quieter settings',
    helper: "we'll prioritize matches in calmer environments.",
  },
  {
    key: 'needs_low_mobility',
    title: 'need low-mobility-friendly options',
    helper: 'filters to seated, accessible, or short-distance events.',
  },
  {
    key: 'prefers_smaller_groups',
    title: 'prefer smaller groups (3 instead of 5)',
    helper: "we'll try to match you into smaller pods when possible.",
  },
  {
    key: 'prefers_video_off_ok',
    title: 'ok with cameras off',
    helper: "some pod members may keep video off — toggle on if that's fine with you.",
  },
] as const

type ToggleKey = (typeof TOGGLES)[number]['key']

interface InitialSensory {
  hide_alcohol_present: boolean | null
  hide_alcohol_centered: boolean | null
  prefers_quiet: boolean | null
  needs_low_mobility: boolean | null
  prefers_smaller_groups: boolean | null
  prefers_video_off_ok: boolean | null
}

interface Props {
  userId: string
  initial: InitialSensory | null
}

export default function SensoryPrefsSection({ userId, initial }: Props) {
  const [state, setState] = useState<Record<ToggleKey, boolean>>(() => ({
    hide_alcohol_present: initial?.hide_alcohol_present ?? false,
    hide_alcohol_centered: initial?.hide_alcohol_centered ?? false,
    prefers_quiet: initial?.prefers_quiet ?? false,
    needs_low_mobility: initial?.needs_low_mobility ?? false,
    prefers_smaller_groups: initial?.prefers_smaller_groups ?? false,
    prefers_video_off_ok: initial?.prefers_video_off_ok ?? false,
  }))

  const valuesKey = useMemo(() => JSON.stringify(state), [state])

  const { status, error } = useDebouncedSave(valuesKey, async (key) => {
    const v = JSON.parse(key) as Record<ToggleKey, boolean>
    const supabase = createClient()
    const { error: upsertError } = await supabase
      .from('sensory_preferences')
      .upsert({ profile_id: userId, ...v }, { onConflict: 'profile_id' })
    if (upsertError) throw new Error(upsertError.message)
  })

  function toggle(key: ToggleKey) {
    setState((prev) => ({ ...prev, [key]: !prev[key] }))
  }

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
        <h2 className="display" style={{ fontSize: 24 }}>sensory preferences</h2>
        <SaveStatus status={status} errorMessage={error} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TOGGLES.map((t) => (
          <label
            key={t.key}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: 10,
              border: '1.5px solid rgba(0,0,0,0.08)',
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={state[t.key]}
              onChange={() => toggle(t.key)}
              style={{ marginTop: 4 }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t.title}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{t.helper}</div>
            </div>
          </label>
        ))}
      </div>
    </section>
  )
}
