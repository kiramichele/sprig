import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendNotificationEmail } from '@/lib/email/send'
import WelcomeEmail from '@/lib/email/templates/welcome'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/onboarding'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Fire the welcome email best-effort. Email failures must not block
      // the redirect — and the email_log unique constraint on
      // (recipient_id, email_type, context_id) makes this a no-op for any
      // user who's already received it (e.g. clicking the confirm link twice).
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb: any = supabase
        const { data: userData } = await sb.auth.getUser()
        const user = userData?.user
        if (user) {
          // Profile probably doesn't exist yet (onboarding is what creates
          // it), but if it does we'll use the name for a warmer greeting.
          const { data: profile } = await sb
            .from('profiles')
            .select('display_name')
            .eq('id', user.id)
            .maybeSingle()
          // Don't await — let the email send in the background so the user
          // doesn't sit on the callback while Resend responds.
          sendNotificationEmail({
            recipientId: user.id,
            emailType: 'welcome',
            contextId: user.id,
            subject: 'welcome to sprig 🌱',
            template: WelcomeEmail({
              recipientName: profile?.display_name ?? null,
              homeUrl: `${origin}/home`,
            }),
          }).catch((err) => {
            console.error('auth/callback: welcome email failed —', err)
          })
        }
      } catch (err) {
        console.error('auth/callback: welcome email setup failed —', err)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirm`)
}