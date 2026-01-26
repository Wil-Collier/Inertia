import { memo } from "react"
import { useElapsedTime } from "@/hooks/useElapsedTime"

interface WorkoutTimerProps {
  startedAt: string
  className?: string
}

export const WorkoutTimer = memo(function WorkoutTimer({ startedAt, className }: WorkoutTimerProps) {
  const { formattedTime } = useElapsedTime({ startedAt })

  return (
    <span className={className}>
      {formattedTime}
    </span>
  )
})
