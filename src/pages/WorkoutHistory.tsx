import { useState, useMemo, useCallback } from "react"
import { format, parseISO } from "date-fns"
import { Dumbbell, Loader2 } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { WorkoutHistoryCard } from "@/components/workout/WorkoutHistoryCard"
import { useDeleteWorkout } from "@/features/workout/mutations"
import { useExercisesByIds } from "@/features/exercises/queries"
import { useWorkouts } from "@/features/workout/queries"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import type { Workout } from "@/lib/types"

export function WorkoutHistory() {
  const deleteWorkoutMutation = useDeleteWorkout()
  const { data: workouts = [], isLoading } = useWorkouts()

  // Resolve all exercise names in history
  const allExerciseIds = useMemo(() => {
    return [...new Set(workouts.flatMap(w => w.exercises.map(e => e.exerciseId)))]
  }, [workouts])
  const { data: exercisesById = new Map() } = useExercisesByIds(allExerciseIds)

  const weightUnit = useWeightUnit()
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null)
  const [workoutToDelete, setWorkoutToDelete] = useState<Workout | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Sort workouts by date (newest first)
  const sortedWorkouts = useMemo(() => {
    return [...workouts].sort((a, b) => {
      if (a.date === b.date) {
        // If same date, sort by completedAt if available
        if (a.completedAt && b.completedAt) {
          return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
        }
      }
      return b.date.localeCompare(a.date)
    })
  }, [workouts])

  // Group workouts by month
  const groupedByMonth = useMemo(() => {
    return sortedWorkouts.reduce<Record<string, Workout[]>>((acc, workout) => {
      const monthKey = format(parseISO(workout.date), "MMMM yyyy")
      if (!acc[monthKey]) {
        acc[monthKey] = []
      }
      acc[monthKey].push(workout)
      return acc
    }, {})
  }, [sortedWorkouts])

  const handleToggleExpand = useCallback((workoutId: string) => {
    setExpandedWorkoutId((prev) => (prev === workoutId ? null : workoutId))
  }, [])

  const handleDelete = useCallback(async () => {
    if (!workoutToDelete) return

    setIsDeleting(true)
    try {
      await deleteWorkoutMutation.mutateAsync(workoutToDelete.id)
      setWorkoutToDelete(null)
      toast.success("Workout deleted")
    } catch {
      // Store already toasts
    } finally {
      setIsDeleting(false)
    }
  }, [workoutToDelete, deleteWorkoutMutation])

  return (
    <div className="flex flex-col">
      <Header title="History" showBack />

      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4">
          {isLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              Loading history...
            </div>
          ) : sortedWorkouts.length === 0 ? (
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
                <h2 className="mb-3 text-sm font-black text-muted-foreground uppercase tracking-tight italic">
                  {month}
                </h2>
                <div className="space-y-2">
                  {monthWorkouts.map((workout) => (
                    <WorkoutHistoryCard
                      key={workout.id}
                      workout={workout}
                      isExpanded={expandedWorkoutId === workout.id}
                      onToggleExpand={handleToggleExpand}
                      onDeleteRequest={setWorkoutToDelete}
                      exercisesById={exercisesById}
                      weightUnit={weightUnit}
                    />
                  ))}
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
            <Button variant="outline" onClick={() => setWorkoutToDelete(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
