"use client"

import TopNav from '@/components/top-nav'
import PreFirstState from './pre-first-state'
import FeedbackState from './feedback-state'
import ContinuingState from './continuing-state'

export default function PodContent({
  profile,
  pod,
  members,
  sessions,
  currentMember,
  currentUserId,
  threadId,
}: any) {
  const safeMembers = Array.isArray(members) ? members : []
  const safeSessions = Array.isArray(sessions) ? sessions : []

  // pick the lifecycle state
  const isContinuing = pod?.chat_unlocked === true || pod?.status === 'continuing'
  const firstSession = safeSessions.find((s: any) => s.is_first_session) || safeSessions[0] || null
  const firstDone = !!firstSession && (firstSession.status === 'completed' || !!firstSession.ended_at)

  let state: 'continuing' | 'feedback' | 'pre-first'
  if (isContinuing) state = 'continuing'
  else if (firstDone) state = 'feedback'
  else state = 'pre-first'

  return (
    <div>
      <TopNav profile={profile || { id: currentUserId }} />
      <style>{`
        .chunky { border: 2.5px solid #1F1A3D; box-shadow: 4px 4px 0 0 #1F1A3D; transition: all 0.12s ease; }
        .chunky:hover { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 0 #1F1A3D; }
        .chunky:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 0 #1F1A3D; }
        .field { border: 2.5px solid #1F1A3D; background: white; border-radius: 12px; padding: 10px 14px; font-size: 15px; width: 100%; outline: none; }
        .field:focus { box-shadow: 3px 3px 0 0 #1F1A3D; }
        .pod-h2 { font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.16em; color: #1F1A3D; opacity: 0.55; margin: 28px 0 12px; }
      `}</style>

      <div className="max-w-4xl mx-auto p-8">
        {state === 'continuing' && (
          <ContinuingState
            pod={pod}
            members={safeMembers}
            sessions={safeSessions}
            currentUserId={currentUserId}
            podId={pod.id}
            threadId={threadId}
          />
        )}
        {state === 'feedback' && (
          <FeedbackState
            pod={pod}
            members={safeMembers}
            currentMember={currentMember}
            currentUserId={currentUserId}
            podId={pod.id}
          />
        )}
        {state === 'pre-first' && (
          <PreFirstState
            pod={pod}
            members={safeMembers}
            sessions={safeSessions}
            currentUserId={currentUserId}
            podId={pod.id}
          />
        )}
      </div>
    </div>
  )
}
