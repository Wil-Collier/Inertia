import { useEffect, useRef } from "react"
import { syncNow, SYNC_ENABLED } from "@/features/sync/syncEngine"
import { useAuthStore, useSyncStore } from "@/features/sync/runtime/store"
import { refreshPendingCount } from "@/features/sync/tracking/changeTracker"

const DEBOUNCE_MS = 5000

export function useDebouncedPush(): void {
  const pendingCount = useSyncStore((state) => state.pendingCount)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    void refreshPendingCount()
  }, [])

  useEffect(() => {
    if (!SYNC_ENABLED) return
    if (!isAuthenticated) return
    if (pendingCount === 0) return

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = window.setTimeout(() => {
      if (!navigator.onLine) return
      void syncNow()
    }, DEBOUNCE_MS)

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [pendingCount, isAuthenticated])
}
