"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface PoolEntry {
  id: string
  preferred_pod_size: number | null
  available_until: string
  preferred_interests: string[] | null
  cycles_attempted: number | null
  profile: { display_name: string | null; username: string | null } | null
}

export interface RecentPod {
  id: string
  name: string | null
  status: string
  created_at: string
  primary_interest: { name: string | null; emoji: string | null } | null
  pod_members: { profile_id: string }[]
  pod_sessions: { scheduled_for: string; is_first_session: boolean | null }[]
}

interface RunResponse {
  ok?: boolean
  error?: string
  pods_formed?: unknown[]
  users_matched?: number
  users_remaining?: number
  pairs_evaluated?: number
  duration_ms?: number
}

interface Props {
  pool: PoolEntry[]
  pods: RecentPod[]
  cronSecret: string
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function AdminContent({ pool, pods, cronSecret }: Props) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [result, setResult] = useState<RunResponse | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [showWipeConfirm, setShowWipeConfirm] = useState(false)
  const [wiping, setWiping] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const secretMissing = !cronSecret
  const busy = running || resetting || wiping || seeding

  async function runMatcher() {
    setRunning(true)
    setActionError(null)
    setResult(null)
    setActionMessage(null)
    try {
      const res = await fetch('/api/cron/match', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cronSecret}` },
      })
      const json: RunResponse = await res.json()
      if (!res.ok || !json.ok) {
        setActionError(json.error || `matcher failed (HTTP ${res.status})`)
      } else {
        setResult(json)
        router.refresh()
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'request failed')
    } finally {
      setRunning(false)
    }
  }

  async function resetTestPool() {
    setResetting(true)
    setActionError(null)
    setResult(null)
    setActionMessage(null)
    try {
      const res = await fetch('/api/admin/reset-test-pool', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cronSecret}` },
      })
      const json: {
        ok?: boolean
        error?: string
        availabilities_reopened?: number
        pods_deleted?: number
      } = await res.json()
      if (!res.ok || !json.ok) {
        setActionError(json.error || `reset failed (HTTP ${res.status})`)
      } else {
        setActionMessage(
          `reset done — re-opened ${json.availabilities_reopened ?? 0} availabilities, deleted ${json.pods_deleted ?? 0} matcher pods`
        )
        router.refresh()
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'request failed')
    } finally {
      setResetting(false)
    }
  }

  async function reseedCeramicCall() {
    setSeeding(true)
    setActionError(null)
    setResult(null)
    setActionMessage(null)
    try {
      const res = await fetch('/api/admin/reseed-ceramic-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cronSecret}` },
      })
      const json: { ok?: boolean; error?: string; sessionId?: string; podId?: string } =
        await res.json()
      if (!res.ok || !json.ok || !json.sessionId || !json.podId) {
        setActionError(json.error || `reseed failed (HTTP ${res.status})`)
        return
      }
      // jump straight into the freshly-created call
      router.push(`/pods/${json.podId}/session/${json.sessionId}`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'request failed')
    } finally {
      setSeeding(false)
    }
  }

  async function wipePool() {
    setWiping(true)
    setActionError(null)
    setActionMessage(null)
    try {
      const res = await fetch('/api/admin/wipe-pool', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cronSecret}` },
      })
      const json: { ok?: boolean; error?: string; canceled?: number } = await res.json()
      if (!res.ok || !json.ok) {
        setActionError(json.error || `wipe failed (HTTP ${res.status})`)
      } else {
        setActionMessage(`canceled ${json.canceled ?? 0} availabilities`)
        setShowWipeConfirm(false)
        router.refresh()
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'request failed')
    } finally {
      setWiping(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <style>{`
        .chunky { border: 2.5px solid #1F1A3D; box-shadow: 4px 4px 0 0 #1F1A3D; transition: all 0.12s ease; }
        .chunky:hover { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 0 #1F1A3D; }
        .chunky:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 0 #1F1A3D; }
        .chunky:disabled { opacity: 0.5; box-shadow: 2px 2px 0 0 #1F1A3D; cursor: not-allowed; }
      `}</style>

      {/* header */}
      <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h1 className="display" style={{ fontSize: 38 }}>🧪 matcher admin</h1>
        <span
          style={{ background: '#1F1A3D', color: '#FFF6E5', borderRadius: 999, padding: '4px 12px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em' }}
        >
          admin only
        </span>
      </div>
      <a href="/home" style={{ fontWeight: 700, fontSize: 14 }}>← back to home</a>

      {secretMissing ? (
        <div
          className="chunky"
          style={{ background: '#FFE3EE', borderRadius: 12, padding: 16, marginTop: 20 }}
        >
          <strong>CRON_SECRET is not set.</strong> add it to <code>.env.local</code> and restart
          the dev server — the run / reset / wipe buttons need it.
        </div>
      ) : null}

      {/* run matcher */}
      <section
        className="chunky"
        style={{ background: '#FFD23F', borderRadius: 16, padding: 24, marginTop: 24 }}
      >
        <h2 className="display" style={{ fontSize: 24, marginBottom: 6 }}>run the matcher</h2>
        <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 16 }}>
          forms pods from everyone currently in the pool. normally runs every 4 hours.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={runMatcher}
            disabled={busy || secretMissing}
            className="chunky"
            style={{ background: 'white', borderRadius: 12, padding: '10px 20px', fontWeight: 700, fontSize: 15 }}
          >
            {running ? 'running…' : 'run matcher now'}
          </button>
          <button
            onClick={resetTestPool}
            disabled={busy || secretMissing}
            className="chunky"
            style={{ background: '#FFF6E5', borderRadius: 12, padding: '10px 20px', fontWeight: 700, fontSize: 15 }}
          >
            {resetting ? 'resetting…' : '↺ reset test pool'}
          </button>
        </div>
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
          reset re-opens every availability and deletes the pods previous runs created, so you can
          run the matcher again from a clean slate.
        </p>

        {result ? (
          <div
            style={{ marginTop: 16, background: 'white', borderRadius: 12, padding: 14, fontSize: 14 }}
          >
            matched <strong>{result.users_matched ?? 0}</strong> users into{' '}
            <strong>{result.pods_formed?.length ?? 0}</strong> pods, took{' '}
            <strong>{result.duration_ms ?? 0}ms</strong>
            <div style={{ opacity: 0.7, marginTop: 4 }}>
              {result.pairs_evaluated ?? 0} pairs evaluated · {result.users_remaining ?? 0} still
              waiting
            </div>
          </div>
        ) : null}

        {actionError ? (
          <div style={{ marginTop: 16, fontSize: 13, color: '#B00020', fontWeight: 700 }}>
            {actionError}
          </div>
        ) : null}
        {actionMessage ? (
          <div style={{ marginTop: 16, fontSize: 13, color: '#1F7A3D', fontWeight: 700 }}>
            {actionMessage}
          </div>
        ) : null}
      </section>

      {/* ceramic-pod call tester */}
      <section
        className="chunky"
        style={{ background: '#FFE9B8', borderRadius: 16, padding: 20, marginTop: 18 }}
      >
        <h2 className="display" style={{ fontSize: 22, marginBottom: 6 }}>
          🪴 ceramic pod call tester
        </h2>
        <p style={{ fontSize: 13, opacity: 0.85, marginBottom: 14 }}>
          deletes any existing sessions for the ceramic pod (you and maya & sam)
          and creates a fresh &quot;happening now&quot; one, then drops you straight
          into the call. handy for iterating on the video flow.
        </p>
        <button
          onClick={reseedCeramicCall}
          disabled={busy || secretMissing}
          className="chunky"
          style={{
            background: '#6BCB77',
            color: '#1F1A3D',
            borderRadius: 12,
            padding: '10px 20px',
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {seeding ? 'seeding…' : 'reset + open ceramic call'}
        </button>
      </section>

      {/* current pool */}
      <section style={{ marginTop: 32 }}>
        <h2 className="display" style={{ fontSize: 24, marginBottom: 12 }}>
          current pool ({pool.length})
        </h2>
        {pool.length === 0 ? (
          <p style={{ opacity: 0.7, fontSize: 14 }}>nobody is in the pool right now.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pool.map((entry) => (
              <div
                key={entry.id}
                className="chunky"
                style={{ background: 'white', borderRadius: 12, padding: '12px 16px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontWeight: 700 }}>
                    {entry.profile?.display_name || entry.profile?.username || 'unknown user'}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.7 }}>
                    available until {formatDateTime(entry.available_until)}
                  </div>
                </div>
                <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                  wants pod of {entry.preferred_pod_size ?? '—'} ·{' '}
                  {entry.preferred_interests?.length ?? 0} preferred interests · cycles attempted:{' '}
                  {entry.cycles_attempted ?? 0}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* recent pods */}
      <section style={{ marginTop: 32 }}>
        <h2 className="display" style={{ fontSize: 24, marginBottom: 12 }}>
          pods formed (last 24h) ({pods.length})
        </h2>
        {pods.length === 0 ? (
          <p style={{ opacity: 0.7, fontSize: 14 }}>no pods formed in the last 24 hours.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pods.map((pod) => {
              const firstSession =
                pod.pod_sessions.find((s) => s.is_first_session) || pod.pod_sessions[0]
              const label =
                pod.name ||
                (pod.primary_interest?.name ? `${pod.primary_interest.name} pod` : 'pod')
              return (
                <div
                  key={pod.id}
                  className="chunky"
                  style={{ background: 'white', borderRadius: 12, padding: '12px 16px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontWeight: 700 }}>
                      {pod.primary_interest?.emoji ? `${pod.primary_interest.emoji} ` : ''}
                      {label}
                    </div>
                    <a href={`/pods/${pod.id}`} style={{ fontSize: 13, fontWeight: 700 }}>
                      open pod →
                    </a>
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                    {pod.pod_members.length} members · status: {pod.status}
                    {firstSession
                      ? ` · first session ${formatDateTime(firstSession.scheduled_for)}`
                      : ' · no session scheduled'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* danger zone */}
      <section
        style={{ marginTop: 32, marginBottom: 24, border: '2.5px dashed #B00020', borderRadius: 16, padding: 20 }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#B00020', marginBottom: 6 }}>
          danger zone
        </h2>
        <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
          wipe the pool — cancels every open availability. for testing only.
        </p>
        <button
          onClick={() => setShowWipeConfirm(true)}
          disabled={busy || secretMissing}
          className="chunky"
          style={{ background: '#B00020', color: 'white', borderRadius: 12, padding: '8px 16px', fontWeight: 700 }}
        >
          wipe pool
        </button>
      </section>

      {/* wipe confirmation modal */}
      {showWipeConfirm ? (
        <div
          style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', zIndex: 50, padding: 16 }}
        >
          <div
            className="chunky"
            style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 420 }}
          >
            <h3 className="display" style={{ fontSize: 22, marginBottom: 8 }}>wipe the pool?</h3>
            <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 20 }}>
              this cancels all {pool.length} open availabilities. it cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={wipePool}
                disabled={wiping}
                className="chunky"
                style={{ background: '#B00020', color: 'white', borderRadius: 12, padding: '10px 20px', fontWeight: 700 }}
              >
                {wiping ? 'wiping…' : 'yes, wipe it'}
              </button>
              <button
                onClick={() => setShowWipeConfirm(false)}
                disabled={wiping}
                className="chunky"
                style={{ background: 'white', borderRadius: 12, padding: '10px 20px', fontWeight: 700 }}
              >
                cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
