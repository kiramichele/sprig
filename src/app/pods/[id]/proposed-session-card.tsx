"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/scheduling/errors'
import type {
  ProposedSession,
  RsvpResponse,
  SchedulingProfile,
} from '@/lib/scheduling/types'

interface PodMember {
  profile_id: string
  profile: SchedulingProfile | null
}

interface Props {
  session: ProposedSession
  currentUserId: string
  podMembers: PodMember[]
}

const AVATAR_COLORS = ['#FFD23F', '#6BCB77', '#4D96FF', '#FF6B6B', '#C780E8']
function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function Avatar({ profile, size = 28 }: { profile: SchedulingProfile | null; size?: number }) {
  const seed = profile?.id || profile?.display_name || '?'
  const color = AVATAR_COLORS[hash(seed) % AVATAR_COLORS.length]
  const initial = (profile?.display_name || '?').slice(0, 1).toUpperCase()
  if (profile?.photo_url) {
    return (
      <img
        src={profile.photo_url}
        alt={profile.display_name || 'member'}
        style={{
          width: size, height: size, borderRadius: 9999, objectFit: 'cover',
          border: '2px solid #1F1A3D', flexShrink: 0,
        }}
      />
    )
  }
  return (
    <span
      style={{
        width: size, height: size, borderRadius: 9999, background: color,
        border: '2px solid #1F1A3D', display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', fontWeight: 700, fontSize: size * 0.42, flexShrink: 0,
      }}
    >
      {initial}
    </span>
  )
}

const LONG_DATE = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
function formatLong(iso: string): string {
  return LONG_DATE.format(new Date(iso)).replace(/(\d+), (\d+:)/, '$1 at $2')
}
function formatShortDeadline(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso))
}

const RESPONSE_GLYPH: Record<RsvpResponse | 'awaiting', { glyph: string; label: string; tone: string }> = {
  yes: { glyph: '✓', label: 'yes', tone: '#6BCB77' },
  no: { glyph: '✗', label: 'no', tone: '#FF6B6B' },
  maybe: { glyph: '?', label: 'maybe', tone: '#FFD23F' },
  awaiting: { glyph: '○', label: 'awaiting', tone: 'rgba(31,26,61,0.25)' },
}

function friendlyError(raw: string): string {
  if (/no longer accepting rsvps/i.test(raw)) {
    return 'looks like this proposal was already decided. refreshing…'
  }
  if (/not a pod member/i.test(raw)) {
    return 'something went wrong — refresh and try again.'
  }
  return raw || 'could not rsvp — try again.'
}

export default function ProposedSessionCard({ session, currentUserId, podMembers }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Realtime: when anyone rsvps to this session, or the session itself flips
  // status (e.g. promoted to 'scheduled'), refresh the server data.
  useEffect(() => {
    const supabase = createClient()
    const rsvpsChannel = supabase
      .channel(`session-rsvps-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_rsvps',
          filter: `session_id=eq.${session.id}`,
        },
        () => router.refresh()
      )
      .subscribe()
    const sessionChannel = supabase
      .channel(`pod-session-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pod_sessions',
          filter: `id=eq.${session.id}`,
        },
        () => router.refresh()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(rsvpsChannel)
      supabase.removeChannel(sessionChannel)
    }
  }, [session.id, router])

  // Auto-clear the celebration toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  const rsvpByProfile = new Map(session.rsvps.map((r) => [r.profile_id, r]))
  const myRsvp = rsvpByProfile.get(currentUserId) || null
  const yesCount = session.rsvps.filter((r) => r.response === 'yes').length
  const noCount = session.rsvps.filter((r) => r.response === 'no').length
  const totalMembers = podMembers.length || session.rsvps.length
  const awaitingCount = Math.max(0, totalMembers - session.rsvps.length)

  let statusLine: string
  if (noCount > 0) {
    statusLine = `${noCount} said no — discussing in chat?`
  } else if (awaitingCount > 0) {
    statusLine = `waiting on ${awaitingCount} ${awaitingCount === 1 ? 'response' : 'responses'}`
  } else {
    statusLine = `${yesCount}/${totalMembers} said yes — confirming when everyone responds`
  }

  async function rsvp(response: RsvpResponse) {
    if (busy) return
    console.log('[rsvp] click — session=', session.id, 'response=', response)
    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = supabase
      const { data, error: rpcError } = await sb.rpc('respond_to_session', {
        p_session_id: session.id,
        p_response: response,
      })
      console.log('[rsvp] rpc returned — data=', data, 'error=', rpcError)
      if (rpcError) throw rpcError
      // Server returns a single-row table; supabase-js gives us an array.
      const result = Array.isArray(data) ? data[0] : data
      if (result?.promoted) {
        setToast(`everyone's in! see you ${formatLong(session.scheduled_for)} 🌱`)
      }
      setEditing(false)
      router.refresh()
    } catch (err) {
      console.error('[rsvp] respond_to_session failed:', err)
      const msg = getErrorMessage(err)
      setError(friendlyError(msg))
      if (/no longer accepting rsvps/i.test(msg)) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const showResponseButtons = !myRsvp || editing

  return (
    <div
      className="chunky"
      style={{
        background: 'white', borderRadius: 14, padding: 18, marginBottom: 12,
        position: 'relative',
      }}
    >
      {error ? (
        <div
          role="alert"
          style={{
            background: '#FFE5E5', border: '2px solid #B00020', color: '#B00020',
            borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 700,
            marginBottom: 12,
          }}
        >
          ⚠️ {error}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span
          style={{
            background: '#C780E8', border: '2px solid #1F1A3D', borderRadius: 999,
            padding: '2px 10px', fontWeight: 700, fontSize: 12,
          }}
        >
          📅 proposed session
        </span>
        {busy ? (
          <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.7 }}>saving rsvp…</span>
        ) : null}
      </div>
      <div suppressHydrationWarning style={{ fontWeight: 700, fontSize: 20, marginBottom: 2 }}>
        {formatLong(session.scheduled_for)}
      </div>
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
        {session.duration_minutes} min · proposed by {session.proposer?.display_name || 'a podmate'}
      </div>

      {/* member rsvp grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {podMembers.map((pm) => {
          const r = rsvpByProfile.get(pm.profile_id)
          const key = (r?.response ?? 'awaiting') as RsvpResponse | 'awaiting'
          const meta = RESPONSE_GLYPH[key]
          const isProposer = pm.profile_id === session.proposed_by
          return (
            <div
              key={pm.profile_id}
              title={`${pm.profile?.display_name || 'someone'}: ${meta.label}${isProposer ? ' (proposer)' : ''}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#FFF6E5', border: '2px solid #1F1A3D', borderRadius: 999,
                padding: '3px 10px 3px 3px', fontSize: 13, fontWeight: 600,
              }}
            >
              <Avatar profile={pm.profile} size={26} />
              <span>{pm.profile?.display_name?.split(' ')[0] || 'them'}</span>
              <span
                aria-label={meta.label}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 18, height: 18, borderRadius: 999, background: meta.tone,
                  color: '#1F1A3D', fontSize: 12, fontWeight: 700,
                }}
              >
                {meta.glyph}
              </span>
            </div>
          )
        })}
      </div>

      {showResponseButtons ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <button
            onClick={() => rsvp('yes')}
            disabled={busy}
            className="chunky"
            style={{ background: '#6BCB77', borderRadius: 10, padding: '8px 14px', fontWeight: 700 }}
          >
            yes, I&apos;m in
          </button>
          <button
            onClick={() => rsvp('maybe')}
            disabled={busy}
            className="chunky"
            style={{ background: '#FFD23F', borderRadius: 10, padding: '8px 14px', fontWeight: 700 }}
          >
            maybe
          </button>
          <button
            onClick={() => rsvp('no')}
            disabled={busy}
            className="chunky"
            style={{ background: 'white', borderRadius: 10, padding: '8px 14px', fontWeight: 700 }}
          >
            can&apos;t make it
          </button>
          {myRsvp ? (
            <button
              onClick={() => setEditing(false)}
              disabled={busy}
              style={{ background: 'transparent', border: 'none', fontWeight: 700, fontSize: 13, opacity: 0.6, cursor: 'pointer' }}
            >
              cancel
            </button>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 14 }}>
          <span>
            you said <strong>{myRsvp?.response}</strong>
          </span>
          <button
            onClick={() => setEditing(true)}
            style={{
              background: 'transparent', border: 'none', textDecoration: 'underline',
              fontWeight: 700, cursor: 'pointer', color: '#4D96FF', fontSize: 13,
            }}
          >
            change
          </button>
        </div>
      )}

      <div style={{ fontSize: 13, opacity: 0.75 }}>{statusLine}</div>
      {session.proposal_deadline ? (
        <div suppressHydrationWarning style={{ fontSize: 12, opacity: 0.55, marginTop: 4 }}>
          decide by {formatShortDeadline(session.proposal_deadline)}
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: '#6BCB77', border: '2.5px solid #1F1A3D', boxShadow: '4px 4px 0 0 #1F1A3D',
            borderRadius: 12, padding: '10px 18px', fontWeight: 700, zIndex: 250,
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  )
}
