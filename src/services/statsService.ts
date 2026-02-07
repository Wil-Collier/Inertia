import { db } from "@/services/db"
import Dexie from "dexie"
import type { Workout, UserStats } from "@/lib/types"
import { defaultUserStats } from "@/lib/types"
import { KG_TO_LBS } from "@/lib/constants"

/**
 * Service for managing incrementally tracked workout statistics.
 * This avoids expensive full table scans when checking achievements.
 */
export const statsService = {
  /**
   * Get current stats, initializing if not present.
   */
  async getStats(): Promise<UserStats> {
    const data = await db.userStats.get("stats")
    if (!data) {
      // Early-dev correctness: if stats are missing but workouts exist,
      // rebuild from history instead of silently returning zeros.
      const workoutCount = await db.workoutSessions.count()
      if (workoutCount > 0) {
        return await this.recalculateAll()
      }

      const stats = { ...defaultUserStats, id: "stats" }
      await db.userStats.put(stats)
      return stats
    }
    return data
  },

  /**
   * Calculate volume in lbs for a workout (normalized for consistent thresholds).
   */
  calculateWorkoutVolumeLbs(workout: Workout): number {
    const rawVolume = workout.exercises.reduce((exTotal, ex) => {
      return (
        exTotal +
        ex.sets
          .filter((s) => s.isCompleted)
          .reduce((setTotal, set) => setTotal + set.weight * set.reps, 0)
      )
    }, 0)

    // Convert to lbs if workout was recorded in kg
    const conversionFactor = workout.weightUnit === "kg" ? KG_TO_LBS : 1
    return rawVolume * conversionFactor
  },

  /**
   * Add stats for a newly completed workout.
   */
  async addWorkout(workout: Workout): Promise<UserStats> {
    const volumeLbs = this.calculateWorkoutVolumeLbs(workout)

    const run = async () => {
      const existing = await db.userStats.get("stats")
      if (!existing) {
        // If stats are missing, rebuild from persisted history instead of
        // applying a delta, which can double-count when the workout is already saved.
        return await this.recalculateAll()
      }

      const updated: UserStats & { id: string } = {
        id: "stats",
        totalWorkouts: existing.totalWorkouts + 1,
        totalVolumeLbs: existing.totalVolumeLbs + volumeLbs,
        lastUpdated: new Date().toISOString(),
      }
      await db.userStats.put(updated)
      return updated
    }

    if (Dexie.currentTransaction) {
      return await run()
    }

    return await db.transaction("rw", [db.userStats, db.workoutSessions], run)
  },

  /**
   * Remove stats for a deleted workout.
   */
  async removeWorkout(workout: Workout): Promise<UserStats> {
    const volumeLbs = this.calculateWorkoutVolumeLbs(workout)

    const run = async () => {
      const existing = await db.userStats.get("stats")
      if (!existing) {
        // Missing stats should be repaired from history first.
        return await this.recalculateAll()
      }

      const updated: UserStats & { id: string } = {
        id: "stats",
        totalWorkouts: Math.max(0, existing.totalWorkouts - 1),
        totalVolumeLbs: Math.max(0, existing.totalVolumeLbs - volumeLbs),
        lastUpdated: new Date().toISOString(),
      }
      await db.userStats.put(updated)
      return updated
    }

    if (Dexie.currentTransaction) {
      return await run()
    }

    return await db.transaction("rw", [db.userStats, db.workoutSessions], run)
  },

  /**
   * Update stats when a workout is modified.
   * Computes delta between old and new workout.
   */
  async updateWorkout(oldWorkout: Workout, newWorkout: Workout): Promise<UserStats> {
    const oldVolumeLbs = this.calculateWorkoutVolumeLbs(oldWorkout)
    const newVolumeLbs = this.calculateWorkoutVolumeLbs(newWorkout)
    const volumeDelta = newVolumeLbs - oldVolumeLbs

    const run = async () => {
      const existing = await db.userStats.get("stats")
      if (!existing) {
        // Missing stats should be repaired from history first.
        return await this.recalculateAll()
      }

      const updated: UserStats & { id: string } = {
        id: "stats",
        totalWorkouts: existing.totalWorkouts, // count unchanged for update
        totalVolumeLbs: Math.max(0, existing.totalVolumeLbs + volumeDelta),
        lastUpdated: new Date().toISOString(),
      }
      await db.userStats.put(updated)
      return updated
    }

    if (Dexie.currentTransaction) {
      return await run()
    }

    return await db.transaction("rw", [db.userStats, db.workoutSessions], run)
  },

  /**
   * Recalculate all stats from scratch.
   * Use sparingly - only for data recovery or import.
   */
  async recalculateAll(): Promise<UserStats> {
    const run = async () => {
      const workouts = await db.workoutSessions.toArray()

      let totalVolumeLbs = 0
      for (const workout of workouts) {
        totalVolumeLbs += this.calculateWorkoutVolumeLbs(workout)
      }

      const updated: UserStats & { id: string } = {
        id: "stats",
        totalWorkouts: workouts.length,
        totalVolumeLbs,
        lastUpdated: new Date().toISOString(),
      }

      await db.userStats.put(updated)
      return updated
    }

    if (Dexie.currentTransaction) {
      return await run()
    }

    return await db.transaction("rw", [db.userStats, db.workoutSessions], run)
  },
}
