"use client"

import { useState } from 'react'
import TopNav from '@/components/top-nav'
import IdleState from './idle-state'
import WaitingState from './waiting-state'
import ActiveState from './active-state'
import JoinPoolModal from './join-pool-modal'

export default function HomeContent(props: any) {
  const { profile, status, pods, sessions, availability, showWidenOffer, pendingRequestCount } = props
  const [modalOpen, setModalOpen] = useState(false)
  const safePods = Array.isArray(pods) ? pods : []
  const safeAvailability = Array.isArray(availability) ? availability : []

  const activePodCount = safePods.length
  const openAvailabilityCount = safeAvailability.length

  return (
    <div>
      <TopNav profile={profile} pendingRequestCount={pendingRequestCount} />

      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-8" style={{ background: '#FFF6E5' }}>
        {activePodCount > 0 ? (
          <ActiveState profile={profile} pods={pods} sessions={sessions} onJoin={() => setModalOpen(true)} />
        ) : openAvailabilityCount > 0 ? (
          <WaitingState profile={profile} availability={availability} showWidenOffer={!!showWidenOffer} onCancel={() => window.location.reload()} onJoin={() => setModalOpen(true)} />
        ) : (
          <IdleState profile={profile} onJoin={() => setModalOpen(true)} />
        )}
      </div>

      <JoinPoolModal open={modalOpen} onClose={() => setModalOpen(false)} profile={profile} />
    </div>
  )
}
