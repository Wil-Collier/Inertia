import { WorkoutTimer } from "./WorkoutTimer"

interface WorkoutProgressSummaryProps {
  completedSets: number
  totalSets: number
  startedAt: string
  exerciseCount: number
}

export function WorkoutProgressSummary({
  completedSets,
  totalSets,
  startedAt,
  exerciseCount,
}: WorkoutProgressSummaryProps) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
      <div>
        <p className="text-sm text-muted-foreground">Progress</p>
        <p className="font-medium">
          {completedSets} / {totalSets} sets
        </p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Elapsed</p>
        <p className="font-medium font-mono">
          <WorkoutTimer startedAt={startedAt} />
        </p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Exercises</p>
        <p className="font-medium">{exerciseCount}</p>
      </div>
    </div>
  )
}
