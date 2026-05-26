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

    /**
     * Refetch the message list and merge with what's already in state, deduping
     * by id. Used by the initial load, the realtime fallback (when iOS Safari
     * or mobile Chrome suspend the websocket), and the visibilitychange
     * handler that fires when the user returns to the tab.
     */
    async function refresh() {
      try {
        const { data, error: loadError } = await supabase
          .from('messages')
          .select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true })
          .limit(50)
        if (loadError) throw loadError
        if (!active) return
        const fresh = (data || []).filter((m: any) => !m.is_deleted)
        setMessages((prev) => {
          if (prev.length === 0) return fresh
          // Merge — preserve order from server, dedupe by id.
          const ids = new Set(prev.map((m) => m.id))
          const additions = fresh.filter((m) => !ids.has(m.id))
          return additions.length === 0 ? prev : [...prev, ...additions]
        })
      } catch (err) {
        console.error('pod chat: load failed —', err)
        if (active) setError('could not load messages')
      } finally {
        if (active) setLoaded(true)
      }
    }
    refresh()

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

    // Mobile browsers (especially iOS Safari) suspend the websocket when the
    // tab is backgrounded. The instant the user returns we force a refetch
    // so they don't sit on a stale chat.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    // Belt-and-suspenders poll. 5s is gentle, only fires on a visible tab.
    // If realtime is working this is a cheap no-op (dedupe takes care of it).
    const pollId = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 5000)

    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.clearInterval(pollId)
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
          <PodChatEmpty members={members} currentUserId={currentUserId} />
        ) : (
          messages.map((msg) => {
            if (msg.is_system) {
              return (
                <div
                  key={msg.id}
                  style={{
                    textAlign: 'center',
                    fontSize: 12,
                    fontStyle: 'italic',
                    color: '#1F1A3D88',
                    margin: '10px 0',
                    padding: '0 12px',
                    lineHeight: 1.4,
                  }}
                >
                  — {msg.body} —
                </div>
              )
            }
            const mine = msg.sender_id === currentUserId
            const sender = memberById[msg.sender_id] || {}
            const profileHref = sender?.username ? `/profile/${sender.username}` : null
            const senderLabel = mine ? 'you' : sender.display_name || 'someone'
            const avatarNode = <Avatar profile={sender} size={32} />
            return (
              <div
                key={msg.id}
                style={{ display: 'flex', flexDirection: mine ? 'row-reverse' : 'row', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}
              >
                {profileHref ? (
                  <a href={profileHref} aria-label="view profile" style={{ display: 'flex', textDecoration: 'none' }}>
                    {avatarNode}
                  </a>
                ) : (
                  avatarNode
                )}
                <div style={{ maxWidth: '72%' }}>
                  <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 2, textAlign: mine ? 'right' : 'left' }}>
                    {profileHref ? (
                      <a href={profileHref} style={{ color: 'inherit', textDecoration: 'none' }}>{senderLabel}</a>
                    ) : (
                      senderLabel
                    )}
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

function PodChatEmpty({ members, currentUserId }: { members: any[] | undefined; currentUserId: string }) {
  const others = (members || [])
    .map((m) => m?.profile || m)
    .filter((p: any) => p && p.id && p.id !== currentUserId)
  const otherCount = others.length
  return (
    <div style={{ textAlign: 'center', padding: '20px 8px', color: '#1F1A3D' }}>
      <div className="display" style={{ fontSize: 20, marginBottom: 6 }}>
        say hi 👋
      </div>
      <p style={{ fontSize: 14, opacity: 0.78, margin: '0 auto 14px', maxWidth: 360, lineHeight: 1.5 }}>
        this is where you&apos;ll chat between sessions
        {otherCount > 0 ? (
          <> — say hi to {otherCount} of your podmates 🌿</>
        ) : (
          <> 🌿</>
        )}
      </p>
      {otherCount > 0 ? (
        <div style={{ display: 'inline-flex', gap: -6, padding: '0 6px' }}>
          {others.slice(0, 5).map((p: any) => (
            <span key={p.id} style={{ marginLeft: -8 }}>
              <Avatar profile={p} size={36} />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
