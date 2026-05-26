"use client"

import TopNav from '@/components/top-nav'

export type Relationship = 'self' | 'friend' | 'shared_pod' | 'stranger'

export interface ProfileView {
  id: string
  username: string
  display_name: string | null
  photo_url: string | null
  bio: string | null
  city: string | null
}

export interface ProfileInterest {
  intensity: number
  interest: { id: string; name: string; emoji: string | null } | null
}

interface ViewerProfile {
  id: string
  display_name?: string | null
  photo_url?: string | null
  username?: string | null
}

interface Props {
  viewerProfile: ViewerProfile
  pendingRequestCount: number
  profile: ProfileView
  relationship: Relationship
  friendshipId: string | null
  sharedPodName: string | null
  interests: ProfileInterest[]
}

export default function ProfileContent({
  viewerProfile,
  pendingRequestCount,
  profile,
  relationship,
  friendshipId,
  sharedPodName,
  interests,
}: Props) {
  const initial = (profile.display_name || profile.username || '?').slice(0, 1).toUpperCase()
  const isStranger = relationship === 'stranger'

  return (
    <div>
      <TopNav profile={viewerProfile} pendingRequestCount={pendingRequestCount} />
      <style>{`
        .chunky { border:2.5px solid #1F1A3D; box-shadow:4px 4px 0 0 #1F1A3D; transition:all .12s ease; }
        .chunky:hover { transform:translate(-1px,-1px); box-shadow:5px 5px 0 0 #1F1A3D; }
        .chunky:active { transform:translate(2px,2px); box-shadow:1px 1px 0 0 #1F1A3D; }
        .pod-h2 { font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:.16em; color:#1F1A3D; opacity:.55; margin:28px 0 12px; }
      `}</style>

      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        {/* header — photo above content on mobile, side-by-side on tablet+ */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 sm:items-start flex-wrap">
          <div style={{ flexShrink: 0 }}>
            {profile.photo_url ? (
              <img
                src={profile.photo_url}
                alt={profile.display_name || profile.username}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 9999,
                  objectFit: 'cover',
                  border: '3px solid #1F1A3D',
                  boxShadow: '4px 4px 0 0 #1F1A3D',
                }}
              />
            ) : (
              <span
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 9999,
                  background: '#FFD23F',
                  border: '3px solid #1F1A3D',
                  boxShadow: '4px 4px 0 0 #1F1A3D',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 48,
                  color: '#1F1A3D',
                }}
              >
                {initial}
              </span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h1 className="display" style={{ fontSize: 36 }}>
                  {profile.display_name || 'someone'}
                </h1>
                <div style={{ fontSize: 14, opacity: 0.65 }}>@{profile.username}</div>
              </div>

              {relationship === 'self' ? (
                <a
                  href="/settings"
                  className="chunky"
                  style={{
                    background: '#FFD23F',
                    color: '#1F1A3D',
                    borderRadius: 12,
                    padding: '8px 16px',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  edit profile
                </a>
              ) : null}
              {relationship === 'friend' && friendshipId ? (
                <a
                  href={`/messages/${friendshipId}`}
                  className="chunky"
                  style={{
                    background: '#4D96FF',
                    color: '#1F1A3D',
                    borderRadius: 12,
                    padding: '8px 16px',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  open chat
                </a>
              ) : null}
              {relationship === 'shared_pod' && sharedPodName ? (
                <span
                  className="chunky"
                  style={{
                    background: '#6BCB77',
                    color: '#1F1A3D',
                    borderRadius: 999,
                    padding: '6px 12px',
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  you met in {sharedPodName}
                </span>
              ) : null}
            </div>

            {profile.bio ? (
              <p style={{ fontSize: 15, marginTop: 12 }}>{profile.bio}</p>
            ) : null}

            {isStranger ? (
              <p style={{ fontSize: 13, opacity: 0.7, marginTop: 12 }}>
                you haven&apos;t met yet. friendships start in pods.
              </p>
            ) : null}
          </div>
        </div>

        {/* city (visible if not stranger) */}
        {!isStranger && profile.city ? (
          <p style={{ fontSize: 14, opacity: 0.7, marginTop: 16 }}>📍 {profile.city}</p>
        ) : null}

        {/* interests (visible if not stranger) */}
        {!isStranger && interests.length > 0 ? (
          <>
            <div className="pod-h2">interests</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {interests.map((pi, i) =>
                pi.interest ? (
                  <div
                    key={pi.interest.id || i}
                    className="chunky"
                    style={{
                      background: 'white',
                      borderRadius: 999,
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{pi.interest.emoji || '🌱'}</span>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{pi.interest.name}</span>
                    <span style={{ fontSize: 11, letterSpacing: '0.18em', opacity: 0.55 }}>
                      {'●'.repeat(Math.max(0, Math.min(5, pi.intensity)))}
                      {'○'.repeat(Math.max(0, Math.min(5, 5 - pi.intensity)))}
                    </span>
                  </div>
                ) : null
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
