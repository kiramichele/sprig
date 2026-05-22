"use client"

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChatProfile } from '../messages-list'

const AVATAR_COLORS = ['#FFD23F', '#6BCB77', '#4D96FF', '#FF6B6B', '#C780E8']
function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function Avatar({ profile, size }: { profile: ChatProfile; size: number }) {
  const color = AVATAR_COLORS[hash(profile.id || profile.display_name || '?') % AVATAR_COLORS.length]
  const initial = (profile.display_name || '?').slice(0, 1).toUpperCase()
  if (profile.photo_url) {
    return (
      <img
        src={profile.photo_url}
        alt={profile.display_name || 'friend'}
        style={{ width: size, height: size, borderRadius: 9999, objectFit: 'cover', border: '2px solid #1F1A3D', flexShrink: 0 }}
      />
    )
  }
  return (
    <span
      style={{
        width: size, height: size, borderRadius: 9999, background: color, border: '2px solid #1F1A3D',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.42, flexShrink: 0,
      }}
    >
      {initial}
    </span>
  )
}

interface Props {
  threadId: string | null
  currentUserId: string
  otherUser: ChatProfile
}

export default function DmChat({ threadId, currentUserId, otherUser }: Props) {
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!threadId) return
    const tid = threadId // narrowed to string for the nested closures below

    let active = true
    const supabase = createClient()

    async function load() {
      try {
        const { data, error: loadError } = await supabase
          .from('messages')
          .select('*')
          .eq('thread_id', tid)
          .order('created_at', { ascending: true })
          .limit(50)
        if (loadError) throw loadError
        if (active) {
          setMessages((data ?? []).filter((m) => !(m as { is_deleted?: boolean }).is_deleted))
        }
      } catch (err) {
        console.error('dm chat: load failed —', err)
        if (active) setError('could not load messages')
      } finally {
        if (active) setLoaded(true)
      }
    }
    load()

    const channel = supabase
      .channel(`dm-${tid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${tid}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          if (!row || row.is_deleted) return
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [threadId])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending || !threadId) return
    setSending(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: sendError } = await supabase
        .from('messages')
        .insert({ thread_id: threadId, sender_id: currentUserId, body })
        .select()
        .single()
      if (sendError) throw sendError
      if (data) {
        setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]))
      }
      setText('')
    } catch (err) {
      console.error('dm chat: send failed —', err)
      setError('message didn’t send — try again') // text is kept so the user can retry
    } finally {
      setSending(false)
    }
  }

  if (!threadId) {
    return (
      <div className="chunky" style={{ background: 'white', borderRadius: 14, padding: 20, opacity: 0.8 }}>
        this chat isn&apos;t ready yet — check back in a moment.
      </div>
    )
  }

  return (
    <div className="chunky" style={{ background: 'white', borderRadius: 16, overflow: 'hidden' }}>
      <div ref={listRef} style={{ maxHeight: 440, overflowY: 'auto', padding: 16 }}>
        {!loaded ? (
          <div style={{ opacity: 0.6, fontSize: 14 }}>loading messages…</div>
        ) : messages.length === 0 ? (
          <div style={{ opacity: 0.6, fontSize: 14 }}>say hi! 👋</div>
        ) : (
          messages.map((msg) => {
            const mine = msg.sender_id === currentUserId
            return (
              <div
                key={String(msg.id)}
                style={{
                  display: 'flex', flexDirection: mine ? 'row-reverse' : 'row', gap: 8,
                  marginBottom: 12, alignItems: 'flex-end',
                }}
              >
                {mine ? null : <Avatar profile={otherUser} size={32} />}
                <div
                  style={{
                    maxWidth: '74%',
                    background: mine ? '#FFD23F' : '#FFF6E5',
                    border: '2px solid #1F1A3D', borderRadius: 12, padding: '8px 12px',
                    fontSize: 14, wordBreak: 'break-word',
                  }}
                >
                  {String(msg.body ?? '')}
                </div>
              </div>
            )
          })
        )}
      </div>

      <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '2.5px solid #1F1A3D' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="write a message…"
          className="field"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="chunky"
          style={{ background: '#6BCB77', borderRadius: 12, padding: '8px 18px', fontWeight: 700, flexShrink: 0 }}
        >
          {sending ? '…' : 'send'}
        </button>
      </form>
      {error ? <div style={{ padding: '0 12px 12px', fontSize: 12, color: '#B00020' }}>{error}</div> : null}
    </div>
  )
}
