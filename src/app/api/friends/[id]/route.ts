/**
 * DELETE /api/friends/[id] — unfriend.
 *
 * Removes the friendship + its DM thread + messages + read-state. No email,
 * no notification, no soft-delete; the other party simply stops seeing this
 * person in /friends and the chat URL stops resolving.
 *
 * Shared pods are intentionally NOT touched. The friendship is the private
 * connection; pods are the matched activity. If the user wants to leave the
 * pod too, that's a separate action (existing "leave pod" button).
 *
 * We verify caller identity through the user-scoped server client (RLS-aware),
 * then perform the multi-table cascade through the admin client because some
 * of the cleanup tables (messages, dm_thread_reads) may not allow user-scoped
 * deletes for content authored by the other party.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: friendshipId } = await params
  if (!friendshipId) {
    return NextResponse.json({ error: 'missing id' }, { status: 400 })
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = supabase

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: friendship, error: readError } = await sb
    .from('friendships')
    .select('id, requester_id, addressee_id')
    .eq('id', friendshipId)
    .single()
  if (readError || !friendship) {
    // Already gone — treat as success so a double-click doesn't error.
    return NextResponse.json({ ok: true, already_gone: true })
  }
  if (
    friendship.requester_id !== user.id &&
    friendship.addressee_id !== user.id
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  // Find any DM thread tied to this friendship so we can wipe its messages
  // before the thread row goes away.
  const { data: threads } = await admin
    .from('message_threads')
    .select('id')
    .eq('friendship_id', friendshipId)
  const threadIds = ((threads as { id: string }[] | null) || []).map((t) => t.id)

  if (threadIds.length) {
    const { error: msgError } = await admin
      .from('messages')
      .delete()
      .in('thread_id', threadIds)
    if (msgError) {
      console.error('unfriend: messages delete failed —', msgError)
      return NextResponse.json({ error: 'cleanup failed' }, { status: 500 })
    }

    // dm_thread_reads may or may not exist for every thread — ignore "not found"
    const { error: readsError } = await admin
      .from('dm_thread_reads')
      .delete()
      .in('thread_id', threadIds)
    if (readsError && readsError.code !== 'PGRST116') {
      console.error('unfriend: dm_thread_reads delete failed —', readsError)
      // not fatal — keep going
    }

    const { error: threadError } = await admin
      .from('message_threads')
      .delete()
      .in('id', threadIds)
    if (threadError) {
      console.error('unfriend: message_threads delete failed —', threadError)
      return NextResponse.json({ error: 'cleanup failed' }, { status: 500 })
    }
  }

  const { error: deleteError } = await admin
    .from('friendships')
    .delete()
    .eq('id', friendshipId)
  if (deleteError) {
    console.error('unfriend: friendships delete failed —', deleteError)
    return NextResponse.json({ error: 'could not unfriend' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
