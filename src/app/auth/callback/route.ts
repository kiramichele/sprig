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
      // Fire the welcome email. We AWAIT it intentionally — in a serverless
      // function the runtime is allowed to suspend after the response is
      // sent, so a fire-and-forget promise often never completes. The send
      // adds ~300-700ms to a one-time email-confirm callback that the user
      // already expects to feel like a small pause. Email failures must not
      // block the redirect, hence the try/catch around the whole thing.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb: any = supabase
        const { data: userData } = await sb.auth.getUser()
        const user = userData?.user
        if (user) {
          // Profile probably doesn't exist yet (onboarding is what creates
          // it). The welcome template handles a null name gracefully.
          const { data: profile } = await sb
            .from('profiles')
            .select('display_name')
            .eq('id', user.id)
            .maybeSingle()
          const result = await sendNotificationEmail({
            recipientId: user.id,
            emailType: 'welcome',
            contextId: user.id,
            subject: 'welcome to sprig 🌱',
            template: WelcomeEmail({
              recipientName: profile?.display_name ?? null,
              homeUrl: `${origin}/home`,
            }),
          })
          if (!result.sent && result.reason !== 'already sent') {
            console.error('auth/callback: welcome email not sent —', result.reason)
          }
        }
      } catch (err) {
        console.error('auth/callback: welcome email failed —', err)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirm`)
}