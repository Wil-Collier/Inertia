import { useState, useEffect, useCallback, useRef } from "react"

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

  const [duration, setDuration] = useState(defaultDuration)
  const [timeRemaining, setTimeRemaining] = useState(defaultDuration)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onCompleteRef = useRef(onComplete)

  // Keep callback ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const start = useCallback(
    (customDuration?: number) => {
      clearTimer()
      const time = customDuration ?? duration
      setTimeRemaining(time)
      setIsRunning(true)

      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearTimer()
            setIsRunning(false)
            onCompleteRef.current?.()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    },
    [duration, clearTimer]
  )

  const pause = useCallback(() => {
    clearTimer()
    setIsRunning(false)
  }, [clearTimer])

  const resume = useCallback(() => {
    if (timeRemaining > 0) {
      setIsRunning(true)
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearTimer()
            setIsRunning(false)
            onCompleteRef.current?.()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
  }, [timeRemaining, clearTimer])

  const reset = useCallback(() => {
    clearTimer()
    setIsRunning(false)
    setTimeRemaining(duration)
  }, [duration, clearTimer])

  const handleSetDuration = useCallback((newDuration: number) => {
    setDuration(newDuration)
    setTimeRemaining(newDuration)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [clearTimer])

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
