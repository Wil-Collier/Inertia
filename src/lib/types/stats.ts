/**
 * Incrementally tracked workout statistics.
 * Updated on each workout mutation instead of recalculating from scratch.
 */
export interface UserStats {
  /** Total number of completed workout sessions */
  totalWorkouts: number
  /** Total volume lifted in lbs (normalized for consistent achievement thresholds) */
  totalVolumeLbs: number
  /** Timestamp of last stats update */
  lastUpdated: string
}

/**
 * Default/initial stats for new users
 */
export const defaultUserStats: UserStats = {
  totalWorkouts: 0,
  totalVolumeLbs: 0,
  lastUpdated: new Date().toISOString(),
}
