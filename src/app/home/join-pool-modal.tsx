"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function JoinPoolModal({ open, onClose, profile }: any) {
  const [duration, setDuration] = useState(14)
  const [size, setSize] = useState(4)
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [interests, setInterests] = useState<any[]>([])

  useEffect(() => {
    async function loadInterests() {
      try {
        const supabase = createClient()
        const { data } = await supabase.from('interests').select('*').in('id', (profile?.interest_ids || []))
        setInterests(data || [])
        setSelectedInterests((data || []).map((i: any) => i.id))
      } catch (err) {
        // ignore
      }
    }

    if (open) loadInterests()
  }, [open, profile])

  async function handleSubmit(e: any) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const now = new Date()
      const until = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000)
      const payload = {
        profile_id: profile.id,
        available_from: now.toISOString(),
        available_until: until.toISOString(),
        preferred_interests: selectedInterests,
        preferred_pod_size: size,
        status: 'open',
      }

      const { error } = await supabase.from('matching_availability').insert([payload])
      if (error) throw error
      onClose()
      window.location.reload()
    } catch (err: any) {
      setError(err?.message || 'failed to join pool')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <form onSubmit={handleSubmit} style={{ background: 'white', padding: 24, borderRadius: 12, width: 520 }}>
        <h3 className="text-xl mb-2">join the pool</h3>

        <div className="mb-3">
          <label className="block mb-1">availability window</label>
          <div>
            <label><input type="radio" name="dur" checked={duration===7} onChange={() => setDuration(7)} /> next 7 days</label>
            <label className="ml-4"><input type="radio" name="dur" checked={duration===14} onChange={() => setDuration(14)} /> next 14 days</label>
            <label className="ml-4"><input type="radio" name="dur" checked={duration===30} onChange={() => setDuration(30)} /> next 30 days</label>
          </div>
        </div>

        <div className="mb-3">
          <label className="block mb-1">preferred group size</label>
          <label><input type="radio" checked={size===3} onChange={() => setSize(3)} /> 3</label>
          <label className="ml-4"><input type="radio" checked={size===4} onChange={() => setSize(4)} /> 4</label>
          <label className="ml-4"><input type="radio" checked={size===5} onChange={() => setSize(5)} /> 5</label>
        </div>

        <div className="mb-3">
          <label className="block mb-1">match me on which interests?</label>
          <div className="flex flex-wrap gap-2">
            {interests.length ? interests.map(i => (
              <button type="button" key={i.id} onClick={() => {
                setSelectedInterests(prev => prev.includes(i.id) ? prev.filter(x=>x!==i.id) : [...prev, i.id])
              }} className="px-3 py-1" style={{ border: selectedInterests.includes(i.id) ? '2px solid #1F1A3D' : '1px solid #ccc', borderRadius: 999 }}>{i.name}</button>
            )) : <div className="text-sm opacity-70">no interests found — we'll match across your profile</div>}
          </div>
        </div>

        {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

        <div className="flex items-center justify-between">
          <button type="button" onClick={onClose} className="px-4 py-2">cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 font-bold" style={{ background: 'white', border: '2.5px solid #1F1A3D', boxShadow: '4px 4px 0 0 #1F1A3D', borderRadius: 12 }}>{loading ? 'joining...' : 'join the pool'}</button>
        </div>
      </form>
    </div>
  )
}
