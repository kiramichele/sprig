"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  availabilityId: string
  onUpdated?: () => void
}

export default function WidenNetCard({ availabilityId, onUpdated }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function respond(accept: boolean) {
    if (busy) return
    setBusy(accept ? 'accept' : 'decline')
    setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase: any = createClient()
      const patch = accept
        ? { widened: true, widen_offered_at: new Date().toISOString() }
        : { widen_declined: true, widen_offered_at: new Date().toISOString() }
      const { error: updateError } = await supabase
        .from('matching_availability')
        .update(patch)
        .eq('id', availabilityId)
      if (updateError) throw updateError
      onUpdated?.()
      router.refresh()
    } catch (err) {
      console.error('widen-net: update failed —', err)
      setError('could not update — try again')
      setBusy(null)
    }
  }

  return (
    <div
      className="chunky"
      style={{
        background: '#FFF1C2',
        borderRadius: 16,
        padding: 20,
        marginBottom: 18,
        transform: 'rotate(-0.6deg)',
      }}
    >
      <div className="display" style={{ fontSize: 24, marginBottom: 6 }}>
        still looking 🌱
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.5, marginBottom: 10 }}>
        we&apos;re having a little trouble finding the right pod for you. want
        to widen the net a bit?
      </p>
      <ul
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          paddingLeft: 22,
          listStyle: 'disc',
          marginBottom: 12,
        }}
      >
        <li>look beyond your top interests</li>
        <li>try slightly larger or smaller group sizes</li>
        <li>relax the friendship-style strictness</li>
      </ul>
      <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 14 }}>
        none of this changes your profile — just how we search this cycle.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => respond(true)}
          disabled={busy !== null}
          className="chunky"
          style={{
            background: '#6BCB77',
            borderRadius: 12,
            padding: '9px 16px',
            fontWeight: 700,
          }}
        >
          {busy === 'accept' ? 'widening…' : 'yes, widen it'}
        </button>
        <button
          onClick={() => respond(false)}
          disabled={busy !== null}
          className="chunky"
          style={{
            background: 'white',
            borderRadius: 12,
            padding: '9px 16px',
            fontWeight: 700,
          }}
        >
          {busy === 'decline' ? 'saving…' : 'no thanks, keep looking'}
        </button>
      </div>
      {error ? (
        <div style={{ fontSize: 13, color: '#B00020', fontWeight: 700, marginTop: 10 }}>
          {error}
        </div>
      ) : null}
    </div>
  )
}
