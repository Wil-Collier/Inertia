import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { Exercise } from "@/lib/types"

export function useAddExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (exercise: Omit<Exercise, "id">) => {
      const newExercise: Exercise = {
        id: crypto.randomUUID(),
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        isCustom: true,
        isWeighted: exercise.isWeighted,
        isTimeBased: exercise.isTimeBased,
      }
      await db.exercises.add(newExercise)
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
      // Check if exercise is used in any templates
      const templates = await db.workoutTemplates.toArray()
      const usedInTemplate = templates.find(t =>
        t.exercises.some(e => e.exerciseId === id)
      )

      if (usedInTemplate) {
        throw new Error(`Cannot delete: exercise is used in template "${usedInTemplate.name}"`)
      }

      await db.transaction("rw", [db.exercises, db.personalRecords], async () => {
        await db.exercises.delete(id)
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
