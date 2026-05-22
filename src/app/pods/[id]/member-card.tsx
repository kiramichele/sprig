"use client"

const AVATAR_COLORS = ['#FFD23F', '#6BCB77', '#4D96FF', '#FF6B6B', '#C780E8']

function hash(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

function Avatar({ member, size }: any) {
  const seed = hash(String(member.id || member.display_name || '?'))
  const color = AVATAR_COLORS[seed % AVATAR_COLORS.length]
  const initial = (member.display_name || '?').slice(0, 1).toUpperCase()
  if (member.photo_url) {
    return (
      <img
        src={member.photo_url}
        alt={member.display_name || 'member'}
        style={{ width: size, height: size, borderRadius: 9999, objectFit: 'cover', border: '2.5px solid #1F1A3D', flexShrink: 0 }}
      />
    )
  }
  return (
    <span
      style={{
        width: size, height: size, borderRadius: 9999, background: color,
        border: '2.5px solid #1F1A3D', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontWeight: 700, fontSize: size * 0.4, flexShrink: 0,
      }}
    >
      {initial}
    </span>
  )
}

export default function MemberCard({ member, variant, isYou }: any) {
  const m = member || {}
  const firstName = (m.display_name || 'someone').trim().split(' ')[0]
  const seed = hash(String(m.id || firstName))
  const rotate = (seed % 7) - 3 // -3..3 degrees, for the sticker feel

  if (variant === 'pre-first') {
    return (
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          width: 96, transform: `rotate(${rotate}deg)`,
        }}
      >
        <Avatar member={m} size={64} />
        <div style={{ fontWeight: 700, fontSize: 14, textAlign: 'center' }}>
          {firstName}{isYou ? ' (you)' : ''}
        </div>
      </div>
    )
  }

  // continuing variant — outer keeps the rotation, inner keeps the chunky hover nudge
  const card = (
    <div style={{ transform: `rotate(${rotate}deg)` }}>
      <div
        className="chunky"
        style={{ background: 'white', borderRadius: 14, padding: 16, display: 'flex', gap: 12 }}
      >
        <Avatar member={m} size={56} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>
            {m.display_name || 'someone'}{isYou ? ' (you)' : ''}
          </div>
          {m.city ? <div style={{ fontSize: 13, opacity: 0.7 }}>📍 {m.city}</div> : null}
          {m.bio ? <div style={{ fontSize: 13, marginTop: 4 }}>{m.bio}</div> : null}
        </div>
      </div>
    </div>
  )

  const href = isYou ? '/profile' : m.username ? `/profile/${m.username}` : null
  if (href) {
    return (
      <a href={href} style={{ display: 'block', textDecoration: 'none', color: 'inherit', width: 280, maxWidth: '100%' }}>
        {card}
      </a>
    )
  }
  return <div style={{ width: 280, maxWidth: '100%' }}>{card}</div>
}
