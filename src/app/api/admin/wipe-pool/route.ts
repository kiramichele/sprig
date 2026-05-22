import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Testing helper: cancels every open availability, emptying the matching pool.
 * Protected with the same Bearer CRON_SECRET as the cron endpoint.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('admin/wipe-pool: CRON_SECRET is not set')
    return NextResponse.json(
      { ok: false, error: 'server misconfigured: CRON_SECRET is not set' },
      { status: 500 }
    )
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('matching_availability')
      .update({ status: 'canceled' })
      .eq('status', 'open')
      .select('id')
    if (error) throw error

    return NextResponse.json({ ok: true, canceled: data?.length ?? 0 })
  } catch (error) {
    console.error('wipe-pool error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return handle(request)
}
