/**
 * POST /api/pods/[id]/leave — a member voluntarily exits a pod.
 *
 * Always:
 *   - Stamp pod_members.left_at for the caller.
 *
 * If remaining_members < 3 (the algorithm's MIN_POD):
 *   - Flip the pod to status='dissolved' + dissolved_at=now()
 *   - Cancel any 'proposed' OR future 'scheduled' sessions for the pod
 *   - Post a friendly system message to the pod chat (if a thread exists)
 *
 * We use the admin client for the write side because: the cascade touches
 * rows the caller might not have RLS write access to (other members' sessions,
 * the pod row itself), and we want the entire winding-down to land atomically
 * from the caller's perspective. The auth check is done up-front with the
 * user-scoped client so RLS still vets identity.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: podId } = await params
  if (!podId) return NextResponse.json({ error: 'missing pod id' }, { status: 400 })

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = supabase

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()
  const nowIso = new Date().toISOString()

  // 1. Verify the caller is an active member.
  const { data: membership } = await admin
    .from('pod_members')
    .select('profile_id')
    .eq('pod_id', podId)
    .eq('profile_id', user.id)
    .is('left_at', null)
    .maybeSingle()
  if (!membership) {
    return NextResponse.json({ error: 'not a current member of this pod' }, { status: 403 })
  }

  // 2. Stamp the leave.
  const { error: leaveError } = await admin
    .from('pod_members')
    .update({ left_at: nowIso })
    .eq('pod_id', podId)
    .eq('profile_id', user.id)
    .is('left_at', null)
  if (leaveError) {
    console.error('leave pod: update failed —', leaveError)
    return NextResponse.json({ error: 'could not leave the pod' }, { status: 500 })
  }

  // 3. Count remaining active members.
  const { count } = await admin
    .from('pod_members')
    .select('profile_id', { count: 'exact', head: true })
    .eq('pod_id', podId)
    .is('left_at', null)
  const remaining = count ?? 0

  let dissolved = false
  if (remaining < 3) {
    dissolved = true

    // Cancel any proposed sessions for this pod.
    const { error: proposedErr } = await admin
      .from('pod_sessions')
      .update({ status: 'canceled' })
      .eq('pod_id', podId)
      .eq('status', 'proposed')
    if (proposedErr) console.error('leave pod: cancel proposed failed —', proposedErr)

    // Cancel any future scheduled sessions.
    const { error: scheduledErr } = await admin
      .from('pod_sessions')
      .update({ status: 'canceled' })
      .eq('pod_id', podId)
      .eq('status', 'scheduled')
      .gt('scheduled_for', nowIso)
    if (scheduledErr) console.error('leave pod: cancel scheduled failed —', scheduledErr)

    // Mark the pod dissolved.
    const { error: podErr } = await admin
      .from('pods')
      .update({ status: 'dissolved', dissolved_at: nowIso })
      .eq('id', podId)
    if (podErr) console.error('leave pod: pod update failed —', podErr)

    // System message in the pod chat (if it exists — only continuing pods
    // have a thread, but a forming/scheduled pod that dissolves before chat
    // unlocks simply has no thread to post to).
    const { data: thread } = await admin
      .from('message_threads')
      .select('id')
      .eq('pod_id', podId)
      .eq('thread_type', 'pod')
      .maybeSingle()
    if (thread?.id) {
      const { error: msgErr } = await admin.from('messages').insert({
        thread_id: thread.id,
        sender_id: null,
        is_system: true,
        body:
          'this pod is winding down — there aren’t enough members to keep it going. thanks for sharing this space 🌱',
      })
      if (msgErr) console.error('leave pod: system message failed —', msgErr)
    }
  }

  return NextResponse.json({ ok: true, dissolved })
}
