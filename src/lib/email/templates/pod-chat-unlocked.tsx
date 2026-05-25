import { Link, Text } from '@react-email/components'
import EmailLayout, { emailStyles } from './_layout'

interface Props {
  recipientName: string
  podName: string
  podUrl: string
}

export default function PodChatUnlockedEmail({
  recipientName,
  podName,
  podUrl,
}: Props) {
  return (
    <EmailLayout preview={`your ${podName} pod is continuing 🌿`}>
      <Text style={emailStyles.heading}>your pod is continuing! 🌿</Text>
      <Text style={emailStyles.paragraph}>
        hi {recipientName} — great news. enough of your{' '}
        <strong>{podName}</strong> pod said yes to continuing, so the chat is
        now open.
      </Text>
      <Text style={emailStyles.paragraph}>
        <Link href={podUrl} style={emailStyles.button}>
          open pod →
        </Link>
      </Text>
      <Text style={emailStyles.signoff}>— sprig</Text>
    </EmailLayout>
  )
}
