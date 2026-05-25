/**
 * Server-only helper for sending transactional emails via Resend.
 *
 * - Respects per-user notification_preferences (an opted-out user gets a no-op
 *   with reason='user opted out', not a send).
 * - Uses email_log as an idempotency claim: we INSERT first (unique on
 *   recipient_id + email_type + context_id) and only call Resend if the insert
 *   succeeds. A duplicate insert (23505) means we've already sent this exact
 *   email — the call is a no-op. If Resend fails, the log row is rolled back so
 *   a retry can succeed.
 *
 * NEVER import this from a Client Component — it uses the service role.
 */
import { Resend } from 'resend'
import { render } from '@react-email/components'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ReactElement } from 'react'

export type EmailType =
  | 'pod_matched'
  | 'session_reminder_24h'
  | 'session_reminder_1h'
  | 'session_starting_now'
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'pod_chat_unlocked'

interface SendEmailParams {
  recipientId: string
  emailType: EmailType
  contextId: string
  subject: string
  template: ReactElement
}

interface SendEmailResult {
  sent: boolean
  reason?: string
}

type NotificationPrefKey =
  | 'email_pod_matched'
  | 'email_session_reminders'
  | 'email_friend_requests'
  | 'email_pod_chat_unlocked'

const PREF_BY_TYPE: Record<EmailType, NotificationPrefKey> = {
  pod_matched: 'email_pod_matched',
  session_reminder_24h: 'email_session_reminders',
  session_reminder_1h: 'email_session_reminders',
  session_starting_now: 'email_session_reminders',
  friend_request_received: 'email_friend_requests',
  friend_request_accepted: 'email_friend_requests',
  pod_chat_unlocked: 'email_pod_chat_unlocked',
}

export async function sendNotificationEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    console.error('sendNotificationEmail: RESEND_API_KEY or EMAIL_FROM not set')
    return { sent: false, reason: 'email service not configured' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  const { data: recipient, error: recipientError } = await supabase
    .from('profiles')
    .select('id, deleted_at')
    .eq('id', params.recipientId)
    .single()
  if (recipientError || !recipient || recipient.deleted_at) {
    return { sent: false, reason: 'recipient not found or deactivated' }
  }

  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
    params.recipientId
  )
  if (authError || !authUser?.user?.email) {
    return { sent: false, reason: 'no email on file' }
  }
  const toEmail: string = authUser.user.email

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select(
      'email_pod_matched, email_session_reminders, email_friend_requests, email_pod_chat_unlocked'
    )
    .eq('profile_id', params.recipientId)
    .maybeSingle()

  const prefKey = PREF_BY_TYPE[params.emailType]
  if (prefs && prefKey && prefs[prefKey] === false) {
    return { sent: false, reason: 'user opted out' }
  }

  const html = await render(params.template)

  const { error: logError } = await supabase.from('email_log').insert({
    recipient_id: params.recipientId,
    recipient_email: toEmail,
    email_type: params.emailType,
    context_id: params.contextId,
  })
  if (logError) {
    if (logError.code === '23505') {
      return { sent: false, reason: 'already sent' }
    }
    return { sent: false, reason: `log insert failed: ${logError.message}` }
  }

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from,
      to: toEmail,
      subject: params.subject,
      html,
    })

    if (result.error) {
      throw new Error(result.error.message || 'resend send failed')
    }

    if (result.data?.id) {
      await supabase
        .from('email_log')
        .update({ provider_message_id: result.data.id })
        .eq('recipient_id', params.recipientId)
        .eq('email_type', params.emailType)
        .eq('context_id', params.contextId)
    }
    return { sent: true }
  } catch (err) {
    // Roll back the log claim so the next attempt can re-try this exact send.
    await supabase
      .from('email_log')
      .delete()
      .eq('recipient_id', params.recipientId)
      .eq('email_type', params.emailType)
      .eq('context_id', params.contextId)
    const msg = err instanceof Error ? err.message : 'send failed'
    console.error('sendNotificationEmail: resend failed —', msg)
    return { sent: false, reason: msg }
  }
}

/**
 * Absolute URL builder for email links. Email clients can't resolve relative
 * URLs, so every link must be absolute. Order of precedence:
 *   1. NEXT_PUBLIC_APP_URL (preferred — set this in Vercel)
 *   2. VERCEL_URL (Vercel sets this on preview/prod deployments)
 *   3. localhost fallback for `npm run dev`
 */
export function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000'
  const trimmed = base.replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${trimmed}${suffix}`
}
