"use client"

import { DailyVideo, useActiveSpeakerId, useParticipantProperty } from '@daily-co/daily-react'

interface Props {
  /** Daily participant session id. */
  participantId: string
  isLocal?: boolean
  size?: number
  /** Sticker-style rotation in degrees. */
  rotate?: number
}

/**
 * One participant's video, rendered sticker-style: rotated, bordered, with a
 * name tag, a mute indicator, and a green pulse when they're the active speaker.
 */
export default function VideoTile({ participantId, isLocal = false, size = 130, rotate = 0 }: Props) {
  const userName = useParticipantProperty(participantId, 'user_name')
  const audioOn = useParticipantProperty(participantId, 'audio')
  const videoOn = useParticipantProperty(participantId, 'video')
  const activeSpeakerId = useActiveSpeakerId()

  const speaking = activeSpeakerId === participantId && Boolean(audioOn)
  const name = isLocal ? 'you' : userName || 'guest'
  const initial = (name || '?').slice(0, 1).toUpperCase()

  return (
    <div style={{ width: size, transform: `rotate(${rotate}deg)`, flexShrink: 0 }}>
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: 16,
          overflow: 'hidden',
          border: '3px solid #1F1A3D',
          background: '#2A2540',
          boxShadow: speaking
            ? '0 0 0 4px #6BCB77, 5px 5px 0 0 #1F1A3D'
            : '4px 4px 0 0 #1F1A3D',
          transition: 'box-shadow 0.15s ease',
        }}
      >
        {videoOn ? (
          <DailyVideo
            sessionId={participantId}
            type="video"
            automirror={isLocal}
            fit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: size * 0.32,
            }}
          >
            {initial}
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            bottom: 6,
            left: 6,
            background: 'white',
            border: '2px solid #1F1A3D',
            borderRadius: 999,
            padding: '1px 8px',
            fontSize: 11,
            fontWeight: 700,
            maxWidth: size - 14,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </div>

        {!audioOn ? (
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              background: '#B00020',
              borderRadius: 999,
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
            }}
            title="muted"
          >
            🔇
          </div>
        ) : null}
      </div>
    </div>
  )
}
