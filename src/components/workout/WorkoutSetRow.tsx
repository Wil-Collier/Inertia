import { memo } from "react"
import {
  Plus,
  Minus,
  Check,
  Trash2,
  Play,
  Pause,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DurationInput } from "@/components/ui/duration-input"
import { cn } from "@/lib/utils"
import type { WorkoutSet, Exercise } from "@/lib/types"
import { DebouncedInput } from "./DebouncedInput"

interface WorkoutSetRowProps {
  set: WorkoutSet
  index: number
  exercise?: Exercise
  workoutExerciseId: string
  weightUnitLabel: string
  isActiveCountdown: boolean
  countdownFormattedTime?: string
  countdownIsRunning?: boolean
  canComplete: boolean
  isTimeBased: boolean
  onUpdateSet: (workoutExerciseId: string, setId: string, updates: Partial<WorkoutSet>) => void
  onRemoveSet: (workoutExerciseId: string, setId: string) => void
  onToggleSetComplete: (workoutExerciseId: string, setId: string) => void
  onStartCountdown: (setId: string, workoutExerciseId: string, duration: number) => void
  onPauseCountdown: () => void
  onResumeCountdown: () => void
  onStartRestTimer: () => void
  showRemoveButton: boolean
}

export const WorkoutSetRow = memo(({
  set,
  index,
  exercise,
  workoutExerciseId,
  weightUnitLabel,
  isActiveCountdown,
  countdownFormattedTime,
  countdownIsRunning,
  canComplete,
  isTimeBased,
  onUpdateSet,
  onRemoveSet,
  onToggleSetComplete,
  onStartCountdown,
  onPauseCountdown,
  onResumeCountdown,
  onStartRestTimer,
  showRemoveButton,
}: WorkoutSetRowProps) => {
  return (
    <div
      className={cn(
        "items-center gap-2 grid",
        isTimeBased
          ? "grid-cols-[1fr_4fr_auto]"
          : exercise?.isWeighted 
            ? "grid-cols-[1fr_3fr_3fr_auto]" 
            : "grid-cols-[1fr_6fr_auto]",
        set.isCompleted && "opacity-60"
      )}
    >
      <span className="text-sm font-medium">{index + 1}</span>
      
      {/* Weight input (only for weighted, non-time-based exercises) */}
      {exercise?.isWeighted && !isTimeBased && (
        <DebouncedInput
          type="number"
          value={set.weight}
          onChange={(weight) => {
            onUpdateSet(workoutExerciseId, set.id, { weight })
          }}
          parseValue={(rawValue) => Math.round(parseFloat(rawValue))}
          placeholder={weightUnitLabel}
          className="h-9"
          disabled={set.isCompleted}
        />
      )}

      {/* Duration input/countdown for time-based exercises */}
      {isTimeBased ? (
        isActiveCountdown ? (
          /* Show countdown in place of duration input */
          <div className="flex h-9 items-center justify-center rounded-md border bg-primary/10 font-mono text-lg font-bold text-primary">
            {countdownFormattedTime}
          </div>
        ) : (
          /* Show editable duration input */
          <DurationInput
            value={set.reps} // reps stores duration in seconds
            onChange={(seconds) =>
              onUpdateSet(workoutExerciseId, set.id, {
                reps: seconds,
              })
            }
            disabled={set.isCompleted}
          />
        )
      ) : (
        /* Reps input for non-time-based exercises */
        <div className="flex items-center gap-1.5">
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-9 w-9 border shrink-0"
            disabled={set.isCompleted || (set.reps || 0) <= 0}
            onClick={() => {
              const reps = Math.max(0, (set.reps || 0) - 1)
              onUpdateSet(workoutExerciseId, set.id, { reps })
            }}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <DebouncedInput
            type="number"
            value={set.reps}
            onChange={(reps) => {
              onUpdateSet(workoutExerciseId, set.id, { reps })
            }}
            parseValue={(rawValue) => Math.round(parseFloat(rawValue))}
            placeholder="reps"
            className="h-9 text-center"
            disabled={set.isCompleted}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-9 w-9 border shrink-0"
            disabled={set.isCompleted}
            onClick={() => {
              const reps = (set.reps || 0) + 1
              onUpdateSet(workoutExerciseId, set.id, { reps })
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-1">
        {isTimeBased && !set.isCompleted ? (
          /* Time-based exercise: Play/Pause button */
          isActiveCountdown ? (
            /* Show pause or resume button based on running state */
            <Button
              size="icon-sm"
              variant={countdownIsRunning ? "default" : "outline"}
              onClick={() => {
                if (countdownIsRunning) {
                  onPauseCountdown()
                } else {
                  onResumeCountdown()
                }
              }}
            >
              {countdownIsRunning ? (
                <Pause className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3" />
              )}
            </Button>
          ) : (
            /* Show play button to start */
            <Button
              size="icon-sm"
              variant="outline"
              disabled={!canComplete}
              onClick={() => {
                if (canComplete) {
                  onStartCountdown(set.id, workoutExerciseId, set.reps)
                }
              }}
            >
              <Play className="h-3 w-3" />
            </Button>
          )
        ) : (
          /* Rep-based exercise or completed: Check button */
          <Button
            size="icon-sm"
            variant={set.isCompleted ? "default" : "outline"}
            disabled={!set.isCompleted && !canComplete}
            onClick={() => {
              if (set.isCompleted || canComplete) {
                onToggleSetComplete(workoutExerciseId, set.id)
                if (!set.isCompleted) {
                  onStartRestTimer()
                }
              }
            }}
          >
            <Check className="h-3 w-3" />
          </Button>
        )}
        {!set.isCompleted && !isActiveCountdown && showRemoveButton ? (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() =>
              onRemoveSet(workoutExerciseId, set.id)
            }
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        ) : (
          /* Invisible placeholder to maintain layout */
          showRemoveButton && (
            <div className="w-7 h-7" />
          )
        )}
      </div>
    </div>
  )
})

WorkoutSetRow.displayName = "WorkoutSetRow"
