import { Link, Text } from '@react-email/components'
import EmailLayout, { emailStyles } from './_layout'

interface Props {
  recipientName: string
  otherUserName: string
  dmUrl: string
}

export default function FriendRequestAcceptedEmail({
  recipientName,
  otherUserName,
  dmUrl,
}: Props) {
  return (
    <EmailLayout preview={`${otherUserName} accepted your friend request`}>
      <Text style={emailStyles.heading}>good news 🌱</Text>
      <Text style={emailStyles.paragraph}>
        hi {recipientName} — <strong>{otherUserName}</strong> accepted your
        friend request. you can chat now.
      </Text>
      <Text style={emailStyles.paragraph}>
        <Link href={dmUrl} style={emailStyles.button}>
          open chat →
        </Link>
      </Text>
      <Text style={emailStyles.signoff}>— sprig</Text>
    </EmailLayout>
  )
}
