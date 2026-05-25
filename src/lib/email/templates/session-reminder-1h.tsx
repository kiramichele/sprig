import { Link, Text } from '@react-email/components'
import EmailLayout, { emailStyles } from './_layout'

interface Props {
  recipientName: string
  podName: string
  sessionTime: string
  podUrl: string
}

export default function SessionReminder1hEmail({
  recipientName,
  podName,
  sessionTime,
  podUrl,
}: Props) {
  return (
    <EmailLayout preview={`your ${podName} hangout starts in about an hour`}>
      <Text style={emailStyles.heading}>about an hour to go ⏰</Text>
      <Text style={emailStyles.paragraph}>
        hi {recipientName} — in case you forgot, your{' '}
        <strong>{podName}</strong> hangout starts in an hour
        {sessionTime ? ` (${sessionTime})` : ''}.
      </Text>
      <Text style={emailStyles.paragraph}>
        <Link href={podUrl} style={emailStyles.button}>
          see the pod →
        </Link>
      </Text>
      <Text style={emailStyles.signoff}>— sprig</Text>
    </EmailLayout>
  )
}
