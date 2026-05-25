import { Link, Text } from '@react-email/components'
import EmailLayout, { emailStyles } from './_layout'

interface Props {
  recipientName: string
  podName: string
  primaryInterest: string
  memberNames: string[]
  sessionTime: string
  podUrl: string
}

function joinNames(names: string[]): string {
  if (names.length === 0) return 'your new podmates'
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

export default function PodMatchedEmail({
  recipientName,
  podName,
  primaryInterest,
  memberNames,
  sessionTime,
  podUrl,
}: Props) {
  return (
    <EmailLayout preview={`you've been matched into a ${primaryInterest} pod 🌱`}>
      <Text style={emailStyles.heading}>hi {recipientName} 🌱</Text>
      <Text style={emailStyles.paragraph}>
        you&apos;ve been matched into a {primaryInterest} pod with{' '}
        {joinNames(memberNames)}.
      </Text>
      <Text style={emailStyles.paragraph}>
        your first hangout is <strong>{sessionTime}</strong>.
      </Text>
      <Text style={emailStyles.paragraph}>
        <Link href={podUrl} style={emailStyles.button}>
          see your pod →
        </Link>
      </Text>
      <Text style={emailStyles.signoff}>
        see you there! — sprig
        <br />
        <span style={{ opacity: 0.6, fontSize: 12 }}>{podName}</span>
      </Text>
    </EmailLayout>
  )
}
