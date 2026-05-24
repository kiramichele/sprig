"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import MemberCard from './member-card'
import SessionCard from './session-card'
import PodChat from './pod-chat'
import ProposeSessionModal from './propose-session-modal'
import ProposedSessionCard from './proposed-session-card'
import type { ProposedSession } from '@/lib/scheduling/types'

export default function ContinuingState({ pod, members, sessions, proposals, currentUserId, podId, threadId }: any) {
  const router = useRouter()
  // capture "now" once at mount so render stays pure (react-hooks/purity)
  const [now] = useState(() => Date.now())
  // profile_id -> friendship row with the current user (for the friend buttons)
  const [friendships, setFriendships] = useState<Record<string, any>>({})
  const [showProposeModal, setShowProposeModal] = useState(false)

  useEffect(() => {
    const otherIds = (members || [])
      .map((m: any) => m.profile_id)
      .filter((id: string) => id && id !== currentUserId)
    if (!otherIds.length) return

    let active = true
    const supabase = createClient()
    async function load() {
      const { data, error } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, status')
        .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`)
      if (!active || error || !data) return
      const map: Record<string, any> = {}
      for (const f of data) {
        const other = f.requester_id === currentUserId ? f.addressee_id : f.requester_id
        if (otherIds.includes(other)) map[other] = f
      }
      setFriendships(map)
    }
    load()
    return () => {
      active = false
    }
  }, [members, currentUserId])

  // Realtime: any new proposal on this pod (or status change) should rehydrate
  // the page so the new card / promotion appears for everyone.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`pod-sessions-${podId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pod_sessions', filter: `pod_id=eq.${podId}` },
        () => router.refresh()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [podId, router])

  const emoji = pod?.primary_interest?.emoji || '🌱'
  const name = pod?.name || (pod?.primary_interest?.name ? `${pod.primary_interest.name} pod` : 'your pod')

  const upcoming = (sessions || [])
    .filter((s: any) => s.status === 'scheduled' && new Date(s.scheduled_for).getTime() > now)
    .sort((a: any, b: any) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())
  const next = upcoming[0] || null

  // Default for the propose modal: the most recent completed session, so users
  // can land on the same day/time one week later.
  const completedTimes: string[] = (sessions || [])
    .filter((s: { status: string }) => s.status === 'completed')
    .map((s: { scheduled_for: string }) => s.scheduled_for)
    .sort()
  const lastCompletedAt = completedTimes.length ? completedTimes[completedTimes.length - 1] : null

  const proposalList: ProposedSession[] = (proposals || []) as ProposedSession[]

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <h1 className="display" style={{ fontSize: 40 }}>{name} {emoji}</h1>
        <span style={{ background: '#6BCB77', border: '2.5px solid #1F1A3D', borderRadius: 999, padding: '2px 12px', fontWeight: 700, fontSize: 13 }}>
          continuing
        </span>
      </div>
      <p style={{ opacity: 0.8, marginBottom: 8 }}>your clubhouse — chat, plan, and keep meeting up.</p>

      {proposalList.length > 0 ? (
        <>
          <div className="pod-h2">
            {proposalList.length === 1 ? 'open proposal' : 'open proposals'}
          </div>
          {proposalList.map((p) => (
            <ProposedSessionCard
              key={p.id}
              session={p}
              currentUserId={currentUserId}
              podMembers={members}
            />
          ))}
        </>
      ) : null}

      <div className="pod-h2">next session</div>
      {next ? (
        <SessionCard session={next} podId={podId} />
      ) : (
        <div className="chunky" style={{ background: 'white', borderRadius: 14, padding: 16 }}>
          {proposalList.length > 0
            ? 'nothing locked in yet — rsvp above to confirm.'
            : 'no session scheduled yet — propose a time below.'}
        </div>
      )}
      <button
        onClick={() => setShowProposeModal(true)}
        className="chunky"
        style={{ marginTop: 12, background: 'white', borderRadius: 12, padding: '8px 16px', fontWeight: 700 }}
      >
        + propose new session
      </button>

      <div className="pod-h2">your pod</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {members.map((m: any) => (
          <MemberCard
            key={m.profile_id}
            member={m.profile}
            variant="continuing"
            isYou={m.profile_id === currentUserId}
            podId={podId}
            currentUserId={currentUserId}
            existingFriendship={friendships[m.profile_id] ?? null}
          />
        ))}
      </div>

      <div className="pod-h2">pod chat</div>
      <PodChat threadId={threadId} currentUserId={currentUserId} members={members} />

      {showProposeModal ? (
        <ProposeSessionModal
          podId={podId}
          lastSessionAt={lastCompletedAt}
          onClose={() => setShowProposeModal(false)}
          onProposed={() => {
            setShowProposeModal(false)
            router.refresh()
          }}
        />
      ) : null}
    </section>
  )
}
