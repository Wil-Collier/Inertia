import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { Exercise } from "@/lib/types"
import { ACTIVE_SESSION_ID } from "@/lib/constants"
import { isDefaultExercise } from "@/data/exerciseDatabase"
import {
  CUSTOM_EXERCISES_SYNC_WRITE_TABLES,
  EXERCISE_DELETE_SYNC_WRITE_TABLES,
} from "@/services/dbTransactionTables"
import { achievementService } from "@/services/achievementService"

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
      await db.transaction("rw", CUSTOM_EXERCISES_SYNC_WRITE_TABLES, async () => {
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
      if (isDefaultExercise(id)) {
        throw new Error("Cannot delete built-in exercises")
      }

      await db.transaction(
        "rw",
        EXERCISE_DELETE_SYNC_WRITE_TABLES,
        async () => {
        // Check if exercise is used in any templates (inside the same transaction as delete)
        const templates = await db.workoutTemplates.toArray()
        const usedInTemplate = templates.find((t) =>
          t.exercises.some((e) => e.exerciseId === id)
        )

        if (usedInTemplate) {
          throw new Error(`Cannot delete: exercise is used in template "${usedInTemplate.name}"`)
        }

        const activeSession = await db.activeSession.get(ACTIVE_SESSION_ID)
        const usedInActiveSession = activeSession?.workout.exercises.some((exercise) => exercise.exerciseId === id) ?? false
        if (usedInActiveSession) {
          throw new Error("Cannot delete: exercise is used in the active workout session")
        }

        const usedInWorkoutHistory = await db.workoutSessions.where("exerciseIds").equals(id).first()
        if (usedInWorkoutHistory) {
          throw new Error("Cannot delete: exercise is used in workout history")
        }

          // Only delete custom exercises and their associated PRs
          await db.customExercises.delete(id)
          await db.personalRecords.where("exerciseId").equals(id).delete()
        })

      await achievementService.checkWorkoutAchievements()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
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
      await db.transaction("rw", CUSTOM_EXERCISES_SYNC_WRITE_TABLES, async () => {
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
