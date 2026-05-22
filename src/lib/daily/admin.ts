// Server-only helper for the Daily.co REST API. Never import from a client component.

const DAILY_API = 'https://api.daily.co/v1'

interface DailyRoom {
  url: string
  name: string
}

function dailyHeaders(): Record<string, string> {
  const apiKey = process.env.DAILY_API_KEY
  if (!apiKey) throw new Error('DAILY_API_KEY is not set')
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Returns the Daily room for a session, creating it if it doesn't exist.
 * Room name is `sprig-{sessionId}`; the room expires 2 hours out.
 */
export async function getOrCreateDailyRoom(sessionId: string): Promise<DailyRoom> {
  const name = `sprig-${sessionId}`
  const headers = dailyHeaders()

  const createRes = await fetch(`${DAILY_API}/rooms`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name,
      properties: {
        exp: Math.floor(Date.now() / 1000) + 2 * 60 * 60, // 2 hours
        max_participants: 6,
        enable_chat: false,
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  })

  if (createRes.ok) {
    const room = (await createRes.json()) as DailyRoom
    return { url: room.url, name: room.name }
  }

  // Most likely the room already exists (409 / duplicate) — fetch it instead.
  const getRes = await fetch(`${DAILY_API}/rooms/${name}`, { headers })
  if (getRes.ok) {
    const room = (await getRes.json()) as DailyRoom
    return { url: room.url, name: room.name }
  }

  const detail = await createRes.text().catch(() => '')
  throw new Error(`Daily room create/get failed (${createRes.status}): ${detail}`)
}

/** Deletes a Daily room. A 404 (already gone) is treated as success. */
export async function deleteDailyRoom(name: string): Promise<void> {
  const res = await fetch(`${DAILY_API}/rooms/${name}`, {
    method: 'DELETE',
    headers: dailyHeaders(),
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(`Daily room delete failed (${res.status})`)
  }
}
