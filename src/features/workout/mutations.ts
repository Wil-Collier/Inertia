import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { Workout, WorkoutTemplate } from "@/lib/types"

import { achievementService } from "@/services/achievementService"

// ============ WORKOUT MUTATIONS ============

export function useCreateWorkout() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (workout: Omit<Workout, "id">) => {
      const id = crypto.randomUUID()
      const exerciseIds = workout.exercises.map(e => e.exerciseId)
      
      // Ensure weightUnit is set
      let weightUnit = workout.weightUnit
      if (!weightUnit) {
        const settings = await db.settings.get("settings")
        weightUnit = settings?.unitPreferences?.weight || "kg"
      }

      const newWorkout = { ...workout, id, exerciseIds, weightUnit }
      await db.workoutSessions.add(newWorkout as Workout)
      
      // Update streaks and check achievements
      await achievementService.updateWorkoutStreak(newWorkout.date)
      await achievementService.checkWorkoutAchievements()
      
      return newWorkout as Workout
    },
    onSuccess: (workout) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
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
      await db.workoutSessions.update(id, updates)
      const workout = await db.workoutSessions.get(id)
      
      // Check achievements after workout update
      await achievementService.checkWorkoutAchievements()
      
      return workout
    },
    onSuccess: (workout, { id }) => {
      if (workout) {
        queryClient.setQueryData(queryKeys.workouts.detail(id), workout)
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
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
      await db.workoutSessions.delete(id)
      
      // Check achievements after workout deletion (volume/count may change)
      await achievementService.checkWorkoutAchievements()
      
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all })
      toast.success("Template deleted")
    },
    onError: () => {
      toast.error("Failed to delete template")
    },
  })
}
