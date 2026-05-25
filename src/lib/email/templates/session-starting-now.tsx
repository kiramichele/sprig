import { Link, Text } from '@react-email/components'
import EmailLayout, { emailStyles } from './_layout'

interface Props {
  recipientName: string
  podName: string
  callUrl: string
}

export default function SessionStartingNowEmail({
  recipientName,
  podName,
  callUrl,
}: Props) {
  return (
    <EmailLayout preview={`your ${podName} pod is starting now`}>
      <Text style={emailStyles.heading}>your pod is starting now 🌱</Text>
      <Text style={emailStyles.paragraph}>
        hi {recipientName} — your <strong>{podName}</strong> pod is starting
        now.
      </Text>
      <Text style={emailStyles.paragraph}>
        <Link href={callUrl} style={emailStyles.button}>
          join the call →
        </Link>
      </Text>
      <Text style={emailStyles.signoff}>— sprig</Text>
    </EmailLayout>
  )
}
