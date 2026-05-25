import { Link, Text } from '@react-email/components'
import EmailLayout, { emailStyles } from './_layout'

interface Props {
  recipientName: string
  requesterName: string
  requesterPodName: string
  requestNote: string | null
  friendsUrl: string
}

export default function FriendRequestReceivedEmail({
  recipientName,
  requesterName,
  requesterPodName,
  requestNote,
  friendsUrl,
}: Props) {
  return (
    <EmailLayout preview={`${requesterName} sent you a friend request`}>
      <Text style={emailStyles.heading}>hi {recipientName} 🌱</Text>
      <Text style={emailStyles.paragraph}>
        <strong>{requesterName}</strong> from your{' '}
        <strong>{requesterPodName}</strong> pod wants to stay in touch.
      </Text>
      {requestNote ? (
        <Text style={emailStyles.quote}>“{requestNote}”</Text>
      ) : null}
      <Text style={emailStyles.paragraph}>
        <Link href={friendsUrl} style={emailStyles.button}>
          see request →
        </Link>
      </Text>
      <Text style={emailStyles.signoff}>— sprig</Text>
    </EmailLayout>
  )
}
