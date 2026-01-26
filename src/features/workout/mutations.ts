import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { Workout, WorkoutTemplate } from "@/lib/types"

import { achievementService } from "@/services/achievementService"
import { statsService } from "@/services/statsService"

// ============ WORKOUT MUTATIONS ============

export function useCreateWorkout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (workout: Omit<Workout, "id">) => {
      const id = crypto.randomUUID()
      const exerciseIds = workout.exercises.map(e => e.exerciseId)

      // Pre-load necessary data for achievements (avoid dynamic import in a transaction)
      const { exerciseDatabaseMap } = await import("@/data/exerciseDatabase")

      // Ensure weightUnit is set (should always be provided, but fallback for safety)
      let weightUnit = workout.weightUnit
      if (!weightUnit) {
        const settings = await db.settings.get("settings")
        weightUnit = settings?.unitPreferences?.weight ?? "kg"
      }

      const newWorkout: Workout = { ...workout, id, exerciseIds, weightUnit }

      await db.workoutSessions.add(newWorkout)
      await statsService.addWorkout(newWorkout)
      await achievementService.updateStreaks()
      await achievementService.checkWorkoutAchievements(exerciseDatabaseMap)

      return newWorkout
    },
    onSuccess: (workout) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
      queryClient.setQueryData(queryKeys.workouts.detail(workout.id), workout)
    },
    onError: (error) => {
      console.error("Failed to create workout:", error)
      toast.error("Failed to save workout")
    },
  })
}

export function useUpdateWorkout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Workout> }) => {
      // Pre-load necessary data for achievements
      const { exerciseDatabaseMap } = await import("@/data/exerciseDatabase")

      let workout: Workout | undefined

      await db.transaction("rw", [
        db.workoutSessions,
        db.userStats,
        db.achievements,
        db.workoutTemplates,
        db.personalRecords,
        db.customExercises,
        db.nutritionLogs,
        db.settings
      ], async () => {
        // Get the old workout for stats delta calculation
        const oldWorkout = await db.workoutSessions.get(id)

        // If exercises are being updated, recompute exerciseIds
        const finalUpdates = { ...updates }
        if (updates.exercises) {
          finalUpdates.exerciseIds = updates.exercises.map(e => e.exerciseId)
        }

        await db.workoutSessions.update(id, finalUpdates)
        workout = await db.workoutSessions.get(id)

        // Update incremental stats if workout exists and exercises changed
        if (oldWorkout && workout && updates.exercises) {
          await statsService.updateWorkout(oldWorkout, workout)
        }

        // Recalculate streaks and check achievements after workout update
        if (workout) {
          await achievementService.updateStreaks()
        }
        
        await achievementService.checkWorkoutAchievements(exerciseDatabaseMap)
      })

      return workout
    },
    onSuccess: (workout, { id }) => {
      if (workout) {
        queryClient.setQueryData(queryKeys.workouts.detail(id), workout)
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
    },
    onError: () => {
      toast.error("Failed to update workout")
    },
  })
}

export function useDeleteWorkout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // Pre-load data
      const { exerciseDatabaseMap } = await import("@/data/exerciseDatabase")

      await db.transaction("rw", [
        db.workoutSessions,
        db.userStats,
        db.achievements,
        db.workoutTemplates,
        db.personalRecords,
        db.customExercises,
        db.nutritionLogs,
        db.settings
      ], async () => {
        // Get workout before deletion for stats update
        const workout = await db.workoutSessions.get(id)

        await db.workoutSessions.delete(id)

        // Update incremental stats
        if (workout) {
          await statsService.removeWorkout(workout)
        }

        // Deletion can invalidate current/last streak state.
        await achievementService.updateStreaks()

        // Check achievements after workout deletion (volume/count may change)
        await achievementService.checkWorkoutAchievements(exerciseDatabaseMap)
      })

      return id
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
      toast.success("Workout deleted")
    },
    onError: () => {
      toast.error("Failed to delete workout")
    },
  })
}

// ============ TEMPLATE MUTATIONS ============

export function useCreateTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (template: Omit<WorkoutTemplate, "id">) => {
      const id = crypto.randomUUID()
      const newTemplate = { ...template, id }
      await db.workoutTemplates.add(newTemplate)

      // Check template achievements (lightweight, doesn't load all workouts)
      await achievementService.checkTemplateAchievements()

      return newTemplate
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.templates.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
      toast.success("Template created")
    },
    onError: () => {
      toast.error("Failed to create template")
    },
  })
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WorkoutTemplate> }) => {
      await db.workoutTemplates.update(id, updates)
      return db.workoutTemplates.get(id)
    },
    onSuccess: (template, { id }) => {
      if (template) {
        queryClient.setQueryData(queryKeys.templates.detail(id), template)
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.templates.all })
    },
    onError: () => {
      toast.error("Failed to update template")
    },
  })
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await db.workoutTemplates.delete(id)

      // Check template achievements (lightweight, doesn't load all workouts)
      await achievementService.checkTemplateAchievements()

      return id
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.templates.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
      toast.success("Template deleted")
    },
    onError: () => {
      toast.error("Failed to delete template")
    },
  })
}
