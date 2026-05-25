import { Link, Text } from '@react-email/components'
import EmailLayout, { emailStyles } from './_layout'

interface Props {
  /**
   * The recipient's display name if it exists. Welcome email fires right
   * after email confirmation, BEFORE onboarding, so this is almost always
   * null — we fall back to "friend".
   */
  recipientName: string | null
  homeUrl: string
}

const stepStyle = {
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  fontSize: '15px',
  lineHeight: '1.55',
  color: '#1F1A3D',
  margin: '0 0 10px',
} as const

export default function WelcomeEmail({ recipientName, homeUrl }: Props) {
  const name = recipientName?.split(' ')[0] || 'friend'
  return (
    <EmailLayout preview="welcome to sprig 🌱">
      <Text style={emailStyles.heading}>hi {name} —</Text>
      <Text style={emailStyles.paragraph}>
        welcome to sprig. so glad you&apos;re here.
      </Text>
      <Text style={emailStyles.paragraph}>
        sprig is a quiet little place for finding new friends through small
        group video calls. here&apos;s what to expect:
      </Text>
      <Text style={stepStyle}>
        <strong>1.</strong> finish your profile — pick your interests and what
        you&apos;re looking for in a friend.
      </Text>
      <Text style={stepStyle}>
        <strong>2.</strong> tell us when you&apos;re free — we&apos;ll match
        you into a small pod (3-5 people) around shared interests.
      </Text>
      <Text style={stepStyle}>
        <strong>3.</strong> meet on a guided 30-minute video call — we&apos;ll
        have prompts ready so the conversation flows.
      </Text>
      <Text style={emailStyles.paragraph}>
        no swiping. no pressure. you only continue meeting if everyone in the
        group wants to.
      </Text>
      <Text style={emailStyles.paragraph}>ready to get started?</Text>
      <Text style={emailStyles.paragraph}>
        <Link href={homeUrl} style={emailStyles.button}>
          jump in →
        </Link>
      </Text>
      <Text style={emailStyles.signoff}>
        see you in there,
        <br />
        the sprig team 🌱
      </Text>
    </EmailLayout>
  )
}
