import { useEffect, useCallback, useRef, useState } from "react"
import { useRestTimerStore } from "@/stores/restTimerStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { showRestTimerNotification, canShowNotifications, vibrateDevice } from "@/services/notifications"

interface UseRestTimerOptions {
  defaultDuration?: number // seconds
  onComplete?: () => void
}

interface UseRestTimerReturn {
  isRunning: boolean
  timeRemaining: number
  duration: number
  start: (customDuration?: number) => void
  pause: () => void
  resume: () => void
  reset: () => void
  setDuration: (duration: number) => void
  formattedTime: string
  progress: number // 0-100
}

export function useRestTimer(options: UseRestTimerOptions = {}): UseRestTimerReturn {
  const { defaultDuration = 90, onComplete } = options

  const store = useRestTimerStore()
  const { settings } = useSettingsStore()
  const { timer } = store
  const onCompleteRef = useRef(onComplete)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  
  // Local state for display updates (triggers re-renders on tick)
  const [, forceUpdate] = useState(0)
  
  // Track the duration setting separately (for when timer is not running)
  const [configuredDuration, setConfiguredDuration] = useState(defaultDuration)

  // Keep callback ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  // Set up interval for ticking the timer
  useEffect(() => {
    if (timer.isRunning && !timer.isPaused) {
      intervalRef.current = setInterval(() => {
        const remaining = store.getTimeRemaining()
        
        if (remaining <= 0) {
          store.reset()
          
          // Show notification if enabled
          if (settings.areNotificationsEnabled && canShowNotifications()) {
            showRestTimerNotification()
          }
          
          // Vibrate device for haptic feedback
          vibrateDevice([200, 100, 200])
          
          onCompleteRef.current?.()
        }
        
        // Force re-render to update display
        forceUpdate((n) => n + 1)
      }, 100) // Update more frequently for smoother display
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [timer.isRunning, timer.isPaused, store, settings.areNotificationsEnabled])

  const start = useCallback(
    (customDuration?: number) => {
      const time = customDuration ?? configuredDuration
      store.start(time)
    },
    [configuredDuration, store]
  )

  const pause = useCallback(() => {
    store.pause()
  }, [store])

  const resume = useCallback(() => {
    store.resume()
  }, [store])

  const reset = useCallback(() => {
    store.reset()
  }, [store])

  const handleSetDuration = useCallback((newDuration: number) => {
    setConfiguredDuration(newDuration)
  }, [])

  // Calculate current time remaining
  const timeRemaining = store.getTimeRemaining()
  const duration = timer.isRunning ? timer.duration : configuredDuration
  
  // Timer is considered "running" for UI purposes if it's active (even if paused)
  const isRunning = timer.isRunning && timeRemaining > 0

  // Format time as MM:SS
  const formattedTime = `${Math.floor(timeRemaining / 60)
    .toString()
    .padStart(2, "0")}:${(timeRemaining % 60).toString().padStart(2, "0")}`

  // Progress percentage (100 = full, 0 = empty)
  const progress = duration > 0 ? (timeRemaining / duration) * 100 : 0

  return {
    isRunning,
    timeRemaining,
    duration,
    start,
    pause,
    resume,
    reset,
    setDuration: handleSetDuration,
    formattedTime,
    progress,
  }
}
