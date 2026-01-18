import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/services/db"
import type { PersonalRecord, Workout } from "@/lib/types"

/**
 * Hook for fetching workouts by date or recent history.
 */
export function useWorkoutsDB(date?: string, limit: number = 20) {
  const data = useLiveQuery(async () => {
    if (date) {
      return await db.workoutSessions.where("date").equals(date).toArray()
    }
    return await db.workoutSessions.orderBy("date").reverse().limit(limit).toArray()
  }, [date, limit])

  return {
    data: data ?? [],
    isLoading: data === undefined,
  }
}

/**
 * Hook for workout templates.
 */
export function useTemplatesDB() {
  return useLiveQuery(() => db.workoutTemplates.toArray()) ?? []
}

/**
 * Hook for personal records.
 */
export function usePersonalRecordsDB() {
  return useLiveQuery(async () => {
    const prs = await db.personalRecords.toArray()
    const prMap: Record<string, PersonalRecord> = {}
    prs.forEach((pr) => {
      prMap[pr.exerciseId] = pr
    })
    return prMap
  }) ?? {}
}

/**
 * Hook for specific exercise history.
 */
export function useExerciseHistoryDB(exerciseId: string) {
  return useLiveQuery(async () => {
    if (!exerciseId) return []
    
    // Optimized query using the *exerciseIds multi-entry index
    const sessions = await db.workoutSessions
      .where("exerciseIds")
      .equals(exerciseId)
      .sortBy("date")
    
    const history = sessions
      .map((workout) => {
        const workoutExercise = workout.exercises.find((e) => e.exerciseId === exerciseId)
        if (!workoutExercise) return null

        const completedSets = workoutExercise.sets.filter((s) => s.isCompleted)
        if (completedSets.length === 0) return null

        const maxWeight = Math.max(...completedSets.map((s) => s.weight))
        const totalVolume = completedSets.reduce((sum, s) => sum + s.weight * s.reps, 0)
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

    return history
  }, [exerciseId]) ?? []
}

/**
 * Hook for workout statistics/momentum.
 */
export function useWorkoutStatsDB(startDate: string, endDate: string) {
  return useLiveQuery(async () => {
    const workouts = await db.workoutSessions
      .where("date")
      .between(startDate, endDate, true, true)
      .toArray()
    
    return {
      count: workouts.length,
      workouts,
      isLoading: false
    }
  }, [startDate, endDate]) ?? { count: 0, workouts: [] as Workout[], isLoading: true }
}

/**
 * Hook for unique workout dates (for consistency check).
 */
export function useWorkoutDatesDB() {
  return useLiveQuery(async () => {
    // Use uniqueKeys on the indexed 'date' field for better performance
    const keys = await db.workoutSessions.orderBy("date").uniqueKeys()
    return keys.filter((k): k is string => typeof k === "string")
  }) ?? []
}
