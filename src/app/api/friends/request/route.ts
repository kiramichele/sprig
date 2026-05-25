/**
 * Send a friend request and (best-effort) email the addressee.
 *
 * We previously inserted from the client; routing through the server lets us
 * trigger an email after the insert without exposing the service role. The
 * insert itself still runs as the *user* (server client), so RLS continues to
 * enforce that the two people have shared a pod.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendNotificationEmail, appUrl } from '@/lib/email/send'
import FriendRequestReceivedEmail from '@/lib/email/templates/friend-request-received'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
  const { addresseeId, podId, note } = body as {
    addresseeId?: string
    podId?: string
    note?: string
  }
  if (!addresseeId || !podId || typeof note !== 'string') {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }
  const trimmed = note.trim()
  if (trimmed.length < 5 || trimmed.length > 300) {
    return NextResponse.json({ error: 'note must be 5–300 chars' }, { status: 400 })
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = supabase

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: friendship, error: insertError } = await sb
    .from('friendships')
    .insert({
      requester_id: user.id,
      addressee_id: addresseeId,
      request_note: trimmed,
      origin_pod_id: podId,
    })
    .select('id, requester_id, addressee_id, status')
    .single()

  if (insertError) {
    if (insertError.code === '42501' || /row-level security/i.test(insertError.message)) {
      return NextResponse.json(
        { error: "you can only send friend requests to people you've shared a pod with." },
        { status: 403 }
      )
    }
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'a request between you two already exists' }, { status: 409 })
    }
    console.error('api/friends/request: insert failed —', insertError)
    return NextResponse.json({ error: 'could not send the request' }, { status: 500 })
  }

  // Fire the email best-effort. Never surface email failures to the user — the
  // request itself succeeded, and a failed email shouldn't unwind it.
  ;(async () => {
    try {
      const [requesterRes, addresseeRes, podRes] = await Promise.all([
        sb.from('profiles').select('display_name').eq('id', user.id).single(),
        sb.from('profiles').select('display_name').eq('id', addresseeId).single(),
        sb
          .from('pods')
          .select('name, primary_interest:interests(name)')
          .eq('id', podId)
          .single(),
      ])
      const requesterName =
        (requesterRes.data?.display_name as string | null)?.split(' ')[0] || 'a sprig user'
      const addresseeFull = (addresseeRes.data?.display_name as string | null) || 'friend'
      const addresseeName = addresseeFull.split(' ')[0]
      const interestName =
        (podRes.data?.primary_interest as { name?: string | null } | null)?.name || null
      const requesterPodName =
        (podRes.data?.name as string | null) ||
        (interestName ? `${interestName} pod` : 'shared')

      await sendNotificationEmail({
        recipientId: addresseeId,
        emailType: 'friend_request_received',
        contextId: friendship.id,
        subject: `${requesterName} sent you a friend request`,
        template: FriendRequestReceivedEmail({
          recipientName: addresseeName,
          requesterName,
          requesterPodName,
          requestNote: trimmed,
          friendsUrl: appUrl('/friends'),
        }),
      })
    } catch (emailErr) {
      console.error('api/friends/request: email failed —', emailErr)
    }
  })()

  return NextResponse.json({ friendship })
}
