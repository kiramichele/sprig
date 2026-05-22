import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/top-nav'
import MessagesList, { type ChatProfile, type ThreadPreview } from './messages-list'

const FONT_STYLE = `@import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=DM+Sans:wght@400;500;600;700&display=swap'); .display { font-family: 'Caprasimo', Georgia, serif; }`

const PROFILE_COLS = 'id, display_name, photo_url, username'

export default async function MessagesPage() {
  const supabase = await createClient()
  const sb: any = supabase

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user
  if (!user) redirect('/login')

  const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single()

  const { count: pendingCount } = await sb
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('addressee_id', user.id)
    .eq('status', 'pending')

  // DM threads — RLS limits results to threads the user belongs to
  const { data: threadData, error: threadError } = await sb
    .from('message_threads')
    .select(
      `id, last_message_at, friendship:friendships!message_threads_friendship_id_fkey(id, status, requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(${PROFILE_COLS}), addressee:profiles!friendships_addressee_id_fkey(${PROFILE_COLS}))`
    )
    .eq('thread_type', 'dm')
    .order('last_message_at', { ascending: false, nullsFirst: false })
  if (threadError) console.error('messages: thread query failed —', threadError)

  type ThreadRow = {
    id: string
    last_message_at: string | null
    friendship: {
      id: string
      status: string
      requester_id: string
      addressee_id: string
      requester: ChatProfile | null
      addressee: ChatProfile | null
    } | null
  }
  const rows = ((threadData ?? []) as ThreadRow[]).filter(
    (t) => t.friendship && t.friendship.status === 'accepted'
  )

  // most recent message per thread, for the preview line
  const threadIds = rows.map((t) => t.id)
  const lastByThread: Record<string, { body: string; created_at: string }> = {}
  if (threadIds.length) {
    const { data: msgs } = await sb
      .from('messages')
      .select('thread_id, body, created_at')
      .in('thread_id', threadIds)
      .order('created_at', { ascending: false })
    for (const m of (msgs ?? []) as Array<{ thread_id: string; body: string; created_at: string }>) {
      if (!lastByThread[m.thread_id]) {
        lastByThread[m.thread_id] = { body: m.body, created_at: m.created_at }
      }
    }
  }

  const fallback: ChatProfile = { id: '', display_name: 'someone', photo_url: null, username: null }
  const threads: ThreadPreview[] = rows.map((t) => {
    const f = t.friendship!
    const other = (f.requester_id === user.id ? f.addressee : f.requester) ?? fallback
    const last = lastByThread[t.id]
    return {
      friendshipId: f.id,
      otherUser: other,
      lastMessage: last?.body ?? null,
      lastMessageAt: last?.created_at ?? t.last_message_at ?? null,
    }
  })

  return (
    <main className="min-h-screen" style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{FONT_STYLE}</style>
      <TopNav profile={profile || { id: user.id }} pendingRequestCount={pendingCount ?? 0} />
      <MessagesList threads={threads} />
    </main>
  )
}
