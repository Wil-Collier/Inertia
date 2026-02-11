import { useEffect, useRef } from "react"
import { syncNow, SYNC_ENABLED } from "@/features/sync/syncEngine"
import { useAuthStore } from "@/features/sync/store"
import { useRouterState } from "@tanstack/react-router"
import { lastPullTimestamp } from "@/features/sync/lastPullTracker"

const SYNC_INTERVAL_MS = 30 * 1000

export function useSyncTriggers(): void {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const locationKey = useRouterState({ select: (s) => s.location.pathname })
  const prevLocationRef = useRef(locationKey)

  useEffect(() => {
    if (!SYNC_ENABLED) return
    if (!isAuthenticated) return

    void syncNow()

    const handleOnline = () => {
      void syncNow()
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncNow()
      }
    }

    window.addEventListener("online", handleOnline)
    document.addEventListener("visibilitychange", handleVisibility)

    const intervalId = window.setInterval(() => {
      if (!navigator.onLine) return
      if (Date.now() - lastPullTimestamp.value < SYNC_INTERVAL_MS) return
      void syncNow()
    }, SYNC_INTERVAL_MS)

    return () => {
      window.removeEventListener("online", handleOnline)
      document.removeEventListener("visibilitychange", handleVisibility)
      window.clearInterval(intervalId)
    }
  }, [isAuthenticated])

  // Pull on route change
  useEffect(() => {
    if (!SYNC_ENABLED) return
    if (!isAuthenticated) return
    if (prevLocationRef.current === locationKey) return

    prevLocationRef.current = locationKey
    void syncNow()
  }, [locationKey, isAuthenticated])
}
