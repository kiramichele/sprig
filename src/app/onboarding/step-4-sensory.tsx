'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Spinner from '@/components/spinner'
import type { Database } from '@/lib/supabase/database.types'

type Props = {
  userId: string
  onComplete: () => void
}

type SensoryRow = Database['public']['Tables']['sensory_preferences']['Row']

const options = [
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
    helper: 'we\'ll prioritize matches in calmer environments.',
  },
  {
    key: 'needs_low_mobility',
    title: 'need low-mobility-friendly options',
    helper: 'filters to seated, accessible, or short-distance events.',
  },
  {
    key: 'prefers_smaller_groups',
    title: 'prefer smaller groups (3 instead of 5)',
    helper: 'we\'ll try to match you into smaller pods when possible.',
  },
  {
    key: 'prefers_video_off_ok',
    title: 'ok with cameras off',
    helper: 'some pod members may keep video off — toggle on if that\'s fine with you.',
  },
] as const

export default function Step4Sensory({ userId, onComplete }: Props) {
  const [settings, setSettings] = useState<Record<string, boolean>>({
    hide_alcohol_present: false,
    hide_alcohol_centered: false,
    prefers_quiet: false,
    needs_low_mobility: false,
    prefers_smaller_groups: false,
    prefers_video_off_ok: false,
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('sensory_preferences')
        .select('*')
        .eq('profile_id', userId)
        .maybeSingle()

      if (!mounted) return
      setLoading(false)

      if (error) {
        setError('could not load your sensory settings')
        return
      }

      if (data) {
        setSettings({
          hide_alcohol_present: data.hide_alcohol_present ?? false,
          hide_alcohol_centered: data.hide_alcohol_centered ?? false,
          prefers_quiet: data.prefers_quiet ?? false,
          needs_low_mobility: data.needs_low_mobility ?? false,
          prefers_smaller_groups: data.prefers_smaller_groups ?? false,
          prefers_video_off_ok: data.prefers_video_off_ok ?? false,
        })
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [userId])

  const handleToggle = (key: string) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: upsertError } = await supabase
        .from('sensory_preferences')
        .upsert(
          {
            profile_id: userId,
            hide_alcohol_present: settings.hide_alcohol_present,
            hide_alcohol_centered: settings.hide_alcohol_centered,
            prefers_quiet: settings.prefers_quiet,
            needs_low_mobility: settings.needs_low_mobility,
            prefers_smaller_groups: settings.prefers_smaller_groups,
            prefers_video_off_ok: settings.prefers_video_off_ok,
          },
          { onConflict: 'profile_id' }
        )

      if (upsertError) {
        setError('could not save your preferences')
      } else {
        onComplete()
      }
    } catch {
      setError('something went wrong while saving')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('sensory_preferences')
        .upsert({ profile_id: userId }, { onConflict: 'profile_id' })

      if (error) {
        setError('could not save your preferences')
      } else {
        onComplete()
      }
    } catch {
      setError('something went wrong while skipping this step')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="display text-2xl sm:text-4xl mb-2" style={{ color: '#1F1A3D' }}>step 4: sensory & accessibility</div>
        <p className="text-sm opacity-80" style={{ color: '#1F1A3D' }}>
          pick the comfort settings that help you feel safe and seen in pods.
        </p>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: '#1F1A3D' }}>loading settings…</p>
      ) : (
        <div className="space-y-4">
          {options.map((option) => (
            <label key={option.key} className="block rounded-2xl border border-[#DDD4C6] bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold" style={{ color: '#1F1A3D' }}>{option.title}</span>
                <input
                  type="checkbox"
                  checked={settings[option.key]}
                  onChange={() => handleToggle(option.key)}
                />
              </div>
              <p className="text-sm opacity-80" style={{ color: '#1F1A3D' }}>{option.helper}</p>
            </label>
          ))}

          {error && (
            <div className="text-sm p-3 rounded-lg" style={{ background: '#FFE3EE', color: '#1F1A3D' }}>
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleSkip}
              disabled={saving}
              className="chunky w-full py-3 font-bold text-lg"
              style={{ background: 'white', borderRadius: '14px', color: '#1F1A3D' }}
            >
              {saving ? 'saving…' : 'skip this step'}
            </button>
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving}
              className="chunky w-full py-3 font-bold text-lg"
              style={{ background: '#4D96FF', borderRadius: '14px', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            >
              {saving ? (
                <>
                  <Spinner size="sm" color="#FFFFFF" /> saving…
                </>
              ) : (
                'save preferences'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
