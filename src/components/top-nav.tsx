"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MessageCircle, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { MessagingDatabase } from '@/lib/messaging/types'

type Profile = {
  id: string
  display_name?: string | null
  photo_url?: string | null
  username?: string | null
}

const BADGE_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: -5,
  right: -7,
  background: '#FF6B9D',
  color: 'white',
  border: '2px solid #1F1A3D',
  borderRadius: 9999,
  minWidth: 18,
  height: 18,
  fontSize: 10,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 3px',
}

export default function TopNav({
  profile,
  pendingRequestCount = 0,
}: {
  profile: Profile
  pendingRequestCount?: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unreadDms, setUnreadDms] = useState(0)

  // One-time timezone auto-detect. If the profile doesn't have a timezone
  // set yet, write the browser's IANA zone (e.g. "America/Los_Angeles") so
  // server-side email rendering can format times in the recipient's locale.
  // Skips the write if the user already has one — settings can override.
  useEffect(() => {
    const userId = profile.id
    if (!userId || typeof window === 'undefined') return
    let cancelled = false
    ;(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase: any = createClient()
        const { data: row } = await supabase
          .from('profiles')
          .select('timezone')
          .eq('id', userId)
          .single()
        if (cancelled) return
        if (row && !row.timezone) {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
          if (tz) {
            await supabase.from('profiles').update({ timezone: tz }).eq('id', userId)
          }
        }
      } catch {
        /* best-effort */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profile.id])

  // Unread DM count — fetched client-side and refreshed on every new message
  // arrival via realtime. Recomputes on navigation since TopNav re-mounts.
  useEffect(() => {
    const userId = profile.id
    if (!userId) return

    let active = true
    // single documented cast — dm_thread_reads isn't in the generated types yet
    const supabase = createClient() as unknown as SupabaseClient<MessagingDatabase>

    async function computeUnread() {
      try {
        const { data: friendships } = await supabase
          .from('friendships')
          .select('id')
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
          .eq('status', 'accepted')
        const friendshipIds = (friendships ?? []).map((f) => f.id)
        if (!friendshipIds.length) {
          if (active) setUnreadDms(0)
          return
        }

        const { data: threads } = await supabase
          .from('message_threads')
          .select('id')
          .eq('thread_type', 'dm')
          .in('friendship_id', friendshipIds)
        const threadIds = (threads ?? []).map((t) => t.id)
        if (!threadIds.length) {
          if (active) setUnreadDms(0)
          return
        }

        const { data: msgs } = await supabase
          .from('messages')
          .select('thread_id, created_at')
          .in('thread_id', threadIds)
          .neq('sender_id', userId)
          .order('created_at', { ascending: false })
        const latestByThread: Record<string, string> = {}
        for (const m of msgs ?? []) {
          const tid = m.thread_id as string
          if (!latestByThread[tid]) latestByThread[tid] = m.created_at as string
        }
        const consideredIds = Object.keys(latestByThread)
        if (!consideredIds.length) {
          if (active) setUnreadDms(0)
          return
        }

        const { data: reads } = await supabase
          .from('dm_thread_reads')
          .select('thread_id, last_read_at')
          .eq('profile_id', userId)
          .in('thread_id', consideredIds)
        const readByThread: Record<string, string> = {}
        for (const r of reads ?? []) {
          readByThread[(r as { thread_id: string }).thread_id] = (r as { last_read_at: string }).last_read_at
        }

        let unread = 0
        for (const [tid, latest] of Object.entries(latestByThread)) {
          const lr = readByThread[tid]
          if (!lr || new Date(latest).getTime() > new Date(lr).getTime()) unread++
        }
        if (active) setUnreadDms(unread)
      } catch (err) {
        // failing silently is fine — the badge just won't show
        console.error('top-nav: unread dm count failed —', err)
      }
    }

    computeUnread()

    const channel = supabase
      .channel('top-nav-unread-dms')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          computeUnread()
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [profile.id])

  async function handleSignOut() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch (err) {
      console.error('sign out failed', err)
    }
  }

  const initial = (profile.display_name || profile.id || 'U').slice(0, 1).toUpperCase()

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 100, background: '#FFF6E5', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
      <div className="max-w-4xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 gap-3">
        <a
          href="/home"
          className="display text-xl sm:text-2xl"
          style={{ fontFamily: 'Caprasimo, Georgia, serif' }}
        >
          sprig 🌱
        </a>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* friends — pending friend-request count. Hidden on the smallest
              screens; reachable via the avatar menu instead. */}
          <a
            href="/friends"
            aria-label="friends"
            className="hidden sm:flex"
            style={{ position: 'relative', color: '#1F1A3D', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Users size={26} strokeWidth={2.5} />
            {pendingRequestCount > 0 ? (
              <span style={BADGE_STYLE}>
                {pendingRequestCount > 9 ? '9+' : pendingRequestCount}
              </span>
            ) : null}
          </a>

          {/* dms — unread message count. Stays on mobile too. */}
          <a
            href="/messages"
            aria-label="messages"
            className="flex"
            style={{ position: 'relative', color: '#1F1A3D', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <MessageCircle size={26} strokeWidth={2.5} />
            {unreadDms > 0 ? (
              <span style={BADGE_STYLE}>
                {unreadDms > 9 ? '9+' : unreadDms}
              </span>
            ) : null}
          </a>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              style={{ width: 44, height: 44, borderRadius: 9999, border: '2.5px solid #1F1A3D', background: 'white', boxShadow: '4px 4px 0 0 #1F1A3D', overflow: 'hidden' }}
            >
              {profile.photo_url ? (
                <img src={profile.photo_url} alt={profile.display_name || 'avatar'} style={{ width: 40, height: 40, borderRadius: 9999, objectFit: 'cover' }} />
              ) : (
                <span style={{ display: 'inline-block', lineHeight: '40px', width: 40, height: 40, textAlign: 'center', fontWeight: 700 }}>{initial}</span>
              )}
            </button>

            {open && (
              <>
                {/* invisible backdrop so a tap outside closes the menu on mobile */}
                <div
                  onClick={() => setOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 55 }}
                  aria-hidden
                />
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    right: 0,
                    marginTop: 8,
                    background: 'white',
                    border: '2px solid #1F1A3D',
                    borderRadius: 12,
                    boxShadow: '4px 4px 0 0 #1F1A3D',
                    minWidth: 200,
                    zIndex: 60,
                    overflow: 'hidden',
                  }}
                >
                  <a
                    href="/friends"
                    className="sm:hidden block px-4 font-bold"
                    style={{ minHeight: 44, display: 'flex', alignItems: 'center', color: '#1F1A3D' }}
                    onClick={() => setOpen(false)}
                  >
                    friends{pendingRequestCount > 0 ? ` (${pendingRequestCount})` : ''}
                  </a>
                  <a
                    href={profile.username ? `/profile/${profile.username}` : '/settings'}
                    className="block px-4 font-bold"
                    style={{ minHeight: 44, display: 'flex', alignItems: 'center', color: '#1F1A3D' }}
                    onClick={() => setOpen(false)}
                  >
                    profile
                  </a>
                  <a
                    href="/settings"
                    className="block px-4 font-bold"
                    style={{ minHeight: 44, display: 'flex', alignItems: 'center', color: '#1F1A3D' }}
                    onClick={() => setOpen(false)}
                  >
                    settings
                  </a>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 font-bold"
                    style={{ minHeight: 44, color: '#B00020', background: 'transparent', borderTop: '1.5px solid rgba(0,0,0,0.08)' }}
                  >
                    sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
