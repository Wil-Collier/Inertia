import { useState } from "react"
import { format, parseISO } from "date-fns"
import { Dumbbell, Clock, ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDuration } from "@/lib/utils"
import { useWorkoutStore } from "@/stores/workoutStore"
import { useExerciseStore } from "@/stores/exerciseStore"
import type { Workout } from "@/lib/types"

export function WorkoutHistory() {
  const { workouts, deleteWorkout } = useWorkoutStore()
  const { getExercise } = useExerciseStore()
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null)
  const [workoutToDelete, setWorkoutToDelete] = useState<Workout | null>(null)

  // Sort workouts by date (newest first)
  const sortedWorkouts = [...workouts].sort((a, b) => {
    if (a.date === b.date) {
      // If same date, sort by completedAt if available
      if (a.completedAt && b.completedAt) {
        return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      }
    }
    return b.date.localeCompare(a.date)
  })

  // Group workouts by month
  const groupedByMonth = sortedWorkouts.reduce<Record<string, Workout[]>>((acc, workout) => {
    const monthKey = format(parseISO(workout.date), "MMMM yyyy")
    if (!acc[monthKey]) {
      acc[monthKey] = []
    }
    acc[monthKey].push(workout)
    return acc
  }, {})

  const toggleExpand = (workoutId: string) => {
    setExpandedWorkoutId((prev) => (prev === workoutId ? null : workoutId))
  }

  const handleDelete = () => {
    if (workoutToDelete) {
      deleteWorkout(workoutToDelete.id)
      setWorkoutToDelete(null)
    }
  }

  const getTotalVolume = (workout: Workout) => {
    return workout.exercises.reduce((total, ex) => {
      return total + ex.sets.reduce((setTotal, set) => {
        return setTotal + (set.completed ? set.weight * set.reps : 0)
      }, 0)
    }, 0)
  }

  const getTotalSets = (workout: Workout) => {
    return workout.exercises.reduce((total, ex) => {
      return total + ex.sets.filter((s) => s.completed).length
    }, 0)
  }

  return (
    <div className="flex flex-col">
      <Header title="History" showBack />

      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4">
          {sortedWorkouts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Dumbbell className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">No workouts yet</p>
                <p className="text-sm text-muted-foreground">
                  Complete a workout to see it here
                </p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedByMonth).map(([month, monthWorkouts]) => (
              <section key={month}>
                <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                  {month}
                </h2>
                <div className="space-y-2">
                  {monthWorkouts.map((workout) => {
                    const isExpanded = expandedWorkoutId === workout.id
                    const totalVolume = getTotalVolume(workout)
                    const totalSets = getTotalSets(workout)

                    return (
                      <Card key={workout.id}>
                        <CardContent className="p-0">
                          {/* Workout Header */}
                          <button
                            className="flex w-full items-center gap-4 p-4 text-left"
                            onClick={() => toggleExpand(workout.id)}
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
                                    {totalVolume.toLocaleString()} lbs
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
                                {workout.exercises.map((we) => {
                                  const exercise = getExercise(we.exerciseId)
                                  const completedSets = we.sets.filter(
                                    (s) => s.completed
                                  )

                                    return (
                                      <div key={we.id} className="text-sm">
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
                                                  {set.weight} lbs × {set.reps} reps
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
                                        {we.notes && (
                                          <p className="mt-1 text-xs italic text-muted-foreground">
                                            Note: {we.notes}
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
                                onClick={() => setWorkoutToDelete(workout)}
                              >
                                <Trash2 className="mr-1 h-4 w-4" />
                                Delete Workout
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={workoutToDelete !== null}
        onOpenChange={(open) => !open && setWorkoutToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workout</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{workoutToDelete?.name}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkoutToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
