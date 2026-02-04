import { useEffect } from "react"
import { syncNow, SYNC_ENABLED } from "@/features/sync/syncEngine"
import { useAuthStore } from "@/features/sync/store"

const SYNC_INTERVAL_MS = 5 * 60 * 1000

export function useSyncTriggers(): void {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

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
      if (navigator.onLine) {
        void syncNow()
      }
    }, SYNC_INTERVAL_MS)

    return () => {
      window.removeEventListener("online", handleOnline)
      document.removeEventListener("visibilitychange", handleVisibility)
      window.clearInterval(intervalId)
    }
  }, [isAuthenticated])
}
