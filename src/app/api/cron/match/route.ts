import { NextResponse, type NextRequest } from 'next/server'
import { runMatcher } from '@/lib/matcher/run-matcher'

// give the matcher up to 60s (Vercel cron + admin manual trigger)
export const maxDuration = 60

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('cron/match: CRON_SECRET is not set')
    return NextResponse.json(
      { ok: false, error: 'server misconfigured: CRON_SECRET is not set' },
      { status: 500 }
    )
  }

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; the admin page
  // sends the same header on its manual trigger.
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runMatcher()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('matcher error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    )
  }
}

// Vercel Cron triggers via GET.
export async function GET(request: NextRequest) {
  return handle(request)
}

// The admin page triggers manually via POST.
export async function POST(request: NextRequest) {
  return handle(request)
}
