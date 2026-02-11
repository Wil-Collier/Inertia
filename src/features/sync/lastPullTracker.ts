/**
 * Shared mutable timestamp tracking the last pull from the server.
 *
 * Updated by the orchestrator after every successful pull so that
 * `useSyncTriggers` can skip redundant interval polls.
 */
export const lastPullTimestamp = { value: 0 }
