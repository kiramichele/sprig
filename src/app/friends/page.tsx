import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TopNav from '@/components/top-nav'
import FriendsContent, {
  type AcceptedFriend,
  type FriendPod,
  type FriendProfile,
  type IncomingRequest,
  type OutgoingRequest,
} from './friends-content'

const FONT_STYLE = `@import url('https://fonts.googleapis.com/css2?family=Caprasimo&family=DM+Sans:wght@400;500;600;700&display=swap'); .display { font-family: 'Caprasimo', Georgia, serif; }`

const PROFILE_COLS = 'id, display_name, photo_url, username'
const POD_COLS = 'id, name, primary_interest:interests(name)'

export default async function FriendsPage() {
  const supabase = await createClient()
  // server pages use an untyped client for embedded selects (matches home/pod
  // pages); all results below are narrowed to explicit interfaces.
  const sb: any = supabase

  const { data: userData } = await sb.auth.getUser()
  const user = userData?.user
  if (!user) redirect('/login')

  const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single()

  const [incomingRes, outgoingRes, acceptedRes] = await Promise.all([
    sb
      .from('friendships')
      .select(
        `id, request_note, requested_at, requester:profiles!friendships_requester_id_fkey(${PROFILE_COLS}), origin_pod:pods!friendships_origin_pod_id_fkey(${POD_COLS})`
      )
      .eq('addressee_id', user.id)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false }),
    sb
      .from('friendships')
      .select(
        `id, requested_at, addressee:profiles!friendships_addressee_id_fkey(${PROFILE_COLS}), origin_pod:pods!friendships_origin_pod_id_fkey(${POD_COLS})`
      )
      .eq('requester_id', user.id)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false }),
    sb
      .from('friendships')
      .select(
        `id, requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(${PROFILE_COLS}), addressee:profiles!friendships_addressee_id_fkey(${PROFILE_COLS}), origin_pod:pods!friendships_origin_pod_id_fkey(${POD_COLS})`
      )
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted'),
  ])

  if (incomingRes.error) console.error('friends: incoming query failed —', incomingRes.error)
  if (outgoingRes.error) console.error('friends: outgoing query failed —', outgoingRes.error)
  if (acceptedRes.error) console.error('friends: accepted query failed —', acceptedRes.error)

  const incoming = (incomingRes.data ?? []) as IncomingRequest[]
  const outgoing = (outgoingRes.data ?? []) as OutgoingRequest[]

  type AcceptedRow = {
    id: string
    requester_id: string
    addressee_id: string
    requester: FriendProfile | null
    addressee: FriendProfile | null
    origin_pod: FriendPod | null
  }
  const fallbackProfile: FriendProfile = { id: '', display_name: 'someone', photo_url: null, username: null }
  const accepted: AcceptedFriend[] = ((acceptedRes.data ?? []) as AcceptedRow[]).map((f) => ({
    friendshipId: f.id,
    friend: (f.requester_id === user.id ? f.addressee : f.requester) ?? fallbackProfile,
    origin_pod: f.origin_pod,
  }))

  return (
    <main className="min-h-screen" style={{ background: '#FFF6E5', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{FONT_STYLE}</style>
      <TopNav profile={profile || { id: user.id }} pendingRequestCount={incoming.length} />
      <FriendsContent incoming={incoming} outgoing={outgoing} accepted={accepted} />
    </main>
  )
}
