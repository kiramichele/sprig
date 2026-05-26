/**
 * Cron-driven sender for session reminder emails.
 *
 * Runs every 15 minutes (see vercel.json). On each run we pull three windows:
 *   - 24h:    [now+23h45m, now+24h15m]
 *   - 1h:     [now+45m,    now+75m]
 *   - now:    [now-5m,     now+5m]
 *
 * The windows are wider than the cron interval so a paused or delayed cron
 * still catches every session exactly once. Idempotency is enforced by the
 * unique constraint on email_log(recipient_id, email_type, context_id) — sending
 * twice in overlapping windows results in a no-op on the second pass.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotificationEmail, appUrl } from '@/lib/email/send'
import SessionReminder24hEmail from '@/lib/email/templates/session-reminder-24h'
import SessionReminder1hEmail from '@/lib/email/templates/session-reminder-1h'
import SessionStartingNowEmail from '@/lib/email/templates/session-starting-now'
import type { EmailType } from '@/lib/email/send'

export const maxDuration = 60

const DEFAULT_TZ = 'America/New_York'

/** Format a UTC timestamp in the recipient's timezone — they should see
 *  "7:00 PM PST" not "10:00 PM EST" if they're in Pacific time. */
function formatSessionTime(iso: string, tz: string | null | undefined): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: tz || DEFAULT_TZ,
  })
  return fmt.format(new Date(iso))
}

interface SessionRow {
  id: string
  pod_id: string
  scheduled_for: string
  pods: {
    name: string | null
    primary_interest: { name: string | null } | null
  } | null
}

interface MemberRow {
  profile_id: string
  profile: { display_name: string | null; timezone: string | null } | null
}

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('cron/session-reminders: CRON_SECRET is not set')
    return NextResponse.json(
      { ok: false, error: 'server misconfigured: CRON_SECRET is not set' },
      { status: 500 }
    )
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = createAdminClient()
  const now = Date.now()

  const windows: Array<{
    kind: EmailType
    from: string
    to: string
    subject: (podName: string) => string
    template: (args: {
      recipientName: string
      podName: string
      sessionTime: string
      podUrl: string
      callUrl: string
    }) => ReturnType<typeof SessionReminder24hEmail>
  }> = [
    {
      kind: 'session_reminder_24h',
      from: new Date(now + (23 * 60 + 45) * 60 * 1000).toISOString(),
      to: new Date(now + (24 * 60 + 15) * 60 * 1000).toISOString(),
      subject: () => 'your sprig pod meets tomorrow 🌱',
      template: ({ recipientName, podName, sessionTime, podUrl }) =>
        SessionReminder24hEmail({ recipientName, podName, sessionTime, podUrl }),
    },
    {
      kind: 'session_reminder_1h',
      from: new Date(now + 45 * 60 * 1000).toISOString(),
      to: new Date(now + 75 * 60 * 1000).toISOString(),
      subject: () => 'your pod meets in about an hour',
      template: ({ recipientName, podName, sessionTime, podUrl }) =>
        SessionReminder1hEmail({ recipientName, podName, sessionTime, podUrl }),
    },
    {
      kind: 'session_starting_now',
      from: new Date(now - 5 * 60 * 1000).toISOString(),
      to: new Date(now + 5 * 60 * 1000).toISOString(),
      subject: () => 'your pod is starting now',
      template: ({ recipientName, podName, callUrl }) =>
        SessionStartingNowEmail({ recipientName, podName, callUrl }),
    },
  ]

  const counts = { reminders_24h: 0, reminders_1h: 0, starting_now: 0 }
  const errors: string[] = []

  for (const win of windows) {
    const { data: sessions, error: sErr } = await db
      .from('pod_sessions')
      .select(
        'id, pod_id, scheduled_for, pods:pod_id(name, primary_interest:interests(name))'
      )
      .eq('status', 'scheduled')
      .gte('scheduled_for', win.from)
      .lt('scheduled_for', win.to)
    if (sErr) {
      console.error(`cron/session-reminders: ${win.kind} query failed —`, sErr)
      errors.push(`${win.kind}: ${sErr.message}`)
      continue
    }
    const rows = (sessions as SessionRow[] | null) || []

    for (const session of rows) {
      try {
        // Include timezone per member so each recipient sees the session
        // time in their own zone.
        const { data: members } = await db
          .from('pod_members')
          .select('profile_id, profile:profiles(display_name, timezone)')
          .eq('pod_id', session.pod_id)
          .is('left_at', null)

        const interestName = session.pods?.primary_interest?.name || null
        const podName =
          session.pods?.name ||
          (interestName ? `${interestName} pod` : 'your sprig pod')
        const podUrl = appUrl(`/pods/${session.pod_id}`)
        const callUrl = appUrl(`/pods/${session.pod_id}/session/${session.id}`)

        for (const m of (members as MemberRow[] | null) || []) {
          const recipientName =
            (m.profile?.display_name || 'friend').split(' ')[0]
          const sessionTime = formatSessionTime(session.scheduled_for, m.profile?.timezone ?? null)
          try {
            const result = await sendNotificationEmail({
              recipientId: m.profile_id,
              emailType: win.kind,
              contextId: session.id,
              subject: win.subject(podName),
              template: win.template({
                recipientName,
                podName,
                sessionTime,
                podUrl,
                callUrl,
              }),
            })
            if (result.sent) {
              if (win.kind === 'session_reminder_24h') counts.reminders_24h++
              else if (win.kind === 'session_reminder_1h') counts.reminders_1h++
              else if (win.kind === 'session_starting_now') counts.starting_now++
            }
          } catch (emailErr) {
            const msg = emailErr instanceof Error ? emailErr.message : 'send failed'
            errors.push(`${win.kind}/${session.id}/${m.profile_id}: ${msg}`)
            console.error('cron/session-reminders: email failed —', emailErr)
          }
        }
      } catch (sessErr) {
        errors.push(
          `${win.kind}/${session.id}: ${
            sessErr instanceof Error ? sessErr.message : 'session loop failed'
          }`
        )
        console.error('cron/session-reminders: session loop failed —', sessErr)
      }
    }
  }

  return NextResponse.json({ ok: true, ...counts, errors })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
