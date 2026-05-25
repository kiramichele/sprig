import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { trySendWelcomeEmail } from '@/lib/email/welcome-trigger'

/**
 * Auth callback. Supabase uses two different flows depending on project
 * settings:
 *   - PKCE: link includes `?code=<jwt>` → exchangeCodeForSession
 *   - OTP (default when custom SMTP is on for some templates):
 *       `?token_hash=...&type=email|signup|recovery` → verifyOtp
 * We support both. If neither is present we fall through to the error redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const otpType = searchParams.get('type')
  const next = searchParams.get('next') ?? '/onboarding'

  const supabase = await createClient()
  let sessionOk = false

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    sessionOk = !error
    if (error) console.warn('auth/callback: exchangeCodeForSession failed —', error.message)
  } else if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      // OTP types coming from email links: 'email' | 'signup' | 'recovery' |
      // 'invite' | 'email_change'. Cast keeps this resilient if Supabase
      // adds new variants — verifyOtp validates at runtime anyway.
      type: otpType as 'email' | 'signup' | 'recovery' | 'invite' | 'email_change',
    })
    sessionOk = !error
    if (error) console.warn('auth/callback: verifyOtp failed —', error.message)
  }

  if (sessionOk) {
    // Fire the welcome email. Awaited so it actually runs (a fire-and-forget
    // promise in a serverless function can be terminated when the redirect
    // returns). The send is idempotent — duplicate clicks of the confirm
    // link are no-ops via the email_log unique constraint.
    await trySendWelcomeEmail(supabase, origin)
    return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/login?error=confirm`)
}