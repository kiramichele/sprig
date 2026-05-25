import { Link, Text } from '@react-email/components'
import EmailLayout, { emailStyles } from './_layout'

interface Props {
  recipientName: string
  podName: string
  sessionTime: string
  podUrl: string
}

export default function SessionReminder24hEmail({
  recipientName,
  podName,
  sessionTime,
  podUrl,
}: Props) {
  return (
    <EmailLayout preview={`your ${podName} hangout is tomorrow 🌱`}>
      <Text style={emailStyles.heading}>see you tomorrow 🌱</Text>
      <Text style={emailStyles.paragraph}>
        hi {recipientName}, just a heads-up — your <strong>{podName}</strong>{' '}
        hangout is tomorrow at <strong>{sessionTime}</strong>.
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
