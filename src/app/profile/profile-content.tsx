'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import TopNav from '@/components/top-nav'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type Interest = Database['public']['Tables']['interests']['Row']

type Props = {
  profile: Profile
  interests: Interest[]
  selectedIds: string[]
}

const categoryOrder = ['crafts', 'outdoors', 'food', 'mind', 'movement', 'music', 'screens', 'niche', 'connect']

export default function ProfileContent({ profile, interests, selectedIds }: Props) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(profile.display_name || '')
  const [city, setCity] = useState(profile.city || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [photoUrl, setPhotoUrl] = useState(profile.photo_url || '')
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    selectedIds.reduce((acc, id) => ({ ...acc, [id]: true }), {})
  )
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(null), 4000)
    return () => window.clearTimeout(timer)
  }, [message])

  const groupedInterests = useMemo(() => {
    return interests.reduce<Record<string, Interest[]>>((groups, interest) => {
      const category = interest.category || 'other'
      groups[category] = [...(groups[category] ?? []), interest]
      return groups
    }, {})
  }, [interests])

  const selectedCount = Object.values(selected).filter(Boolean).length

  const toggleInterest = (interestId: string) => {
    setSelected((prev) => ({ ...prev, [interestId]: !prev[interestId] }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (selectedCount < 3) {
      setError('pick at least 3 interests so we can match you well')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ display_name: displayName, city, bio, photo_url: photoUrl })
        .eq('id', profile.id)

      if (profileError) {
        setError('could not save your profile info right now')
        return
      }

      const { error: deleteError } = await supabase.from('profile_interests').delete().eq('profile_id', profile.id)
      if (deleteError) {
        setError('could not save your interests right now')
        return
      }

      const insertRows = Object.entries(selected)
        .filter(([, value]) => value)
        .map(([interest_id]) => ({ profile_id: profile.id, interest_id, intensity: 3 }))

      if (insertRows.length) {
        const { error: insertError } = await supabase.from('profile_interests').insert(insertRows)
        if (insertError) {
          setError('could not save your interests right now')
          return
        }
      }

      setMessage('profile updated successfully')
    } catch (err) {
      setError('something went wrong while saving your profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <TopNav profile={profile} />
      <style>{`
        .field { border: 2.5px solid #1F1A3D; background: white; border-radius: 12px; padding: 12px 16px; font-size: 16px; width: 100%; outline: none; }
        .field:focus { box-shadow: 4px 4px 0 0 #1F1A3D; }
        .chunky { border: 2.5px solid #1F1A3D; box-shadow: 4px 4px 0 0 #1F1A3D; transition: all 0.12s ease; }
        .chunky:hover { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 0 #1F1A3D; }
        .chunky:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 0 #1F1A3D; }
      `}</style>

      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-10">
          <div className="display text-5xl mb-2">your profile</div>
          <p className="text-sm opacity-80">update your bio, city, photo, and interests anytime.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
            <label className="block">
              <div className="text-sm font-bold mb-2">display name</div>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="field"
                required
              />
            </label>
            <label className="block">
              <div className="text-sm font-bold mb-2">city</div>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="field"
              />
            </label>
          </div>

          <label className="block">
            <div className="text-sm font-bold mb-2">bio</div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              className="field"
              placeholder="tell people what kind of conversation you’re here for"
            />
          </label>

          <label className="block">
            <div className="text-sm font-bold mb-2">photo URL</div>
            <input
              value={photoUrl || ''}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="field"
              placeholder="https://..."
            />
          </label>

          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-bold text-lg">interests</div>
                <p className="text-sm opacity-70">pick at least 3 interests so we can keep your matches fresh.</p>
              </div>
              <div className="text-sm opacity-70">selected {selectedCount}</div>
            </div>

            <div className="space-y-6">
              {categoryOrder.map((category) => {
                const items = groupedInterests[category] || []
                if (!items.length) return null
                return (
                  <div key={category}>
                    <div className="text-sm font-bold uppercase tracking-[0.18em] mb-3" style={{ color: '#1F1A3D' }}>{category}</div>
                    <div className="flex flex-wrap gap-3">
                      {items.map((interest) => {
                        const active = Boolean(selected[interest.id])
                        return (
                          <button
                            key={interest.id}
                            type="button"
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
            </div>
          </section>

          {error && (
            <div className="text-sm p-3 rounded-lg" style={{ background: '#FFE3EE', color: '#1F1A3D' }}>
              {error}
            </div>
          )}

          {message && (
            <div className="text-sm p-3 rounded-lg" style={{ background: '#E6FFED', color: '#1F1A3D' }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="chunky w-full py-3 font-bold text-lg"
            style={{ background: '#FFD23F', borderRadius: '14px', color: '#1F1A3D' }}
          >
            {loading ? 'saving...' : 'save profile'}
          </button>
        </form>
      </div>
    </div>
  )
}
