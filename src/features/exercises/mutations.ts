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
      await db.transaction("rw", [db.exercises, db.personalRecords], async () => {
        await db.exercises.delete(id)
        await db.personalRecords.where("exerciseId").equals(id).delete()
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all })
      toast.success("Exercise deleted")
    },
    onError: () => {
      toast.error("Failed to delete exercise")
    }
  })
}
