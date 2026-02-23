import { memo } from "react"
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  StickyNote,
  TrendingUp,
  X,
  ArrowUp,
} from "lucide-react"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DebouncedTextInput } from "./DebouncedTextInput"
import { ExerciseInfoButton } from "@/features/workout/components/ExerciseInfoSheet"
import { cn } from "@/lib/utils"
import type { WorkoutExercise, WorkoutSet, Exercise } from "@/lib/types"
import { WorkoutSetRow } from "./WorkoutSetRow"
import { parseDbDate } from "@/lib/dateUtils"

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
  weightRecommendation?: {
    recommendedWeightLabel: string
    source: "progressive-overload" | "last-used"
  }
  onApplyWeightRecommendation?: (workoutExerciseId: string) => void
  onDismissWeightRecommendation?: (workoutExerciseId: string) => void
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
  weightRecommendation,
  onApplyWeightRecommendation,
  onDismissWeightRecommendation,
}: WorkoutExerciseCardProps) => {
  const hasLastPerformance = !!workoutExercise.lastPerformanceDate
  const isTimeBased = exercise?.isTimeBased ?? false
  const completedCount = workoutExercise.sets.filter((s) => s.isCompleted).length
  const totalCount = workoutExercise.sets.length
  const allCompleted = completedCount === totalCount && totalCount > 0

  return (
    <Card className={cn("transition-all", !isExpanded && "gap-0")}>
      {/* Clean header: chevron + name/meta + set counter + delete */}
      <CardHeader
        className="cursor-pointer px-4 py-3"
        onClick={() => onToggleExpanded(workoutExercise.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onToggleExpanded(workoutExercise.id)
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} ${exercise?.name || "exercise"}`}
      >
        <div className="flex items-center gap-3">
          {/* Expand/collapse chevron */}
          <div className="flex shrink-0 items-center justify-center w-5">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          {/* Exercise name + last performance */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <CardTitle className={cn("text-base leading-tight", !isExpanded && "line-clamp-2")}>
                {exercise?.name || "Unknown Exercise"}
              </CardTitle>
              {exercise && <ExerciseInfoButton exercise={exercise} />}
            </div>
            {hasLastPerformance && workoutExercise.lastPerformanceDate && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Last: {format(parseDbDate(workoutExercise.lastPerformanceDate), "MMM d")}
              </p>
            )}
          </div>

          {/* Right side: notes indicator + set counter + delete */}
          <div className="flex shrink-0 items-center gap-2">
            {workoutExercise.notes && (
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className={cn(
              "text-sm tabular-nums font-medium",
              allCompleted ? "text-primary" : "text-muted-foreground",
            )}>
              {completedCount}/{totalCount}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation()
                onRemoveExercise(workoutExercise.id)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Expandable content */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <CardContent className="space-y-3 pt-0">
            {/* Progressive overload recommendation — only visible when expanded */}
            {weightRecommendation && onApplyWeightRecommendation && onDismissWeightRecommendation && (
              <div className="flex items-center gap-3 rounded-lg bg-primary/8 px-3 py-2 ring-1 ring-primary/15">
                <div className="flex shrink-0 items-center justify-center rounded-md bg-primary/15 p-1.5">
                  {weightRecommendation.source === "progressive-overload" ? (
                    <ArrowUp className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    {weightRecommendation.source === "progressive-overload" ? "Increase to " : "Start at "}
                    {weightRecommendation.recommendedWeightLabel}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="default"
                    size="xs"
                    className="h-7 px-3 text-xs font-bold uppercase tracking-wider"
                    onClick={(event) => {
                      event.stopPropagation()
                      onApplyWeightRecommendation(workoutExercise.id)
                    }}
                    aria-label={`Use recommended weight for ${exercise?.name || "exercise"}`}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-primary/50 hover:text-primary hover:bg-primary/10"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDismissWeightRecommendation(workoutExercise.id)
                    }}
                    aria-label={`Dismiss recommended weight for ${exercise?.name || "exercise"}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Sets Header */}
            <div className={cn(
              "gap-2 text-xs text-muted-foreground grid",
              isTimeBased
                ? "grid-cols-[40px_30px_1fr_40px]"
                : exercise?.isWeighted
                  ? "grid-cols-[40px_30px_1fr_1fr_40px]"
                  : "grid-cols-[40px_30px_1fr_40px]"
            )}>
              <span className="w-10"></span>
              <span className="text-center">Set</span>
              {exercise?.isWeighted && !isTimeBased && <span className="text-center">Weight</span>}
              <span className="text-center">{isTimeBased ? "Duration" : "Reps"}</span>
              <span className="w-10"></span>
            </div>

            {/* Sets */}
            {workoutExercise.sets.map((set, index) => {
              const isActiveCountdown = activeSetId === set.id
              const canComplete = isTimeBased
                ? set.reps > 0
                : exercise?.isWeighted
                  ? set.weight >= 0 && set.reps > 0
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

            {/* Add Set */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onAddSet(workoutExercise.id)}
                tabIndex={isExpanded ? 0 : -1}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add Set
              </Button>
            </div>

            {/* Notes */}
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-1.5">
                <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Notes</span>
              </div>
              <DebouncedTextInput
                value={workoutExercise.notes || ""}
                onChange={(notes) => onUpdateNotes(workoutExercise.id, notes)}
                placeholder="Add a note for this exercise..."
                className="h-8 text-sm"
                tabIndex={isExpanded ? 0 : -1}
                debounceMs={500}
              />
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  )
})

WorkoutExerciseCard.displayName = "WorkoutExerciseCard"
