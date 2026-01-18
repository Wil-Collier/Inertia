import { memo, useState, useRef, useEffect } from "react"
import {
  Plus,
  Minus,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  StickyNote,
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DurationInput } from "@/components/ui/duration-input"
import { ExerciseInfoButton } from "@/components/ExerciseInfoSheet"
import { cn } from "@/lib/utils"
import type { WorkoutExercise, WorkoutSet, Exercise } from "@/lib/types"

interface DebouncedInputProps extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> {
  value: number
  onChange: (value: number) => void
  parseValue?: (rawValue: string) => number
}

export function DebouncedInput({ value, onChange, parseValue, ...props }: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value ? value.toString() : "")
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync with store when value changes externally (not by typing)
  useEffect(() => {
    const isFocused = document.activeElement === inputRef.current
    if (!isFocused) {
      setLocalValue(value ? value.toString() : "")
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocalValue(val)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      const parsed = parseValue ? parseValue(val) : parseFloat(val)
      onChange(isNaN(parsed) ? 0 : parsed)
    }, 300)
  }

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <Input
      {...props}
      ref={inputRef}
      value={localValue}
      onChange={handleChange}
    />
  )
}

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
        set.completed && "opacity-60"
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
          disabled={set.completed}
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
            disabled={set.completed}
          />
        )
      ) : (
        /* Reps input for non-time-based exercises */
        <div className="flex items-center gap-1.5">
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-9 w-9 border shrink-0"
            disabled={set.completed || (set.reps || 0) <= 0}
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
            disabled={set.completed}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-9 w-9 border shrink-0"
            disabled={set.completed}
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
        {isTimeBased && !set.completed ? (
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
            variant={set.completed ? "default" : "outline"}
            disabled={!set.completed && !canComplete}
            onClick={() => {
              if (set.completed || canComplete) {
                onToggleSetComplete(workoutExerciseId, set.id)
                if (!set.completed) {
                  onStartRestTimer()
                }
              }
            }}
          >
            <Check className="h-3 w-3" />
          </Button>
        )}
        {!set.completed && !isActiveCountdown && showRemoveButton ? (
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
              {workoutExercise.sets.filter((s) => s.completed).length}/
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
