'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'
import Spinner from '@/components/spinner'

type Props = {
  userId: string
  onComplete: () => void
}

type ProfileRow = Database['public']['Tables']['profiles']['Row']

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/
const currentYear = new Date().getFullYear()

export default function Step1Basics({ userId, onComplete }: Props) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [city, setCity] = useState('Wilmington, NC')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    if (!username || !USERNAME_REGEX.test(username)) {
      setIsAvailable(null)
      return
    }

    setIsChecking(true)
    const timer = window.setTimeout(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()

      if (!mounted) return
      setIsChecking(false)

      if (error) {
        setError('could not check username availability')
        setIsAvailable(null)
        return
      }

      if (data && data.id !== userId) {
        setIsAvailable(false)
      } else {
        setIsAvailable(true)
      }
    }, 500)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [username, userId])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('username, display_name, birth_year, city')
        .eq('id', userId)
        .maybeSingle()

      if (!mounted || error || !data) return
      setUsername(data.username ?? '')
      setDisplayName(data.display_name ?? '')
      setBirthYear(data.birth_year ? String(data.birth_year) : '')
      setCity(data.city ?? 'Wilmington, NC')
    }

    load()
    return () => {
      mounted = false
    }
  }, [userId])

  const clearMessages = () => {
    setError(null)
    setSuccess(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    clearMessages()

    if (!USERNAME_REGEX.test(username)) {
      setError('username must be 3-20 lowercase letters, numbers, or underscore')
      return
    }

    const age = Number(birthYear) ? currentYear - Number(birthYear) : 0
    if (!displayName.trim() || displayName.length > 40) {
      setError('display name must be between 1 and 40 characters')
      return
    }

    if (!birthYear || age < 18) {
      setError('you must be at least 18 years old')
      return
    }

    if (!city.trim()) {
      setError('city is required')
      return
    }

    if (isAvailable === false) {
      setError('username is already taken')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            username,
            display_name: displayName,
            birth_year: Number(birthYear),
            city,
          },
          { onConflict: 'id' }
        )

      if (upsertError) {
        setError('could not save your basics. please try again.')
      } else {
        setSuccess('saved! moving to the next step...')
        onComplete()
      }
    } catch {
      setError('something went wrong while saving your profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="display text-4xl mb-2" style={{ color: '#1F1A3D' }}>step 1: basics</div>
        <p className="text-sm opacity-80" style={{ color: '#1F1A3D' }}>
          build a friendly profile name so people can recognize you in pods.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-bold mb-1.5" style={{ color: '#1F1A3D' }}>username</label>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            className="field"
            placeholder="your-handle"
            maxLength={20}
            autoComplete="username"
          />
          <div className="mt-2 text-xs" style={{ color: '#1F1A3D' }}>
            {isChecking && 'checking availability…'}
            {isAvailable === true && !isChecking && '✓ available'}
            {isAvailable === false && !isChecking && '✗ taken'}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold mb-1.5" style={{ color: '#1F1A3D' }}>display name</label>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="field"
            placeholder="maya"
            maxLength={40}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-bold mb-1.5" style={{ color: '#1F1A3D' }}>birth year</label>
            <input
              value={birthYear}
              onChange={(event) => setBirthYear(event.target.value.replace(/[^0-9]/g, ''))}
              className="field"
              placeholder="1996"
              inputMode="numeric"
              maxLength={4}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-bold mb-1.5" style={{ color: '#1F1A3D' }}>city</label>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="field"
              placeholder="Wilmington, NC"
            />
          </div>
        </div>

        {error && (
          <div className="text-sm p-3 rounded-lg" style={{ background: '#FFE3EE', color: '#1F1A3D' }}>
            {error}
          </div>
        )}
        {success && (
          <div className="text-sm p-3 rounded-lg" style={{ background: '#E4F8E6', color: '#1F1A3D' }}>
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="chunky w-full py-3 font-bold text-lg"
          style={{ background: '#FFD23F', borderRadius: '14px', color: '#1F1A3D', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          {loading ? (
            <>
              <Spinner size="sm" /> saving…
            </>
          ) : (
            'save basics'
          )}
        </button>
      </form>
    </div>
  )
}
