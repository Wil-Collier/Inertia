import { useQuery } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import { getCompletedSets, sumSetVolume } from "@/lib/workoutUtils"
import { getThirtyDaysAgo } from "@/lib/dateUtils"
import { statsService } from "@/services/statsService"

import type { PersonalRecord } from "@/lib/types"

// ============ READ QUERIES ============

export function useWorkouts(limit = 20) {
  return useQuery({
    queryKey: queryKeys.workouts.list(limit),
    queryFn: async () => {
      return db.workoutSessions
        .orderBy("date")
        .reverse()
        .limit(limit)
        .toArray()
    },
  })
}

export function useWorkout(id: string) {
  return useQuery({
    queryKey: queryKeys.workouts.detail(id),
    queryFn: async () => {
      const workout = await db.workoutSessions.get(id)
      if (!workout) throw new Error(`Workout ${id} not found`)
      return workout
    },
    enabled: !!id,
  })
}

export function useWorkoutsByDate(date: string) {
  return useQuery({
    queryKey: queryKeys.workouts.byDate(date),
    queryFn: async () => {
      return db.workoutSessions.where("date").equals(date).toArray()
    },
    enabled: !!date,
  })
}

export function useWorkoutsByExercise(exerciseId: string) {
  return useQuery({
    queryKey: queryKeys.workouts.byExercise(exerciseId),
    queryFn: async () => {
      const results = await db.workoutSessions
        .where("exerciseIds")
        .equals(exerciseId)
        .sortBy("date")
      return results.reverse()
    },
    enabled: !!exerciseId,
  })
}

// ============ TEMPLATES ============

export function useTemplates() {
  return useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: async () => {
      return db.workoutTemplates.toArray()
    },
  })
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: queryKeys.templates.detail(id),
    queryFn: async () => {
      const template = await db.workoutTemplates.get(id)
      if (!template) throw new Error(`Template ${id} not found`)
      return template
    },
    enabled: !!id,
  })
}

export function useWorkoutDates() {
  return useQuery({
    queryKey: [...queryKeys.workouts.all, "dates"],
    queryFn: async () => {
      const dates = await db.workoutSessions.orderBy("date").uniqueKeys()
      return dates as string[]
    },
  })
}

export function useWorkoutStats(startDate: string, endDate: string) {
  return useQuery({
    queryKey: [...queryKeys.workouts.all, "stats", { startDate, endDate }],
    queryFn: async () => {
      const workouts = await db.workoutSessions
        .where("date")
        .between(startDate, endDate, true, true)
        .toArray()
      return { workouts }
    },
    enabled: !!startDate && !!endDate,
    gcTime: 1000 * 60 * 5, // 5 minutes to prevent memory bloat
  })
}

export function usePersonalRecords() {
  return useQuery({
    queryKey: [...queryKeys.workouts.all, "prs"],
    queryFn: async () => {
      const prs = await db.personalRecords.toArray()
      // Return as object keyed by exerciseId for backward compatibility if needed, 
      // or just as array. The component expects an object.
      return prs.reduce((acc, pr) => {
        acc[pr.exerciseId] = pr
        return acc
      }, {} as Record<string, PersonalRecord>)
    },
  })
}

export function useExerciseHistory(exerciseId: string) {
  return useQuery({
    queryKey: [...queryKeys.workouts.all, "history", exerciseId],
    queryFn: async () => {
      if (!exerciseId) return []
      const workouts = await db.workoutSessions
        .where("exerciseIds")
        .equals(exerciseId)
        .sortBy("date")
      
      return workouts
        .map(workout => {
          const workoutExercise = workout.exercises.find(e => e.exerciseId === exerciseId)
          if (!workoutExercise) return null

          const completedSets = getCompletedSets(workoutExercise.sets)
          if (completedSets.length === 0) return null

          const maxWeight = Math.max(...completedSets.map((s) => s.weight))
          const totalVolume = sumSetVolume(completedSets)
          const totalReps = completedSets.reduce((sum, s) => sum + s.reps, 0)

          return {
            date: workout.date,
            workoutId: workout.id,
            maxWeight,
            totalVolume,
            totalReps,
            sets: completedSets.map((s) => ({ id: s.id, weight: s.weight, reps: s.reps })),
          }
        })
        .filter((h): h is NonNullable<typeof h> => h !== null)
    },
    enabled: !!exerciseId,
  })
}

export function useProgressStats() {
  return useQuery({
    queryKey: [...queryKeys.workouts.all, "progress-stats"],
    queryFn: async () => {
      // Use cached stats for total volume (O(1) instead of O(N))
      const stats = await statsService.getStats()
      const thirtyDaysAgo = getThirtyDaysAgo()
      
      const last30Days = await db.workoutSessions
        .where("date")
        .aboveOrEqual(thirtyDaysAgo)
        .count()

      const prsCount = await db.personalRecords.count()

      return {
        totalWorkouts: stats.totalWorkouts,
        last30Days,
        totalVolume: stats.totalVolumeLbs,
        prsCount,
      }
    },
  })
}
