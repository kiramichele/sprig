"use client"

import TopNav from '@/components/top-nav'
import BasicInfoSection from './sections/basic-info'
import InterestsSection from './sections/interests'
import FriendshipStyleSection from './sections/friendship-style'
import SensoryPrefsSection from './sections/sensory-prefs'
import AccountSection from './sections/account'

interface CatalogInterest {
  id: string
  name: string
  emoji: string | null
  category: string
}

interface ProfileInterestSelection {
  interest_id: string
  intensity: number
}

interface ProfileShape {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  city: string | null
  photo_url: string | null
}

interface FriendshipStyleShape {
  energy_level: number | null
  communication_pref: number | null
  hangout_frequency: string | null
  seeking: string[] | null
}

interface SensoryShape {
  hide_alcohol_present: boolean | null
  hide_alcohol_centered: boolean | null
  prefers_quiet: boolean | null
  needs_low_mobility: boolean | null
  prefers_smaller_groups: boolean | null
  prefers_video_off_ok: boolean | null
}

interface Props {
  userId: string
  userEmail: string | null
  profile: ProfileShape | null
  interestsCatalog: CatalogInterest[]
  profileInterests: ProfileInterestSelection[]
  friendshipStyle: FriendshipStyleShape | null
  sensoryPrefs: SensoryShape | null
  pendingRequestCount: number
}

export default function SettingsContent({
  userId,
  userEmail,
  profile,
  interestsCatalog,
  profileInterests,
  friendshipStyle,
  sensoryPrefs,
  pendingRequestCount,
}: Props) {
  return (
    <div>
      <TopNav
        profile={profile || { id: userId }}
        pendingRequestCount={pendingRequestCount}
      />
      <style>{`
        .chunky { border:2.5px solid #1F1A3D; box-shadow:4px 4px 0 0 #1F1A3D; transition:all .12s ease; }
        .chunky:hover { transform:translate(-1px,-1px); box-shadow:5px 5px 0 0 #1F1A3D; }
        .chunky:active { transform:translate(2px,2px); box-shadow:1px 1px 0 0 #1F1A3D; }
        .chunky:disabled { opacity:.55; cursor:not-allowed; }
        .field { border:2.5px solid #1F1A3D; background:white; border-radius:12px; padding:10px 14px; font-size:15px; width:100%; outline:none; }
        .field:focus { box-shadow:3px 3px 0 0 #1F1A3D; }
      `}</style>

      <div className="max-w-2xl mx-auto p-8">
        <h1 className="display" style={{ fontSize: 40, marginBottom: 4 }}>settings</h1>
        <p style={{ opacity: 0.8, marginBottom: 24 }}>fine-tune your profile and preferences.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <BasicInfoSection userId={userId} initialProfile={profile} />
          <InterestsSection
            userId={userId}
            catalog={interestsCatalog}
            initialSelections={profileInterests}
          />
          <FriendshipStyleSection userId={userId} initial={friendshipStyle} />
          <SensoryPrefsSection userId={userId} initial={sensoryPrefs} />
          <AccountSection userId={userId} userEmail={userEmail} />
        </div>
      </div>
    </div>
  )
}
