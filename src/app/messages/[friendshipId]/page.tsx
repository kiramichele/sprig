import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DmContent from './dm-content'
import type { ChatProfile } from '../messages-list'

const FONT_STYLE = `@import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=DM+Sans:wght@400;500;600;700&display=swap'); .display { font-family: 'Caprasimo', Georgia, serif; }`

export default async function DmPage({ params }: { params: Promise<{ friendshipId: string }> }) {
  const { friendshipId } = await params

  const supabase = await createClient()
  const sb: any = supabase

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user
  if (!user) redirect('/login')

  const { data: friendship } = await sb
    .from('friendships')
    .select('id, status, requester_id, addressee_id')
    .eq('id', friendshipId)
    .maybeSingle()

  // must exist, be accepted, and involve the current user
  if (!friendship) redirect('/messages')
  if (friendship.status !== 'accepted') redirect('/messages')
  if (friendship.requester_id !== user.id && friendship.addressee_id !== user.id) redirect('/messages')

  const otherId =
    friendship.requester_id === user.id ? friendship.addressee_id : friendship.requester_id

  const [{ data: profile }, { data: otherUser }, { data: thread }, { count: pendingCount }] =
    await Promise.all([
      sb.from('profiles').select('*').eq('id', user.id).single(),
      sb.from('profiles').select('id, display_name, photo_url, username').eq('id', otherId).single(),
      sb
        .from('message_threads')
        .select('id')
        .eq('friendship_id', friendshipId)
        .eq('thread_type', 'dm')
        .maybeSingle(),
      sb
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('addressee_id', user.id)
        .eq('status', 'pending'),
    ])

  const fallbackOther: ChatProfile = {
    id: otherId,
    display_name: 'someone',
    photo_url: null,
    username: null,
  }

  return (
    <main className="min-h-screen" style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{FONT_STYLE}</style>
      <DmContent
        profile={profile || { id: user.id }}
        otherUser={(otherUser as ChatProfile | null) ?? fallbackOther}
        threadId={thread?.id ?? null}
        currentUserId={user.id}
        pendingRequestCount={pendingCount ?? 0}
      />
    </main>
  )
}
