import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { Exercise } from "@/lib/types"

export function useAddExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (exercise: Omit<Exercise, "id" | "isCustom" | "createdAt">) => {
      const newExercise: Exercise = {
        id: crypto.randomUUID(),
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        isCustom: true,
        isWeighted: exercise.isWeighted,
        isTimeBased: exercise.isTimeBased,
        description: exercise.description,
        createdAt: new Date().toISOString(),
      }
      await db.transaction("rw", [db.customExercises, db.metadata], async () => {
        await db.customExercises.add(newExercise)
      })
      return newExercise
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all })
      toast.success("Exercise created")
    },
    onError: () => {
      toast.error("Failed to create exercise")
    }
  })
}

export function useDeleteExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // Check if this is a default (built-in) exercise - these cannot be deleted
      const { isDefaultExercise } = await import("@/data/exerciseDatabase")
      if (isDefaultExercise(id)) {
        throw new Error("Cannot delete built-in exercises")
      }

      await db.transaction("rw", [db.workoutTemplates, db.customExercises, db.personalRecords, db.metadata], async () => {
        // Check if exercise is used in any templates (inside the same transaction as delete)
        const templates = await db.workoutTemplates.toArray()
        const usedInTemplate = templates.find((t) =>
          t.exercises.some((e) => e.exerciseId === id)
        )

        if (usedInTemplate) {
          throw new Error(`Cannot delete: exercise is used in template "${usedInTemplate.name}"`)
        }

        // Only delete custom exercises and their associated PRs
      await db.customExercises.delete(id)
      await db.personalRecords.where("exerciseId").equals(id).delete()
    })
  },
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all })
    toast.success("Exercise deleted")
  },
  onError: (error) => {
    toast.error(error instanceof Error ? error.message : "Failed to delete exercise")
  }
})
}

export function useUpdateExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Exercise> }) => {
      let updatedExercise: Exercise | undefined
      await db.transaction("rw", [db.customExercises, db.metadata], async () => {
        await db.customExercises.update(id, updates)
        updatedExercise = await db.customExercises.get(id)
      })
      if (!updatedExercise) throw new Error("Failed to retrieve updated exercise")
      return updatedExercise
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all })
      toast.success("Exercise updated")
    },
    onError: () => {
      toast.error("Failed to update exercise")
    }
  })
}

