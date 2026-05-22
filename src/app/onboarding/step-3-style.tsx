'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'

type Props = {
  userId: string
  onComplete: () => void
}

type StyleRow = Database['public']['Tables']['friendship_styles']['Row']

const seekingOptions = [
  { value: 'deep-talks', label: 'Deep conversations' },
  { value: 'activity-buddy', label: 'Activity buddy' },
  { value: 'casual-hangouts', label: 'Casual hangouts' },
  { value: 'creative-collab', label: 'Creative collaboration' },
  { value: 'venting-buddy', label: 'Venting buddy' },
  { value: 'just-fun', label: 'Just having fun' },
]

const frequencyOptions = [
  { value: 'rarely', label: 'rarely', helper: 'once a month or less' },
  { value: 'occasionally', label: 'occasionally', helper: 'a couple times a month' },
  { value: 'regularly', label: 'regularly', helper: 'weekly' },
  { value: 'frequently', label: 'frequently', helper: 'multiple times a week' },
]

export default function Step3Style({ userId, onComplete }: Props) {
  const [energyLevel, setEnergyLevel] = useState<number>(3)
  const [communicationPref, setCommunicationPref] = useState<number>(3)
  const [hangoutFrequency, setHangoutFrequency] = useState('')
  const [seeking, setSeeking] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('friendship_styles')
        .select('*')
        .eq('profile_id', userId)
        .maybeSingle()

      if (!mounted) return
      setLoading(false)

      if (data) {
        setEnergyLevel(data.energy_level ?? 3)
        setCommunicationPref(data.communication_pref ?? 3)
        setHangoutFrequency(data.hangout_frequency ?? '')
        setSeeking(data.seeking ?? [])
      }

      if (error) {
        setError('could not load your friendship preferences')
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [userId])

  const toggleSeeking = (value: string) => {
    setSeeking((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    )
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!hangoutFrequency) {
      setError('choose your hangout frequency')
      return
    }
    if (!seeking.length) {
      setError('pick at least one thing you are seeking')
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const { error: upsertError } = await supabase
        .from('friendship_styles')
        .upsert(
          {
            profile_id: userId,
            energy_level: energyLevel,
            communication_pref: communicationPref,
            hangout_frequency: hangoutFrequency,
            seeking,
          },
          { onConflict: 'profile_id' }
        )

      if (upsertError) {
        setError('could not save your friendship style')
      } else {
        onComplete()
      }
    } catch {
      setError('something went wrong while saving your preferences')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="display text-4xl mb-2" style={{ color: '#1F1A3D' }}>step 3: friendship style</div>
        <p className="text-sm opacity-80" style={{ color: '#1F1A3D' }}>
          tell us how you like to connect so we can match your pace.
        </p>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: '#1F1A3D' }}>loading your preferences…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-[#E7E0D5] bg-[#FBF6EE] p-5">
            <div className="mb-3 font-bold" style={{ color: '#1F1A3D' }}>energy level</div>
            <div className="text-sm mb-3" style={{ color: '#1F1A3D' }}>
              {energyLevel <= 2 ? 'more introvert' : energyLevel >= 4 ? 'more extrovert' : 'balanced energy'}
            </div>
            <input
              type="range"
              min={1}
              max={5}
              value={energyLevel}
              onChange={(event) => setEnergyLevel(Number(event.target.value))}
              className="w-full"
            />
          </div>

          <div className="rounded-2xl border border-[#E7E0D5] bg-[#FBF6EE] p-5">
            <div className="mb-3 font-bold" style={{ color: '#1F1A3D' }}>communication preference</div>
            <div className="text-sm mb-3" style={{ color: '#1F1A3D' }}>prefer async/text → prefer live/voice</div>
            <input
              type="range"
              min={1}
              max={5}
              value={communicationPref}
              onChange={(event) => setCommunicationPref(Number(event.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <div className="font-bold mb-3" style={{ color: '#1F1A3D' }}>hangout frequency</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {frequencyOptions.map((option) => (
                <label key={option.value} className="chunky rounded-[18px] p-4 text-sm text-left block" style={{ background: hangoutFrequency === option.value ? '#6BCB77' : 'white', color: '#1F1A3D' }}>
                  <input
                    type="radio"
                    name="hangout-frequency"
                    value={option.value}
                    checked={hangoutFrequency === option.value}
                    onChange={() => setHangoutFrequency(option.value)}
                    className="mr-2"
                  />
                  <span className="font-bold">{option.label}</span>
                  <div className="mt-1 text-xs opacity-80">{option.helper}</div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="font-bold mb-3" style={{ color: '#1F1A3D' }}>what are you seeking?</div>
            <div className="flex flex-wrap gap-3">
              {seekingOptions.map((option) => {
                const active = seeking.includes(option.value)
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => toggleSeeking(option.value)}
                    className="chunky rounded-full px-4 py-2 text-sm"
                    style={{ background: active ? '#B388EB' : 'white', color: '#1F1A3D' }}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="text-sm p-3 rounded-lg" style={{ background: '#FFE3EE', color: '#1F1A3D' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="chunky w-full py-3 font-bold text-lg"
            style={{ background: '#4D96FF', borderRadius: '14px', color: 'white' }}
          >
            {saving ? 'saving…' : 'save friendship style'}
          </button>
        </form>
      )}
    </div>
  )
}
