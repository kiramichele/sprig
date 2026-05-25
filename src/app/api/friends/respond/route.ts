/**
 * Respond to a friend request: accept, decline, or (as the requester) withdraw.
 *
 * Only the addressee can accept/decline; only the requester can withdraw — RLS
 * enforces this, but we also validate to return clean errors. On accept we fire
 * a friend_request_accepted email to the *original requester* (not the actor).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendNotificationEmail, appUrl } from '@/lib/email/send'
import FriendRequestAcceptedEmail from '@/lib/email/templates/friend-request-accepted'

type Response = 'accepted' | 'declined' | 'withdrawn'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
  const { friendshipId, response } = body as {
    friendshipId?: string
    response?: Response
  }
  if (
    !friendshipId ||
    !response ||
    !['accepted', 'declined', 'withdrawn'].includes(response)
  ) {
    return NextResponse.json({ error: 'missing or invalid fields' }, { status: 400 })
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = supabase

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: existing, error: readError } = await sb
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .eq('id', friendshipId)
    .single()
  if (readError || !existing) {
    return NextResponse.json({ error: 'request not found' }, { status: 404 })
  }

  if (response === 'withdrawn' && existing.requester_id !== user.id) {
    return NextResponse.json({ error: 'only the sender can withdraw' }, { status: 403 })
  }
  if (
    (response === 'accepted' || response === 'declined') &&
    existing.addressee_id !== user.id
  ) {
    return NextResponse.json({ error: 'only the recipient can accept/decline' }, { status: 403 })
  }

  const { data: updated, error: updateError } = await sb
    .from('friendships')
    .update({ status: response })
    .eq('id', friendshipId)
    .select('id, requester_id, addressee_id, status')
    .single()
  if (updateError || !updated) {
    console.error('api/friends/respond: update failed —', updateError)
    return NextResponse.json({ error: 'could not update' }, { status: 500 })
  }

  // Email the original requester when their request is accepted. Other
  // transitions don't trigger an email (declined / withdrawn would be noise).
  if (response === 'accepted') {
    ;(async () => {
      try {
        const [accepterRes, requesterRes] = await Promise.all([
          sb.from('profiles').select('display_name').eq('id', user.id).single(),
          sb
            .from('profiles')
            .select('display_name')
            .eq('id', existing.requester_id)
            .single(),
        ])
        const accepterName =
          (accepterRes.data?.display_name as string | null)?.split(' ')[0] || 'someone'
        const requesterName =
          (requesterRes.data?.display_name as string | null)?.split(' ')[0] || 'friend'

        await sendNotificationEmail({
          recipientId: existing.requester_id,
          emailType: 'friend_request_accepted',
          contextId: friendshipId,
          subject: `${accepterName} accepted your request`,
          template: FriendRequestAcceptedEmail({
            recipientName: requesterName,
            otherUserName: accepterName,
            dmUrl: appUrl(`/messages/${friendshipId}`),
          }),
        })
      } catch (emailErr) {
        console.error('api/friends/respond: accept email failed —', emailErr)
      }
    })()
  }

  return NextResponse.json({ friendship: updated })
}
