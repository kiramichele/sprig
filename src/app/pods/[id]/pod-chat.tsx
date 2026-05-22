"use client"

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const AVATAR_COLORS = ['#FFD23F', '#6BCB77', '#4D96FF', '#FF6B6B', '#C780E8']

function hash(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

function Avatar({ profile, size }: any) {
  const p = profile || {}
  const seed = hash(String(p.id || p.display_name || '?'))
  const color = AVATAR_COLORS[seed % AVATAR_COLORS.length]
  const initial = (p.display_name || '?').slice(0, 1).toUpperCase()
  if (p.photo_url) {
    return (
      <img
        src={p.photo_url}
        alt={p.display_name || 'member'}
        style={{ width: size, height: size, borderRadius: 9999, objectFit: 'cover', border: '2px solid #1F1A3D', flexShrink: 0 }}
      />
    )
  }
  return (
    <span
      style={{
        width: size, height: size, borderRadius: 9999, background: color,
        border: '2px solid #1F1A3D', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontWeight: 700, fontSize: size * 0.42, flexShrink: 0,
      }}
    >
      {initial}
    </span>
  )
}

export default function PodChat({ threadId, currentUserId, members }: any) {
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  // sender_id -> profile lookup
  const memberById: Record<string, any> = {}
  for (const m of members || []) {
    const p = m?.profile || m
    if (p && p.id) memberById[p.id] = p
  }

  useEffect(() => {
    // no thread yet — render() returns the placeholder before `loaded` is read
    if (!threadId) return

    let active = true
    const supabase = createClient()

    async function load() {
      try {
        const { data, error: loadError } = await supabase
          .from('messages')
          .select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true })
          .limit(50)
        if (loadError) throw loadError
        if (active) setMessages((data || []).filter((m: any) => !m.is_deleted))
      } catch (err) {
        console.error('pod chat: load failed —', err)
        if (active) setError('could not load messages')
      } finally {
        if (active) setLoaded(true)
      }
    }
    load()

    const channel = supabase
      .channel(`pod-chat-${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const row: any = payload.new
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

  // keep the scroll pinned to the newest message
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
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
      // realtime will likely deliver this too — dedupe by id
      if (data) setMessages((prev) => (prev.some((m) => m.id === (data as any).id) ? prev : [...prev, data]))
      setText('')
    } catch (err) {
      console.error('pod chat: send failed —', err)
      setError('message didn’t send — try again') // text is intentionally kept so the user can retry
    } finally {
      setSending(false)
    }
  }

  if (!threadId) {
    return (
      <div className="chunky" style={{ background: 'white', borderRadius: 14, padding: 20, opacity: 0.8 }}>
        chat will open here once your pod gets going.
      </div>
    )
  }

  return (
    <div className="chunky" style={{ background: 'white', borderRadius: 16, overflow: 'hidden' }}>
      <div ref={listRef} style={{ maxHeight: 380, overflowY: 'auto', padding: 16 }}>
        {!loaded ? (
          <div style={{ opacity: 0.6, fontSize: 14 }}>loading messages…</div>
        ) : messages.length === 0 ? (
          <div style={{ opacity: 0.6, fontSize: 14 }}>no messages yet — say hi! 👋</div>
        ) : (
          messages.map((msg) => {
            const mine = msg.sender_id === currentUserId
            const sender = memberById[msg.sender_id] || {}
            return (
              <div
                key={msg.id}
                style={{ display: 'flex', flexDirection: mine ? 'row-reverse' : 'row', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}
              >
                <Avatar profile={sender} size={32} />
                <div style={{ maxWidth: '72%' }}>
                  <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 2, textAlign: mine ? 'right' : 'left' }}>
                    {mine ? 'you' : sender.display_name || 'someone'}
                  </div>
                  <div
                    style={{
                      background: mine ? '#FFD23F' : '#FFF6E5',
                      border: '2px solid #1F1A3D', borderRadius: 12, padding: '8px 12px',
                      fontSize: 14, wordBreak: 'break-word',
                    }}
                  >
                    {msg.body}
                  </div>
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
