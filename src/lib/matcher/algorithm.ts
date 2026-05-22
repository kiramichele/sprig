import type { PoolUser, Pair, Pod } from './types'

// Tunable thresholds for pod formation.
const SEED_FLOOR = 30 // a seed pair must score at least this to start a pod
const GROW_FLOOR = 40 // an added member must score at least this with every member
const MIN_POD = 3
const MAX_POD = 5

/** Stable key for a pair of user ids — always the smaller id first. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Forms pods of 3–5 people from a pool of waiting users and their pairwise
 * compatibility scores. Pure function — no database access.
 *
 * Algorithm (greedy, seed-and-grow):
 *  1. Index every pair by `pairKey` for O(1) score lookups.
 *  2. Walk pairs from highest score to lowest. Each unused, above-floor pair
 *     becomes a *seed* — the first two members of a candidate pod.
 *  3. Grow the seed: gather every other unmatched user that scores at least
 *     `GROW_FLOOR` with *both* seeds, preferring the candidate whose weakest
 *     link to the seeds is strongest (guards against lopsided matches). Add
 *     candidates one by one, each time re-checking they clear `GROW_FLOOR`
 *     against *every* existing member, until the pod hits its target size.
 *  4. Target size is the rounded average of the two seeds' preferred sizes,
 *     clamped to 3–5.
 *  5. A pod with fewer than 3 members is abandoned (its users stay free to
 *     seed or join a later pod). Otherwise it is finalized: average pairwise
 *     score, most-common shared interest (alphabetical tie-break), and the
 *     members' availability ids.
 *
 * Returns the list of formed pods. Returns `[]` for an empty pool, a pool
 * smaller than 3, or when no pair clears the compatibility floor.
 *
 * Deterministic: the same pool and pair set always yield the same pods —
 * every sort uses a total order, with ties broken by id.
 */
export function formPods(pool: PoolUser[], pairs: Pair[]): Pod[] {
  if (pool.length < MIN_POD) return []

  // 1. pair-score lookup
  const pairScoreMap = new Map<string, Pair>()
  for (const pair of pairs) {
    pairScoreMap.set(pairKey(pair.user_a, pair.user_b), pair)
  }

  // 2. user-prefs lookup
  const userPrefs = new Map<string, PoolUser>()
  for (const user of pool) {
    userPrefs.set(user.profile_id, user)
  }

  // 3. highest scores first. Tie-break by ids so this is a *total* order —
  //    the same pairs always sort the same way regardless of input order.
  const sortedPairs = [...pairs].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.user_a !== b.user_a) return a.user_a < b.user_a ? -1 : 1
    if (a.user_b !== b.user_b) return a.user_b < b.user_b ? -1 : 1
    return 0
  })

  const matched = new Set<string>()
  const formedPods: Pod[] = []

  /** Score between two users, or null if no pair exists. */
  const scoreBetween = (a: string, b: string): number | null => {
    const pair = pairScoreMap.get(pairKey(a, b))
    return pair ? pair.score : null
  }

  // 6. consider each pair as a potential seed, strongest first
  for (const seed of sortedPairs) {
    const seedA = seed.user_a
    const seedB = seed.user_b

    if (matched.has(seedA) || matched.has(seedB)) continue
    if (seed.score < SEED_FLOOR) continue

    const prefsA = userPrefs.get(seedA)
    const prefsB = userPrefs.get(seedB)
    // a pair may reference a user no longer in the pool — skip it
    if (!prefsA || !prefsB) continue

    const pod: string[] = [seedA, seedB]

    // target size: average of both preferences, clamped to 3–5
    const targetSize = Math.min(
      MAX_POD,
      Math.max(
        MIN_POD,
        Math.round((prefsA.preferred_pod_size + prefsB.preferred_pod_size) / 2)
      )
    )

    // gather candidates that clear GROW_FLOOR with BOTH seeds
    const candidates: { id: string; weakestLink: number }[] = []
    for (const user of pool) {
      const id = user.profile_id
      if (id === seedA || id === seedB) continue
      if (matched.has(id)) continue

      const withA = scoreBetween(id, seedA)
      const withB = scoreBetween(id, seedB)
      if (withA === null || withB === null) continue
      if (withA < GROW_FLOOR || withB < GROW_FLOOR) continue

      candidates.push({ id, weakestLink: Math.min(withA, withB) })
    }

    // strongest weakest-link first — protects against asymmetric matches.
    // Tie-break by id so the candidate order is a total order (deterministic).
    candidates.sort((x, y) => {
      if (y.weakestLink !== x.weakestLink) return y.weakestLink - x.weakestLink
      return x.id < y.id ? -1 : x.id > y.id ? 1 : 0
    })

    // grow the pod one member at a time
    for (const candidate of candidates) {
      if (pod.length >= targetSize) break
      const clearsEveryMember = pod.every((member) => {
        const score = scoreBetween(candidate.id, member)
        return score !== null && score >= GROW_FLOOR
      })
      if (clearsEveryMember) pod.push(candidate.id)
    }

    // too small — abandon, leaving the seed users free for later pods
    if (pod.length < MIN_POD) continue

    // finalize: collect every internal pair
    const podPairs: Pair[] = []
    for (let i = 0; i < pod.length; i++) {
      for (let j = i + 1; j < pod.length; j++) {
        const pair = pairScoreMap.get(pairKey(pod[i], pod[j]))
        if (pair) podPairs.push(pair)
      }
    }

    const averageScore = podPairs.length
      ? podPairs.reduce((sum, pair) => sum + pair.score, 0) / podPairs.length
      : 0

    // primary interest: most frequent shared interest, alphabetical tie-break
    const interestCounts = new Map<string, number>()
    for (const pair of podPairs) {
      for (const interest of pair.shared_interests) {
        interestCounts.set(interest, (interestCounts.get(interest) ?? 0) + 1)
      }
    }
    let primaryInterest: string | null = null
    let bestCount = 0
    for (const [interest, count] of interestCounts) {
      const wins =
        count > bestCount ||
        (count === bestCount && primaryInterest !== null && interest < primaryInterest)
      if (wins) {
        primaryInterest = interest
        bestCount = count
      }
    }

    const availabilityIds = pod.map((id) => {
      const prefs = userPrefs.get(id)
      return prefs ? prefs.availability_id : ''
    })

    formedPods.push({
      members: [...pod],
      primary_interest: primaryInterest,
      average_score: averageScore,
      availability_ids: availabilityIds,
    })
    for (const id of pod) matched.add(id)
  }

  return formedPods
}
