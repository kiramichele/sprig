"use client"

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDebouncedSave } from '@/lib/use-debounced-save'
import SaveStatus from './save-status'

const TOGGLES = [
  {
    key: 'email_pod_matched',
    title: 'Pod matches',
    helper: "let me know when I've been matched into a new pod.",
  },
  {
    key: 'email_session_reminders',
    title: 'Session reminders',
    helper: '24h and 1h before each pod session, plus one at the start.',
  },
  {
    key: 'email_friend_requests',
    title: 'Friend requests',
    helper: 'when someone sends me one or accepts mine.',
  },
  {
    key: 'email_pod_chat_unlocked',
    title: 'Pod chat unlocks',
    helper: 'when a pod transitions to continuing and the chat opens.',
  },
] as const

type ToggleKey = (typeof TOGGLES)[number]['key']

interface InitialPrefs {
  email_pod_matched: boolean | null
  email_session_reminders: boolean | null
  email_friend_requests: boolean | null
  email_pod_chat_unlocked: boolean | null
}

interface Props {
  userId: string
  initial: InitialPrefs | null
}

export default function NotificationsSection({ userId, initial }: Props) {
  const [state, setState] = useState<Record<ToggleKey, boolean>>(() => ({
    email_pod_matched: initial?.email_pod_matched ?? true,
    email_session_reminders: initial?.email_session_reminders ?? true,
    email_friend_requests: initial?.email_friend_requests ?? true,
    email_pod_chat_unlocked: initial?.email_pod_chat_unlocked ?? true,
  }))

  const valuesKey = useMemo(() => JSON.stringify(state), [state])

  const { status, error } = useDebouncedSave(valuesKey, async (key) => {
    const v = JSON.parse(key) as Record<ToggleKey, boolean>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase: any = createClient()
    const { error: upsertError } = await supabase
      .from('notification_preferences')
      .upsert({ profile_id: userId, ...v }, { onConflict: 'profile_id' })
    if (upsertError) throw new Error(upsertError.message)
  })

  function toggle(key: ToggleKey) {
    setState((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <section className="chunky" style={{ background: 'white', borderRadius: 16, padding: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <h2 className="display" style={{ fontSize: 24 }}>notifications</h2>
        <SaveStatus status={status} errorMessage={error} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TOGGLES.map((t) => (
          <label
            key={t.key}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: 10,
              border: '1.5px solid rgba(0,0,0,0.08)',
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={state[t.key]}
              onChange={() => toggle(t.key)}
              style={{ marginTop: 4 }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t.title}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{t.helper}</div>
            </div>
          </label>
        ))}
      </div>
    </section>
  )
}
