/**
 * Wrapper around `submit_pod_feedback` that also fires the "your pod is
 * continuing" emails when *this* vote was the one that unlocked the chat.
 *
 * The RPC's return shape isn't documented in the generated types, so we check
 * pods.chat_unlocked before and after to detect the transition. Emails are
 * sent best-effort — a Resend hiccup must never reverse a vote that already
 * landed in the database.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotificationEmail, appUrl } from '@/lib/email/send'
import PodChatUnlockedEmail from '@/lib/email/templates/pod-chat-unlocked'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: podId } = await params
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
  const { wantsToContinue } = body as { wantsToContinue?: boolean }
  if (typeof wantsToContinue !== 'boolean') {
    return NextResponse.json({ error: 'missing wantsToContinue' }, { status: 400 })
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = supabase

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Snapshot chat state before the vote so we can detect the unlock edge.
  const { data: before } = await sb
    .from('pods')
    .select('chat_unlocked')
    .eq('id', podId)
    .single()
  const wasUnlocked = before?.chat_unlocked === true

  const { error: rpcError } = await sb.rpc('submit_pod_feedback', {
    p_pod_id: podId,
    p_wants_to_continue: wantsToContinue,
  })
  if (rpcError) {
    return NextResponse.json(
      { error: rpcError.message || 'feedback failed' },
      { status: 400 }
    )
  }

  const { data: after } = await sb
    .from('pods')
    .select('chat_unlocked, name, primary_interest:interests(name)')
    .eq('id', podId)
    .single()
  const nowUnlocked = after?.chat_unlocked === true
  const justUnlocked = !wasUnlocked && nowUnlocked

  if (justUnlocked) {
    // Use the service role for the fan-out so we can look up everyone's
    // display_name + auth email without per-user round trips through RLS.
    ;(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin: any = createAdminClient()
        const { data: memberRows } = await admin
          .from('pod_members')
          .select('profile_id, profile:profiles(display_name)')
          .eq('pod_id', podId)
          .is('left_at', null)

        const interestName =
          (after?.primary_interest as { name?: string | null } | null)?.name || null
        const podName =
          (after?.name as string | null) ||
          (interestName ? `${interestName} pod` : 'your pod')
        const podUrl = appUrl(`/pods/${podId}`)

        for (const m of (memberRows as Array<{
          profile_id: string
          profile: { display_name: string | null } | null
        }> | null) || []) {
          const recipientName =
            (m.profile?.display_name || 'friend').split(' ')[0]
          try {
            await sendNotificationEmail({
              recipientId: m.profile_id,
              emailType: 'pod_chat_unlocked',
              contextId: podId,
              subject: 'your pod is continuing! 🌿',
              template: PodChatUnlockedEmail({
                recipientName,
                podName,
                podUrl,
              }),
            })
          } catch (emailErr) {
            console.error(
              'api/pods/feedback: pod_chat_unlocked email failed for',
              m.profile_id,
              '—',
              emailErr
            )
          }
        }
      } catch (err) {
        console.error('api/pods/feedback: fan-out failed —', err)
      }
    })()
  }

  return NextResponse.json({ ok: true, chat_unlocked: nowUnlocked, just_unlocked: justUnlocked })
}
