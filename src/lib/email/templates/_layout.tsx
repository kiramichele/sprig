/**
 * Shared wrapper for every Sprig transactional email.
 *
 * Email clients are hostile to modern CSS — we use the React Email primitives
 * (which inline styles) and the tiny brand palette from the rest of the app.
 * Web fonts don't load reliably in email so we stick to a system serif for the
 * wordmark and a system sans for the body.
 */
import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { ReactNode } from 'react'
import { appUrl } from '../send'

interface Props {
  preview: string
  children: ReactNode
}

const COLOR_BG = '#FFF6E5'
const COLOR_TEXT = '#1F1A3D'
const COLOR_ACCENT = '#FF6B9D'
const FONT_SERIF = 'Georgia, "Times New Roman", serif'
const FONT_SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif'

const mainStyle = {
  backgroundColor: COLOR_BG,
  fontFamily: FONT_SANS,
  color: COLOR_TEXT,
  margin: 0,
  padding: '24px 12px',
}

const containerStyle = {
  backgroundColor: '#ffffff',
  border: `2px solid ${COLOR_TEXT}`,
  borderRadius: '14px',
  maxWidth: '560px',
  margin: '0 auto',
  padding: '28px 28px 24px',
}

const wordmarkStyle = {
  fontFamily: FONT_SERIF,
  fontSize: '28px',
  fontWeight: 700,
  color: COLOR_TEXT,
  margin: 0,
  marginBottom: '20px',
  letterSpacing: '-0.5px',
}

const footerStyle = {
  fontFamily: FONT_SANS,
  fontSize: '12px',
  color: '#666666',
  textAlign: 'center' as const,
  marginTop: '24px',
  lineHeight: '1.5',
}

const linkStyle = {
  color: COLOR_ACCENT,
  textDecoration: 'underline',
}

export default function EmailLayout({ preview, children }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={mainStyle}>
        <Container style={containerStyle}>
          <Text style={wordmarkStyle}>sprig 🌱</Text>
          <Section>{children}</Section>
        </Container>
        <Text style={footerStyle}>
          you got this email because you have an active sprig account.
          <br />
          <Link href={appUrl('/settings')} style={linkStyle}>
            manage notification preferences
          </Link>
        </Text>
      </Body>
    </Html>
  )
}

/** Shared style tokens so templates can stay consistent without duplicating. */
export const emailStyles = {
  heading: {
    fontFamily: FONT_SERIF,
    fontSize: '22px',
    fontWeight: 700,
    margin: '0 0 12px',
    color: COLOR_TEXT,
  },
  paragraph: {
    fontFamily: FONT_SANS,
    fontSize: '15px',
    lineHeight: '1.55',
    color: COLOR_TEXT,
    margin: '0 0 14px',
  },
  button: {
    display: 'inline-block',
    backgroundColor: COLOR_ACCENT,
    color: '#ffffff',
    fontFamily: FONT_SANS,
    fontWeight: 700,
    fontSize: '15px',
    padding: '12px 22px',
    border: `2px solid ${COLOR_TEXT}`,
    borderRadius: '10px',
    textDecoration: 'none',
    marginTop: '6px',
    marginBottom: '6px',
  },
  signoff: {
    fontFamily: FONT_SANS,
    fontSize: '14px',
    color: COLOR_TEXT,
    marginTop: '18px',
    marginBottom: 0,
  },
  quote: {
    fontFamily: FONT_SANS,
    fontSize: '15px',
    fontStyle: 'italic' as const,
    color: COLOR_TEXT,
    borderLeft: `3px solid ${COLOR_TEXT}`,
    paddingLeft: '12px',
    margin: '12px 0 14px',
  },
  accent: COLOR_ACCENT,
}
