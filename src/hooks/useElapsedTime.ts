import { useEffect, useState } from "react"

interface UseElapsedTimeOptions {
  startedAt: string
}

interface UseElapsedTimeReturn {
  formattedTime: string
  elapsedSeconds: number
}

export function useElapsedTime({ startedAt }: UseElapsedTimeOptions): UseElapsedTimeReturn {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    const startTime = new Date(startedAt).getTime()
    
    const updateElapsed = () => {
      const now = Date.now()
      const elapsed = Math.floor((now - startTime) / 1000)
      setElapsedSeconds(elapsed)
    }

    // Update immediately
    updateElapsed()

    // Update every second
    const interval = setInterval(updateElapsed, 1000)

    return () => clearInterval(interval)
  }, [startedAt])

  // Format time as HH:MM:SS or MM:SS
  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60

  const formattedTime = hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes}:${seconds.toString().padStart(2, "0")}`

  return {
    formattedTime,
    elapsedSeconds,
  }
}
