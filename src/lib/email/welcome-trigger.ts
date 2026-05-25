/**
 * Welcome-email trigger, factored out so multiple entry points can call it.
 *
 * Two callers today:
 *   1. /auth/callback — fires the moment email is confirmed (the happy path).
 *   2. /onboarding/page — safety net for cases where Supabase's email-confirm
 *      flow bypassed the callback entirely (e.g. the confirm link goes
 *      directly to Supabase's verify endpoint with a different redirect_to).
 *
 * Idempotent: email_log's unique constraint on
 * (recipient_id, email_type, context_id) — with contextId=user.id — means
 * every user gets exactly one welcome email no matter how many times this
 * runs. Repeat calls are cheap no-ops.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { appUrl, sendNotificationEmail } from './send'
import WelcomeEmail from './templates/welcome'

export async function trySendWelcomeEmail(
  // The user-scoped supabase client — used only to read display_name and the
  // current user id. The actual send goes through the admin client inside
  // sendNotificationEmail.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  // Optional origin override (e.g. from a request URL) — falls back to
  // NEXT_PUBLIC_APP_URL via appUrl(), which is what server components without
  // a request must use.
  origin?: string
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabase
    const { data: userData } = await sb.auth.getUser()
    const user = userData?.user
    if (!user) return

    // Profile may not exist yet (pre-onboarding) — that's fine, template
    // falls back to "friend" when display_name is null.
    const { data: profile } = await sb
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()

    const homeUrl = origin ? `${origin.replace(/\/+$/, '')}/home` : appUrl('/home')

    const result = await sendNotificationEmail({
      recipientId: user.id,
      emailType: 'welcome',
      contextId: user.id,
      subject: 'welcome to sprig 🌱',
      template: WelcomeEmail({
        recipientName: profile?.display_name ?? null,
        homeUrl,
      }),
    })

    if (!result.sent && result.reason !== 'already sent') {
      console.error('welcome email not sent —', result.reason)
    }
  } catch (err) {
    console.error('welcome email failed —', err)
  }
}
