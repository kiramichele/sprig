/**
 * Shared definitions for the user-availability picker.
 *
 * 21 slot tokens: 7 days × 3 time-of-day windows. Each window resolves to a
 * canonical "center" hour in the user's local timezone (set per-profile).
 * The matcher uses these to find a first-session time the whole pod can make.
 */

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export const WINDOWS = ['morning', 'afternoon', 'evening'] as const

export type Day = (typeof DAYS)[number]
export type Window = (typeof WINDOWS)[number]
export type SlotToken = `${Day}_${Window}`

/** Friendlier labels for UI rendering. */
export const DAY_LABEL: Record<Day, string> = {
  mon: 'mon',
  tue: 'tue',
  wed: 'wed',
  thu: 'thu',
  fri: 'fri',
  sat: 'sat',
  sun: 'sun',
}

export const WINDOW_LABEL: Record<Window, string> = {
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
}

/** Canonical hour each window centers on (in the user's local TZ). */
export const WINDOW_HOUR: Record<Window, number> = {
  morning: 10,
  afternoon: 14,
  evening: 19,
}

/** ISO weekday number: 1=Mon ... 7=Sun. */
const DAY_TO_ISO: Record<Day, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
}

export const ALL_SLOTS: SlotToken[] = DAYS.flatMap((d) =>
  WINDOWS.map((w) => `${d}_${w}` as SlotToken)
)

/** Sensible starter pick used as a default in onboarding / settings. */
export const DEFAULT_SLOTS: SlotToken[] = ['sat_evening', 'sun_evening']

export function parseSlot(token: string): { day: Day; window: Window } | null {
  const [d, w] = token.split('_')
  if (!d || !w) return null
  if (!(DAYS as readonly string[]).includes(d)) return null
  if (!(WINDOWS as readonly string[]).includes(w)) return null
  return { day: d as Day, window: w as Window }
}

/**
 * Intersection of multiple availability sets. Returns the slots EVERY member
 * has selected. Empty array if any one member has no slots at all.
 */
export function intersectSlots(perMember: SlotToken[][]): SlotToken[] {
  if (perMember.length === 0) return []
  if (perMember.some((set) => set.length === 0)) return []
  const counts = new Map<SlotToken, number>()
  for (const set of perMember) {
    const seen = new Set<SlotToken>()
    for (const s of set) {
      if (seen.has(s)) continue
      seen.add(s)
      counts.set(s, (counts.get(s) || 0) + 1)
    }
  }
  const result: SlotToken[] = []
  for (const [slot, count] of counts) {
    if (count === perMember.length) result.push(slot)
  }
  return result
}

/* ----------------------------- Date math ------------------------------- */

/** What part of an instant looks like in a given timezone. */
interface ZonedParts {
  year: number
  month: number // 1-12
  day: number   // 1-31
  weekday: number // ISO 1=Mon ... 7=Sun
  hour: number
}

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    weekday: 'short',
  })
  const field: Record<string, string> = {}
  for (const p of fmt.formatToParts(instant)) {
    if (p.type !== 'literal') field[p.type] = p.value
  }
  const weekdayMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  }
  const hour = field.hour === '24' ? 0 : Number(field.hour)
  return {
    year: Number(field.year),
    month: Number(field.month),
    day: Number(field.day),
    weekday: weekdayMap[field.weekday] ?? 7,
    hour,
  }
}

/**
 * UTC instant for a given local wall-clock time + timezone. DST-correct via
 * a two-pass offset solve (same approach as the matcher's existing Eastern
 * helper).
 */
function utcForLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string
): Date {
  let instant = new Date(Date.UTC(year, month - 1, day, hour, 0, 0))
  for (let i = 0; i < 2; i++) {
    const probeParts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(instant)
    const f: Record<string, string> = {}
    for (const p of probeParts) if (p.type !== 'literal') f[p.type] = p.value
    const probeHour = f.hour === '24' ? 0 : Number(f.hour)
    const asIfUtc = Date.UTC(
      Number(f.year),
      Number(f.month) - 1,
      Number(f.day),
      probeHour,
      Number(f.minute),
      Number(f.second)
    )
    const offset = asIfUtc - instant.getTime()
    instant = new Date(Date.UTC(year, month - 1, day, hour, 0, 0) - offset)
  }
  return instant
}

/**
 * Next UTC instant matching the slot in the given timezone. Skips any
 * occurrence in the past (relative to `now`).
 *
 * Example: nextOccurrence('sat_evening', new Date(), 'America/Los_Angeles')
 * returns the next Saturday 7:00 PM Pacific.
 */
export function nextOccurrence(
  slot: SlotToken,
  timeZone: string,
  now: Date = new Date()
): Date | null {
  const parsed = parseSlot(slot)
  if (!parsed) return null
  const targetIsoDow = DAY_TO_ISO[parsed.day]
  const targetHour = WINDOW_HOUR[parsed.window]

  const here = zonedParts(now, timeZone)

  // Days forward (0 = today). Same day with hour in the future is still valid.
  let daysAhead = (targetIsoDow - here.weekday + 7) % 7
  if (daysAhead === 0 && here.hour >= targetHour) daysAhead = 7

  // Calendar date in the user's TZ for the target occurrence.
  const baseUtcDate = new Date(Date.UTC(here.year, here.month - 1, here.day) + daysAhead * 86_400_000)

  return utcForLocal(
    baseUtcDate.getUTCFullYear(),
    baseUtcDate.getUTCMonth() + 1,
    baseUtcDate.getUTCDate(),
    targetHour,
    timeZone
  )
}

/**
 * Given a set of slots and a timezone, pick the soonest upcoming instance.
 * Returns null if no slots resolve (empty list or all invalid).
 */
export function soonestUpcoming(
  slots: SlotToken[],
  timeZone: string,
  now: Date = new Date()
): { slot: SlotToken; at: Date } | null {
  let best: { slot: SlotToken; at: Date } | null = null
  for (const s of slots) {
    const at = nextOccurrence(s, timeZone, now)
    if (!at) continue
    if (!best || at.getTime() < best.at.getTime()) {
      best = { slot: s, at }
    }
  }
  return best
}
