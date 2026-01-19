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
      const newWorkout = { ...workout, id }
      await db.workoutSessions.add(newWorkout)
      
      // Update streaks and check achievements
      await achievementService.updateWorkoutStreak(newWorkout.date)
      await achievementService.checkWorkoutAchievements()
      
      return newWorkout
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
      return db.workoutSessions.get(id)
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
