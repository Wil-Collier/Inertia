import { memo, useMemo, useState } from "react"
import {
  Check,
  Trash2,
  Play,
  Pause,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DurationInput } from "@/components/ui/duration-input"
import { cn } from "@/lib/utils"
import type { WorkoutSet, Exercise } from "@/lib/types"
import { ScrollPicker } from "@/components/ui/scroll-picker"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

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
  const [activePicker, setActivePicker] = useState<"weight" | "reps" | null>(null)

  const isLb = weightUnitLabel.toLowerCase() === "lb" || weightUnitLabel.toLowerCase() === "lbs"
  const weightStep = isLb ? 5 : 2.5
  const weightMax = isLb ? 1000 : 450
  const weightOptions = useMemo(() => {
    const opts = Array.from({ length: Math.floor(weightMax / weightStep) + 1 }, (_, i) => i * weightStep)
    if (!opts.includes(set.weight)) {
      opts.push(set.weight)
      opts.sort((a, b) => a - b)
    }
    return opts
  }, [weightMax, weightStep, set.weight])

  const repsOptions = useMemo(() => {
    const opts = Array.from({ length: 101 }, (_, i) => i)
    if (!opts.includes(set.reps)) {
      opts.push(set.reps)
      opts.sort((a, b) => a - b)
    }
    return opts
  }, [set.reps])

  return (
    <div
      className={cn(
        "items-center gap-2 grid py-1",
        isTimeBased
          ? "grid-cols-[40px_30px_1fr_40px]"
          : exercise?.isWeighted 
            ? "grid-cols-[40px_30px_1fr_1fr_40px]" 
            : "grid-cols-[40px_30px_1fr_40px]",
        set.isCompleted && "opacity-60"
      )}
    >
      {/* Status/Action Button (Left Side) */}
      <div className="flex justify-center">
        {isTimeBased && !set.isCompleted ? (
          isActiveCountdown ? (
            <Button
              size="icon-sm"
              variant={countdownIsRunning ? "default" : "outline"}
              className="h-8 w-8"
              aria-label={countdownIsRunning ? `Pause set ${index + 1} timer` : `Resume set ${index + 1} timer`}
              onClick={() => {
                if (countdownIsRunning) {
                  onPauseCountdown()
                } else {
                  onResumeCountdown()
                }
              }}
            >
              {countdownIsRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </Button>
          ) : (
            <Button
              size="icon-sm"
              variant="outline"
              className="h-8 w-8"
              disabled={!canComplete}
              aria-label={`Start set ${index + 1} timer`}
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
          <Button
            size="icon-sm"
            variant={set.isCompleted ? "default" : "outline"}
            className="h-8 w-8"
            disabled={!set.isCompleted && !canComplete}
            aria-label={set.isCompleted ? `Mark set ${index + 1} incomplete` : `Complete set ${index + 1}`}
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
      </div>

      <span className="text-sm font-medium text-center">{index + 1}</span>
      
      {/* Weight Value Display */}
      {exercise?.isWeighted && !isTimeBased && (
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-full text-center tabular-nums"
          disabled={set.isCompleted}
          aria-label={`Set ${index + 1} weight`}
          onClick={() => setActivePicker("weight")}
        >
          {set.weight} <span className="ml-1 text-[10px] text-muted-foreground uppercase">{weightUnitLabel}</span>
        </Button>
      )}

      {/* Duration/Reps Value Display */}
      {isTimeBased ? (
        isActiveCountdown ? (
          <div className="flex h-9 items-center justify-center rounded-md border bg-primary/10 font-mono text-lg font-bold text-primary">
            {countdownFormattedTime}
          </div>
        ) : (
          <DurationInput
            value={set.reps}
            onChange={(seconds) =>
              onUpdateSet(workoutExerciseId, set.id, {
                reps: seconds,
              })
            }
            disabled={set.isCompleted}
          />
        )
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-full text-center tabular-nums"
          disabled={set.isCompleted}
          aria-label={`Set ${index + 1} reps`}
          onClick={() => setActivePicker("reps")}
        >
          {set.reps} <span className="ml-1 text-[10px] text-muted-foreground uppercase">reps</span>
        </Button>
      )}

      {/* Trash button (Right Side) */}
      <div className="flex justify-center">
        {!set.isCompleted && !isActiveCountdown && showRemoveButton ? (
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            aria-label={`Remove set ${index + 1}`}
            onClick={() => onRemoveSet(workoutExerciseId, set.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : (
          showRemoveButton && <div className="w-8 h-8" />
        )}
      </div>

      {/* Picker Sheet */}
      <Sheet open={activePicker !== null} onOpenChange={(open) => !open && setActivePicker(null)}>
        <SheetContent side="bottom" className="p-0 border-t-primary/20">
          <SheetHeader className="px-4 py-4 border-b bg-muted/30">
            <SheetTitle className="text-center text-xs font-bold uppercase tracking-widest text-primary">
              {activePicker === "weight" ? `Set Weight (${weightUnitLabel})` : "Set Repetitions"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col items-center bg-background px-6 pt-10 pb-16">
            <div className="w-full max-w-sm relative">
              {activePicker === "weight" ? (
                <ScrollPicker
                  value={set.weight}
                  options={weightOptions}
                  onChange={(weight) => onUpdateSet(workoutExerciseId, set.id, { weight })}
                  unit={weightUnitLabel}
                  className="w-full border-none bg-transparent"
                  height={250}
                  itemHeight={50}
                />
              ) : (
                <ScrollPicker
                  value={set.reps}
                  options={repsOptions}
                  onChange={(reps) => onUpdateSet(workoutExerciseId, set.id, { reps })}
                  unit="reps"
                  className="w-full border-none bg-transparent"
                  height={250}
                  itemHeight={50}
                />
              )}
              
              {/* Visual Decorative elements to make it feel more "industrial" */}
              <div className="absolute top-1/2 -translate-y-1/2 -left-4 w-1 h-12 bg-primary/20 rounded-full" />
              <div className="absolute top-1/2 -translate-y-1/2 -right-4 w-1 h-12 bg-primary/20 rounded-full" />
            </div>

            <Button 
              className="mt-10 w-full max-w-sm h-12 uppercase tracking-tight font-bold"
              onClick={() => setActivePicker(null)}
            >
              Confirm
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
})

WorkoutSetRow.displayName = "WorkoutSetRow"
