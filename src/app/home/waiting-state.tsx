"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import WidenNetCard from './widen-net-card'

export default function WaitingState({ profile, availability, showWidenOffer, onJoin }: any) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const signal = (availability && availability[0]) || null

  async function handleCancel() {
    if (!signal) return
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const query = supabase.from('matching_availability').update({ status: 'canceled' })

      if (signal.id) {
        query.eq('id', signal.id)
      } else {
        query.eq('profile_id', profile?.id).eq('status', 'open')
      }

      const { error: cancelError } = await query
      if (cancelError) {
        setError('Could not cancel matching right now. Please try again.')
      } else {
        router.refresh()
      }
    } catch (err) {
      setError('Could not cancel matching right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h1 className="display text-3xl sm:text-4xl mb-3">we&apos;re looking for your pod 🔎</h1>
      <p className="mb-4 text-sm sm:text-base">we&apos;re matching you with 2-4 other people around your interests. this can take anywhere from a few hours to a few days depending on who&apos;s available.</p>

      {showWidenOffer && signal?.id ? (
        <WidenNetCard availabilityId={signal.id} />
      ) : null}

      {signal ? (
        <div className="px-4 py-4 text-sm sm:text-base space-y-1" style={{ borderRadius: 12, background: 'white', border: '1px solid rgba(0,0,0,0.04)' }}>
          <div>you&apos;re available until <strong suppressHydrationWarning>{new Date(signal.available_until).toLocaleString()}</strong></div>
          <div>matching on <strong>{(signal.preferred_interests && Array.isArray(signal.preferred_interests) && signal.preferred_interests.length) ? 'selected interests' : 'all your interests'}</strong></div>
          <div>preferred group size: <strong>{String(signal.preferred_pod_size || 4)}</strong></div>
          <div className="mt-3">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="w-full sm:w-auto px-4 font-bold"
              style={{ background: 'white', border: '2.5px solid #1F1A3D', boxShadow: '4px 4px 0 0 #1F1A3D', borderRadius: 12, minHeight: 44 }}
            >
              {loading ? 'canceling…' : 'cancel matching'}
            </button>
          </div>
          {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
        </div>
      ) : null}

      <div className="mt-6">
        <h4>while you wait</h4>
        <ul className="list-disc ml-6 text-sm">
          <li>upload a profile photo</li>
          <li>add or tidy your interests</li>
          <li>invite a friend</li>
        </ul>
        {signal?.widened ? (
          <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, opacity: 0.8 }}>
            🌐 we&apos;ve widened your match search for this cycle.
          </div>
        ) : null}
      </div>
    </section>
  )
}
