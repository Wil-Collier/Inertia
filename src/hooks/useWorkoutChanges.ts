import { useCallback } from "react"
import type { Workout, WorkoutTemplate } from "@/lib/types"

interface UseWorkoutChangesParams {
  workout: Workout | undefined
  templateId: string | undefined
  templates: WorkoutTemplate[]
  completedSets: number
}

/**
 * Hook to detect if the current workout has meaningful changes
 * that would warrant a discard warning.
 */
export function useWorkoutChanges({
  workout,
  templateId,
  templates,
  completedSets,
}: UseWorkoutChangesParams) {
  const hasChanges = useCallback(() => {
    if (!workout) return false

    // If any set is completed, there are changes
    if (completedSets > 0) return true

    // If there's no template, check if any exercises were added
    if (!templateId) {
      return workout.exercises.length > 0
    }

    // If started from template, check if exercises were added or removed
    const template = templates.find((t) => t.id === templateId)
    if (!template) return workout.exercises.length > 0

    // Different number of exercises means changes were made
    if (workout.exercises.length !== template.exercises.length) return true

    // Check if any exercise was swapped or if set counts changed
    for (let i = 0; i < workout.exercises.length; i++) {
      const workoutEx = workout.exercises[i]
      const templateEx = template.exercises[i]
      if (workoutEx.exerciseId !== templateEx.exerciseId) return true
      if (workoutEx.sets.length !== templateEx.targetSets) return true
    }

    return false
  }, [completedSets, templateId, workout, templates])

  return { hasChanges }
}
