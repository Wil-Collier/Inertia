import { memo } from "react"
import { format, parseISO } from "date-fns"
import { Dumbbell, Clock, ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDuration } from "@/lib/utils"
import type { Workout, Exercise } from "@/lib/types"

interface WorkoutHistoryCardProps {
  workout: Workout
  isExpanded: boolean
  onToggleExpand: (id: string) => void
  onDeleteRequest: (workout: Workout) => void
  exercisesById: Map<string, Exercise>
  weightUnit: {
    unitLabel: string
    format: (value: number, options?: { shouldShowUnit?: boolean; decimals?: number }) => string
  }
}

export const WorkoutHistoryCard = memo(({
  workout,
  isExpanded,
  onToggleExpand,
  onDeleteRequest,
  exercisesById,
  weightUnit,
}: WorkoutHistoryCardProps) => {
  const totalVolume = workout.exercises.reduce((total, ex) => {
    return total + ex.sets.reduce((setTotal, set) => {
      return setTotal + (set.isCompleted ? set.weight * set.reps : 0)
    }, 0)
  }, 0)

  const totalSets = workout.exercises.reduce((total, ex) => {
    return total + ex.sets.filter((s) => s.isCompleted).length
  }, 0)

  return (
    <Card>
      <CardContent className="p-0">
        {/* Workout Header */}
        <button
          className="flex w-full items-center gap-4 p-4 text-left"
          onClick={() => onToggleExpand(workout.id)}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium">{workout.name}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>
                {format(parseISO(workout.date), "EEE, MMM d")}
              </span>
              {workout.duration && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {workout.duration} min
                  </span>
                </>
              )}
              <span>•</span>
              <span>{totalSets} sets</span>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="border-t px-4 pb-4 pt-3">
            {/* Stats */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  Total Volume
                </p>
                <p className="text-lg font-semibold">
                  {weightUnit.format(totalVolume, { decimals: 0 })}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  Exercises
                </p>
                <p className="text-lg font-semibold">
                  {workout.exercises.length}
                </p>
              </div>
            </div>

             {/* Exercise List */}
             <div className="space-y-3">
               {workout.exercises.map((workoutExercise) => {
                 const exercise = exercisesById.get(workoutExercise.exerciseId)
                 const completedSets = workoutExercise.sets.filter(
                   (set) => set.isCompleted
                 )

                  return (
                    <div key={workoutExercise.id} className="text-sm">
                      <p className="font-medium">
                        {exercise?.name ?? "Unknown Exercise"}
                      </p>
                      <div className="mt-1 space-y-0.5 text-muted-foreground">
                        {completedSets.map((set, idx) => (
                          <p key={set.id}>
                            Set {idx + 1}:{" "}
                            {exercise?.isTimeBased ? (
                              formatDuration(set.reps)
                            ) : exercise?.isWeighted ? (
                              <>
                                {weightUnit.format(set.weight, { shouldShowUnit: false })} {weightUnit.unitLabel} × {set.reps} reps
                              </>
                            ) : (
                              <>{set.reps} reps</>
                            )}
                          </p>
                        ))}
                        {completedSets.length === 0 && (
                          <p className="italic">No completed sets</p>
                        )}
                      </div>
                      {workoutExercise.notes && (
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          Note: {workoutExercise.notes}
                        </p>
                      )}
                    </div>
                  )
              })}
            </div>

            {/* Delete Button */}
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDeleteRequest(workout)}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete Workout
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
})

WorkoutHistoryCard.displayName = "WorkoutHistoryCard"
