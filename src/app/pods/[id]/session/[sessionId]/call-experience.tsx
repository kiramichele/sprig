"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DailyAudio, DailyProvider, useCallObject, useDaily, useDailyEvent } from '@daily-co/daily-react'
import { createClient } from '@/lib/supabase/client'
import type {
  AdvanceAction,
  JoinResponse,
  PodSessionState,
  SessionMember,
} from '@/lib/session/types'
import Lobby from './lobby'
import InCall from './in-call'
import WrapUp from './wrap-up'

interface CurrentUser {
  id: string
  display_name: string
  photo_url: string | null
}

interface Props {
  sessionId: string
  podId: string
  podName: string
  podEmoji: string
  members: SessionMember[]
  currentUser: CurrentUser
}

// Stable options object so useCallObject doesn't recreate the call each render.
const CALL_OBJECT_OPTIONS = {}

const GLOBAL_STYLE = `
  .chunky { border:2.5px solid #1F1A3D; box-shadow:4px 4px 0 0 #1F1A3D; transition:all .12s ease; }
  .chunky:hover { transform:translate(-1px,-1px); box-shadow:5px 5px 0 0 #1F1A3D; }
  .chunky:active { transform:translate(2px,2px); box-shadow:1px 1px 0 0 #1F1A3D; }
  .chunky:disabled { opacity:.55; cursor:not-allowed; }
  .pod-h2 { font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:.16em; opacity:.55; margin:8px 0 10px; }
`

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
        color: '#1F1A3D',
      }}
    >
      <div style={{ maxWidth: 420 }}>{children}</div>
    </div>
  )
}

/**
 * Top-level call component. Creates the Daily call object via `useCallObject`
 * (the React-lifecycle-safe wrapper around DailyIframe.createCallObject) and
 * provides it to the rest of the tree.
 */
export default function CallExperience(props: Props) {
  const callObject = useCallObject(CALL_OBJECT_OPTIONS)

  return (
    <DailyProvider callObject={callObject}>
      <style>{GLOBAL_STYLE}</style>
      <CallRunner {...props} />
    </DailyProvider>
  )
}

function CallRunner({ sessionId, podId, podName, podEmoji, members, currentUser }: Props) {
  const router = useRouter()
  const daily = useDaily()

  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [joinData, setJoinData] = useState<JoinResponse | null>(null)
  const [sessionState, setSessionState] = useState<PodSessionState | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [ending, setEnding] = useState(false)
  const [endError, setEndError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const endedHandled = useRef(false)

  // Join: hit the join endpoint, then join the Daily room.
  useEffect(() => {
    if (!daily) return
    let cancelled = false

    async function start(call: NonNullable<typeof daily>) {
      setStatus('connecting')
      setErrorMsg(null)
      try {
        const res = await fetch(`/api/sessions/${sessionId}/join`, { method: 'POST' })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error || `join failed (HTTP ${res.status})`)
        }
        const data = (await res.json()) as JoinResponse
        if (cancelled) return
        setJoinData(data)
        setSessionState(data.session_state)

        const meetingState = call.meetingState()
        if (meetingState === 'new' || meetingState === 'left-meeting') {
          await call.join({
            url: data.room_url,
            userName: currentUser.display_name,
            userData: { profile_id: currentUser.id },
          })
        }
        if (!cancelled) setStatus('ready')
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'could not connect')
          setStatus('error')
        }
      }
    }

    start(daily)
    return () => {
      cancelled = true
    }
  }, [daily, sessionId, currentUser.display_name, currentUser.id, retryKey])

  // Keep every client in sync with the shared deck (current card, round,
  // speaker, call_phase). Two layers, because realtime can silently fail for
  // reasons that aren't user-visible (publication not picked up, RLS denying
  // the subscriber, websocket stripped by a proxy):
  //   1. Supabase realtime — instant updates when it works.
  //   2. Polling fallback every 3s — catches anything realtime missed, so
  //      "next card" always lands on every screen within a couple seconds.
  // The realtime subscription remains so updates feel instant on the happy
  // path; polling is the belt-and-suspenders.
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`session-state-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pod_session_state',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setSessionState(payload.new as unknown as PodSessionState)
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('session-state realtime', status, err)
        }
      })

    let stopped = false
    const POLL_MS = 3000
    async function poll() {
      if (stopped) return
      try {
        const { data, error } = await supabase
          .from('pod_session_state')
          .select('*')
          .eq('session_id', sessionId)
          .single()
        if (!stopped && !error && data) {
          // Use the most recent updated_at as the freshness check so a stale
          // poll result never clobbers a fresher realtime update.
          setSessionState((prev) => {
            if (!prev) return data as unknown as PodSessionState
            const next = data as unknown as PodSessionState
            const prevAt = new Date(prev.updated_at).getTime()
            const nextAt = new Date(next.updated_at).getTime()
            return nextAt > prevAt ? next : prev
          })
        }
      } catch {
        /* best-effort */
      }
    }
    const interval = setInterval(poll, POLL_MS)

    return () => {
      stopped = true
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  // Once the call has ended, send everyone to the pod's feedback page. Tear
  // down Daily explicitly first so the room-destroyed event from the end-route
  // doesn't surface as an unhandled "Meeting has ended" error.
  useEffect(() => {
    if (sessionState?.call_phase === 'ended' && !endedHandled.current) {
      endedHandled.current = true
      daily?.leave().catch(() => {})
      router.push(`/pods/${podId}`)
    }
  }, [sessionState?.call_phase, podId, router, daily])

  // Belt-and-suspenders: if Daily reports we've truly left the meeting AFTER
  // we successfully joined (typically because someone else ended the call and
  // the room is now gone), route out cleanly. We gate on status === 'ready'
  // so a transient blip during the initial connect doesn't bounce us back to
  // the pod page before we've even seen the lobby.
  useDailyEvent('left-meeting', () => {
    if (status !== 'ready') return
    if (!endedHandled.current) {
      endedHandled.current = true
      router.push(`/pods/${podId}`)
    }
  })

  // Daily fires 'error' events for plenty of non-fatal conditions — camera or
  // mic permission denied, slow track negotiation, codec warnings, transient
  // websocket reconnects. Only the events flagged `fatal: true` are
  // terminal. Logging the rest keeps them from surfacing as unhandled, but
  // we DO NOT navigate away — the user keeps their place and can retry
  // permissions or wait for the reconnect.
  useDailyEvent('error', (event) => {
    // event shape: { action: 'error', errorMsg, error?: { type?, msg?, fatal? } }
    const ev = event as unknown as {
      fatal?: boolean
      error?: { fatal?: boolean; type?: string }
      errorMsg?: string
    }
    const fatal = ev.fatal === true || ev.error?.fatal === true
    if (!fatal) {
      console.warn('daily non-fatal error (staying in call):', event)
      return
    }
    console.error('daily fatal error — leaving call:', event)
    if (!endedHandled.current) {
      endedHandled.current = true
      router.push(`/pods/${podId}`)
    }
  })

  // Advance the shared deck. Retries once silently before surfacing an error.
  const advance = useCallback(
    async (action: AdvanceAction) => {
      setAdvancing(true)
      try {
        let lastError: unknown = null
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const res = await fetch(`/api/sessions/${sessionId}/advance`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action }),
            })
            if (!res.ok) {
              const body = (await res.json().catch(() => ({}))) as { error?: string }
              throw new Error(body.error || `advance failed (HTTP ${res.status})`)
            }
            const data = (await res.json()) as { session_state: PodSessionState }
            setSessionState(data.session_state)
            lastError = null
            break
          } catch (err) {
            lastError = err
          }
        }
        if (lastError) console.error('advance failed:', lastError)
      } finally {
        setAdvancing(false)
      }
    },
    [sessionId]
  )

  // Manual leave from the in-call bar: tear down Daily and route back to the
  // pod page. The 'left-meeting' handler above will short-circuit since we set
  // endedHandled before navigating.
  const leaveCall = useCallback(() => {
    if (endedHandled.current) return
    endedHandled.current = true
    daily?.leave().catch(() => {})
    router.push(`/pods/${podId}`)
  }, [daily, router, podId])

  const endCall = useCallback(async () => {
    setEnding(true)
    setEndError(null)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/end`, { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `end failed (HTTP ${res.status})`)
      }
      // Leave Daily cleanly before navigating so we don't get a stray
      // "meeting ended" error from the room-destroyed event.
      try {
        await daily?.leave()
      } catch {
        /* best-effort */
      }
      router.push(`/pods/${podId}`)
    } catch (err) {
      setEndError(err instanceof Error ? err.message : 'could not end the call')
      setEnding(false)
    }
  }, [sessionId, podId, router, daily])

  if (status === 'error') {
    return (
      <CenteredMessage>
        <div style={{ fontSize: 40, marginBottom: 8 }}>📡</div>
        <h1 className="display" style={{ fontSize: 26, marginBottom: 8 }}>
          having trouble connecting to video
        </h1>
        <p style={{ opacity: 0.8, marginBottom: 18, fontSize: 14 }}>
          {errorMsg || 'something got in the way.'}
        </p>
        <button
          onClick={() => setRetryKey((k) => k + 1)}
          className="chunky"
          style={{ background: '#FFD23F', borderRadius: 12, padding: '10px 22px', fontWeight: 700, color: '#1F1A3D' }}
        >
          try again
        </button>
      </CenteredMessage>
    )
  }

  if (status === 'connecting' || !joinData || !sessionState) {
    return (
      <CenteredMessage>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🌱</div>
        <p style={{ fontWeight: 700 }}>warming up the room…</p>
      </CenteredMessage>
    )
  }

  const phase = sessionState.call_phase

  return (
    <>
      <DailyAudio />
      {phase === 'lobby' ? (
        <Lobby
          members={members}
          currentUserId={currentUser.id}
          callStartedAt={sessionState.call_started_at}
          onBegin={() => advance('begin')}
          beginning={advancing}
        />
      ) : phase === 'in_progress' ? (
        <InCall
          members={members}
          currentUserId={currentUser.id}
          sessionState={sessionState}
          rounds={joinData.prompt_rounds}
          cards={joinData.prompt_cards}
          advancing={advancing}
          onAdvance={advance}
          onLeave={leaveCall}
          podName={podName}
          podEmoji={podEmoji}
        />
      ) : phase === 'wrap_up' ? (
        <WrapUp
          sessionState={sessionState}
          rounds={joinData.prompt_rounds}
          cards={joinData.prompt_cards}
          onEnd={endCall}
          ending={ending}
          endError={endError}
        />
      ) : (
        <CenteredMessage>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✨</div>
          <p style={{ fontWeight: 700 }}>wrapping up…</p>
        </CenteredMessage>
      )}
    </>
  )
}
