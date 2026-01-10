import { useState, useEffect, useCallback, useRef } from "react"

interface UseCountdownTimerOptions {
  onComplete?: (setId: string, workoutExerciseId: string) => void
}

interface UseCountdownTimerReturn {
  activeSetId: string | null
  isRunning: boolean
  timeRemaining: number
  duration: number
  start: (setId: string, workoutExerciseId: string, duration: number) => void
  pause: () => void
  resume: () => void
  stop: () => void
  formattedTime: string
  progress: number // 0-100
}

export function useCountdownTimer(
  options: UseCountdownTimerOptions = {}
): UseCountdownTimerReturn {
  const { onComplete } = options

  const [activeSetId, setActiveSetId] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onCompleteRef = useRef(onComplete)
  const activeSetIdRef = useRef<string | null>(null)
  const activeWorkoutExerciseIdRef = useRef<string | null>(null)

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
    (setId: string, workoutExerciseId: string, durationSeconds: number) => {
      clearTimer()
      // Update refs immediately so they're available in the interval callback
      activeSetIdRef.current = setId
      activeWorkoutExerciseIdRef.current = workoutExerciseId
      setActiveSetId(setId)
      setDuration(durationSeconds)
      setTimeRemaining(durationSeconds)
      setIsRunning(true)

      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearTimer()
            setIsRunning(false)
            const completedSetId = activeSetIdRef.current
            const completedWorkoutExerciseId = activeWorkoutExerciseIdRef.current
            activeSetIdRef.current = null
            activeWorkoutExerciseIdRef.current = null
            setActiveSetId(null)
            if (completedSetId && completedWorkoutExerciseId) {
              onCompleteRef.current?.(completedSetId, completedWorkoutExerciseId)
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    },
    [clearTimer]
  )

  const pause = useCallback(() => {
    clearTimer()
    setIsRunning(false)
  }, [clearTimer])

  const resume = useCallback(() => {
    if (timeRemaining > 0 && activeSetIdRef.current) {
      setIsRunning(true)
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearTimer()
            setIsRunning(false)
            const completedSetId = activeSetIdRef.current
            const completedWorkoutExerciseId = activeWorkoutExerciseIdRef.current
            activeSetIdRef.current = null
            activeWorkoutExerciseIdRef.current = null
            setActiveSetId(null)
            if (completedSetId && completedWorkoutExerciseId) {
              onCompleteRef.current?.(completedSetId, completedWorkoutExerciseId)
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
  }, [timeRemaining, clearTimer])

  const stop = useCallback(() => {
    clearTimer()
    setIsRunning(false)
    activeSetIdRef.current = null
    activeWorkoutExerciseIdRef.current = null
    setActiveSetId(null)
    setTimeRemaining(0)
    setDuration(0)
  }, [clearTimer])

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
    activeSetId,
    isRunning,
    timeRemaining,
    duration,
    start,
    pause,
    resume,
    stop,
    formattedTime,
    progress,
  }
}
