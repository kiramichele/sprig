"use client"

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDebouncedSave } from '@/lib/use-debounced-save'
import SaveStatus from './save-status'

const INTENSITY_LABELS = ['curious', 'dabble', 'regular', 'devoted', 'obsessed']
const CATEGORY_ORDER = [
  'crafts',
  'outdoors',
  'food',
  'mind',
  'movement',
  'music',
  'screens',
  'niche',
  'connect',
]

interface CatalogInterest {
  id: string
  name: string
  emoji: string | null
  category: string
}

interface Selection {
  interest_id: string
  intensity: number
}

interface Props {
  userId: string
  catalog: CatalogInterest[]
  initialSelections: Selection[]
}

export default function InterestsSection({ userId, catalog, initialSelections }: Props) {
  const [selected, setSelected] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const s of initialSelections) map[s.interest_id] = s.intensity
    return map
  })
  const [localError, setLocalError] = useState<string | null>(null)

  // Stable, content-addressed key so the debounced effect only fires on real
  // changes (object refs change every render, so we serialize).
  const selectedKey = useMemo(() => {
    const entries = Object.entries(selected).sort(([a], [b]) => a.localeCompare(b))
    return JSON.stringify(entries)
  }, [selected])

  const { status, error } = useDebouncedSave(selectedKey, async (key) => {
    const entries = JSON.parse(key) as Array<[string, number]>
    // Replacement save: clear and reinsert (the 3-and-up rule is enforced in
    // toggleInterest so we never reach here with fewer than 3).
    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('profile_interests')
      .delete()
      .eq('profile_id', userId)
    if (deleteError) throw new Error(deleteError.message)
    if (entries.length) {
      const rows = entries.map(([interest_id, intensity]) => ({
        profile_id: userId,
        interest_id,
        intensity,
      }))
      const { error: insertError } = await supabase.from('profile_interests').insert(rows)
      if (insertError) throw new Error(insertError.message)
    }
  })

  function toggleInterest(id: string) {
    setSelected((prev) => {
      if (prev[id]) {
        // Removing — guard the 3-minimum rule and surface inline error.
        if (Object.keys(prev).length <= 3) {
          setLocalError('keep at least 3 interests so we can match you well.')
          return prev
        }
        setLocalError(null)
        const next = { ...prev }
        delete next[id]
        return next
      }
      setLocalError(null)
      return { ...prev, [id]: 3 }
    })
  }

  function updateIntensity(id: string, value: number) {
    setSelected((prev) => ({ ...prev, [id]: value }))
  }

  const grouped = useMemo(() => {
    const m: Record<string, CatalogInterest[]> = {}
    for (const it of catalog) {
      const cat = it.category || 'other'
      ;(m[cat] = m[cat] || []).push(it)
    }
    return m
  }, [catalog])

  const interestsById = useMemo(() => {
    const m: Record<string, CatalogInterest> = {}
    for (const it of catalog) m[it.id] = it
    return m
  }, [catalog])

  const selectedCount = Object.keys(selected).length

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
        <h2 className="display" style={{ fontSize: 24 }}>interests</h2>
        <SaveStatus status={status} errorMessage={error} />
      </div>

      {localError ? (
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#B00020',
            background: '#FFE3EE',
            borderRadius: 8,
            padding: '6px 10px',
            marginBottom: 10,
          }}
        >
          {localError}
        </div>
      ) : null}

      {/* selected interests */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
          your interests ({selectedCount})
        </div>
        {selectedCount === 0 ? (
          <p style={{ opacity: 0.7, fontSize: 14 }}>tap an interest below to add it.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(selected).map(([id, intensity]) => {
              const it = interestsById[id]
              if (!it) return null
              return (
                <div
                  key={id}
                  style={{ border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: 12 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{it.emoji || '🌱'}</span>
                      <span style={{ fontWeight: 700 }}>{it.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, letterSpacing: '0.16em', opacity: 0.6 }}>
                        {INTENSITY_LABELS[intensity - 1]}
                      </span>
                      <button
                        onClick={() => toggleInterest(id)}
                        aria-label="remove"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          fontSize: 20,
                          cursor: 'pointer',
                          color: '#1F1A3D',
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={intensity}
                    onChange={(e) => updateIntensity(id, Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* browse and add */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>browse and add</div>
        {CATEGORY_ORDER.map((category) => {
          const items = grouped[category]
          if (!items || items.length === 0) return null
          return (
            <div key={category} style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.16em',
                  opacity: 0.55,
                  marginBottom: 6,
                }}
              >
                {category}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {items.map((it) => {
                  const active = Boolean(selected[it.id])
                  return (
                    <button
                      key={it.id}
                      onClick={() => toggleInterest(it.id)}
                      className="chunky"
                      style={{
                        background: active ? '#6BCB77' : 'white',
                        borderRadius: 999,
                        padding: '6px 12px',
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#1F1A3D',
                      }}
                    >
                      {it.emoji ? `${it.emoji} ` : ''}
                      {it.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
