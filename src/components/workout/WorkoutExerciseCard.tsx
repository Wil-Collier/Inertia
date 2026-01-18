import { memo } from "react"
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  StickyNote,
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ExerciseInfoButton } from "@/components/ExerciseInfoSheet"
import { cn } from "@/lib/utils"
import type { WorkoutExercise, WorkoutSet, Exercise } from "@/lib/types"
import { WorkoutSetRow } from "./WorkoutSetRow"

interface WorkoutExerciseCardProps {
  workoutExercise: WorkoutExercise
  exercise?: Exercise
  isExpanded: boolean
  onToggleExpanded: (id: string) => void
  onAddSet: (workoutExerciseId: string) => void
  onRemoveSet: (workoutExerciseId: string, setId: string) => void
  onUpdateSet: (workoutExerciseId: string, setId: string, updates: Partial<WorkoutSet>) => void
  onToggleSetComplete: (workoutExerciseId: string, setId: string) => void
  onRemoveExercise: (id: string) => void
  onUpdateNotes: (id: string, notes: string) => void
  weightUnitLabel: string
  activeSetId?: string
  countdownFormattedTime?: string
  countdownIsRunning?: boolean
  onStartCountdown: (setId: string, workoutExerciseId: string, duration: number) => void
  onPauseCountdown: () => void
  onResumeCountdown: () => void
  onStartRestTimer: () => void
}

export const WorkoutExerciseCard = memo(({
  workoutExercise,
  exercise,
  isExpanded,
  onToggleExpanded,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
  onToggleSetComplete,
  onRemoveExercise,
  onUpdateNotes,
  weightUnitLabel,
  activeSetId,
  countdownFormattedTime,
  countdownIsRunning,
  onStartCountdown,
  onPauseCountdown,
  onResumeCountdown,
  onStartRestTimer,
}: WorkoutExerciseCardProps) => {
  const hasLastPerformance = !!workoutExercise.lastPerformanceDate
  const isTimeBased = exercise?.isTimeBased ?? false

  return (
    <Card>
      <CardHeader
        className="cursor-pointer py-3"
        onClick={() => onToggleExpanded(workoutExercise.id)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <CardTitle className="text-base">
                {exercise?.name || "Unknown Exercise"}
              </CardTitle>
              {exercise && <ExerciseInfoButton exercise={exercise} />}
            </div>
            {hasLastPerformance && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Last: {format(parseISO(workoutExercise.lastPerformanceDate!), "MMM d")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Notes indicator */}
            {workoutExercise.notes && (
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">
              {workoutExercise.sets.filter((s) => s.isCompleted).length}/
              {workoutExercise.sets.length}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-3 pt-0">
          {/* Sets Header */}
          <div className={cn(
            "gap-2 text-xs text-muted-foreground grid",
            isTimeBased
              ? "grid-cols-[1fr_4fr_auto]"
              : exercise?.isWeighted 
                ? "grid-cols-[1fr_3fr_3fr_auto]" 
                : "grid-cols-[1fr_6fr_auto]"
          )}>
            <span>Set</span>
            {exercise?.isWeighted && !isTimeBased && <span>Weight</span>}
            <span>{isTimeBased ? "Duration" : "Reps"}</span>
            <span className="w-8"></span>
          </div>

          {/* Sets */}
          {workoutExercise.sets.map((set, index) => {
            const isActiveCountdown = activeSetId === set.id
            const canComplete = isTimeBased
              ? set.reps > 0
              : exercise?.isWeighted 
                ? set.weight > 0 && set.reps > 0
                : set.reps > 0

            return (
              <WorkoutSetRow
                key={set.id}
                set={set}
                index={index}
                exercise={exercise}
                workoutExerciseId={workoutExercise.id}
                weightUnitLabel={weightUnitLabel}
                isActiveCountdown={isActiveCountdown}
                countdownFormattedTime={countdownFormattedTime}
                countdownIsRunning={countdownIsRunning}
                canComplete={canComplete}
                isTimeBased={isTimeBased}
                onUpdateSet={onUpdateSet}
                onRemoveSet={onRemoveSet}
                onToggleSetComplete={onToggleSetComplete}
                onStartCountdown={onStartCountdown}
                onPauseCountdown={onPauseCountdown}
                onResumeCountdown={onResumeCountdown}
                onStartRestTimer={onStartRestTimer}
                showRemoveButton={workoutExercise.sets.length > 1}
              />
            )
          })}

          {/* Add Set & Remove Exercise */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onAddSet(workoutExercise.id)}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add Set
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveExercise(workoutExercise.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Notes */}
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-1.5">
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Notes</span>
            </div>
            <Input
              value={workoutExercise.notes || ""}
              onChange={(e) => onUpdateNotes(workoutExercise.id, e.target.value)}
              placeholder="Add a note for this exercise..."
              className="h-8 text-sm"
            />
          </div>
        </CardContent>
      )}
    </Card>
  )
})

WorkoutExerciseCard.displayName = "WorkoutExerciseCard"
