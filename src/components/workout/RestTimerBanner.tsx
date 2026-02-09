import { memo, useCallback } from "react"
import { Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRestTimer } from "@/hooks/useRestTimer"
import { playDingSound } from "@/lib/audio"

interface RestTimerBannerProps {
  defaultDuration: number
}

/**
 * Rest timer display component that isolates high-frequency re-renders.
 * This component updates every 100ms when the timer is running,
 * but doesn't cause re-renders in parent components.
 */
function RestTimerBannerInner({ defaultDuration }: RestTimerBannerProps) {
  const handleComplete = useCallback(() => {
    void playDingSound()
  }, [])

  const timer = useRestTimer({
    defaultDuration,
    onComplete: handleComplete,
  })

  if (!timer.isRunning) {
    return null
  }

  return (
    <div className="border-t border-border bg-primary/5 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <span className="font-mono text-lg font-bold">
            {timer.formattedTime}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={timer.isPaused ? timer.resume : timer.pause}
          >
            {timer.isPaused ? "Resume" : "Pause"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => timer.start(timer.timeRemaining + 30)}
          >
            +30s
          </Button>
          <Button size="sm" variant="ghost" onClick={timer.reset}>
            Skip
          </Button>
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${timer.progress}%` }}
        />
      </div>
    </div>
  )
}

export const RestTimerBanner = memo(RestTimerBannerInner)

