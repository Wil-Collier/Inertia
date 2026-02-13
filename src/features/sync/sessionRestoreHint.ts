const SESSION_RESTORE_HINT_KEY = "inertia-sync-session-hint"

export function shouldAttemptSessionRestore(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(SESSION_RESTORE_HINT_KEY) === "1"
}

export function markSessionRestoreEligible(): void {
  if (typeof window === "undefined") return
  localStorage.setItem(SESSION_RESTORE_HINT_KEY, "1")
}

export function clearSessionRestoreHint(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(SESSION_RESTORE_HINT_KEY)
}
