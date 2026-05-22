'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'

type Props = {
  userId: string
  onComplete: () => void
}

type Interest = Database['public']['Tables']['interests']['Row']

type ProfileInterestRow = Pick<Database['public']['Tables']['profile_interests']['Row'], 'interest_id' | 'intensity'>

type Selection = Record<string, number>

const intensityLabels = ['curious', 'dabble', 'regular', 'devoted', 'obsessed']
const categoryOrder = ['crafts', 'outdoors', 'food', 'mind', 'movement', 'music', 'screens', 'niche', 'connect']

export default function Step2Interests({ userId, onComplete }: Props) {
  const [interests, setInterests] = useState<Interest[]>([])
  const [selected, setSelected] = useState<Selection>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      const supabase = createClient()
      const interestsResponse = await supabase.from('interests').select('*').eq('is_active', true)
      const selectionResponse = await supabase.from('profile_interests').select('interest_id, intensity').eq('profile_id', userId)

      const interestData = interestsResponse.data
      const interestError = interestsResponse.error
      const selectionData = selectionResponse.data as ProfileInterestRow[] | null
      const selectionError = selectionResponse.error

      if (!mounted) return
      setLoading(false)

      if (interestError || selectionError) {
        setError('could not load interests right now')
        return
      }

      setInterests(interestData ?? [])
      const existing: Selection = {}
      ;(selectionData ?? []).forEach((row) => {
        if (row.interest_id) existing[row.interest_id] = row.intensity
      })
      setSelected(existing)
    }

    load()
    return () => {
      mounted = false
    }
  }, [userId])

  const groupedInterests = useMemo(() => {
    return interests.reduce<Record<string, Interest[]>>((groups, interest) => {
      const category = interest.category || 'other'
      groups[category] = [...(groups[category] ?? []), interest]
      return groups
    }, {})
  }, [interests])

  const selectedCount = Object.keys(selected).length

  const toggleInterest = (interestId: string) => {
    setSelected((prev) => {
      if (prev[interestId]) {
        const next = { ...prev }
        delete next[interestId]
        return next
      }
      return { ...prev, [interestId]: 3 }
    })
  }

  const updateIntensity = (interestId: string, value: number) => {
    setSelected((prev) => ({ ...prev, [interestId]: value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (selectedCount < 3) {
      setError('pick at least 3 interests so we can match you well')
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const { error: deleteError } = await supabase
        .from('profile_interests')
        .delete()
        .eq('profile_id', userId)

      if (deleteError) {
        setError('could not update interests')
        return
      }

      const insertRows = Object.entries(selected).map(([interest_id, intensity]) => ({
        profile_id: userId,
        interest_id,
        intensity,
      }))

      const { error: insertError } = await supabase
        .from('profile_interests')
        .insert(insertRows)

      if (insertError) {
        setError('could not save your interests')
        return
      }

      onComplete()
    } catch {
      setError('something went wrong while saving interests')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="display text-4xl mb-2" style={{ color: '#1F1A3D' }}>step 2: interests</div>
        <p className="text-sm opacity-80" style={{ color: '#1F1A3D' }}>
          tell us what lights you up. choose a few interests and how often they matter.
        </p>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: '#1F1A3D' }}>loading interests…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {categoryOrder.map((category) => {
            const items = groupedInterests[category] ?? []
            if (!items.length) return null
            return (
              <div key={category}>
                <div className="text-sm font-bold mb-3 uppercase tracking-[0.18em]" style={{ color: '#1F1A3D' }}>
                  {category}
                </div>
                <div className="flex flex-wrap gap-3">
                  {items.map((interest) => {
                    const active = Boolean(selected[interest.id])
                    return (
                      <button
                        type="button"
                        key={interest.id}
                        onClick={() => toggleInterest(interest.id)}
                        className="chunky rounded-full px-4 py-2 text-sm"
                        style={{
                          background: active ? '#6BCB77' : 'white',
                          color: '#1F1A3D',
                        }}
                      >
                        {interest.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <div className="rounded-[20px] border border-[#E7E0D5] bg-[#FBF6EE] p-5">
            <div className="text-sm font-bold mb-3" style={{ color: '#1F1A3D' }}>
              selected interests ({selectedCount})
            </div>
            {selectedCount === 0 && (
              <p className="text-sm opacity-80" style={{ color: '#1F1A3D' }}>
                tap some chips to add them here.
              </p>
            )}
            {Object.entries(selected).map(([interestId, intensity]) => {
              const interest = interests.find((item) => item.id === interestId)
              if (!interest) return null
              return (
                <div key={interestId} className="mb-4 rounded-2xl border border-[#DDD4C6] bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-bold" style={{ color: '#1F1A3D' }}>{interest.name}</div>
                    <div className="text-xs uppercase tracking-[0.18em]" style={{ color: '#1F1A3D' }}>
                      {intensityLabels[intensity - 1]}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={intensity}
                    onChange={(event) => updateIntensity(interestId, Number(event.target.value))}
                    className="w-full"
                  />
                </div>
              )
            })}
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
            {saving ? 'saving…' : 'save interests'}
          </button>
        </form>
      )}
    </div>
  )
}
