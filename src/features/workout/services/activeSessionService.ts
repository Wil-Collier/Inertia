import { db } from "@/services/db"
import { toast } from "sonner"
import type { Workout, WorkoutExercise, WorkoutSet, ActiveWorkoutSession } from "@/lib/types"
import { achievementService } from "@/services/achievementService"
import { statsService } from "@/services/statsService"
import { buildWorkoutExerciseFromTemplate, calculateOneRepMax } from "@/lib/workoutUtils"
import { getToday } from "@/lib/dateUtils"
import { ACTIVE_SESSION_ID } from "@/lib/constants"

/** Defer a callback to run in the background without blocking UI */
function deferToBackground(callback: () => void) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: 2000 })
  } else {
    setTimeout(callback, 0)
  }
}

/**
 * Updates personal records for a completed workout.
 * Compares the best set from each exercise against existing PRs.
 * Note: Sequential await in loop is intentional for transactional consistency.
 */
async function updatePersonalRecords(workout: Workout): Promise<void> {
  const exercisesToUpdate: { exerciseId: string, pr: { exerciseId: string, weight: number, reps: number, date: string, workoutId: string } }[] = []
  const bestByExerciseId = new Map<
    string,
    {
      exerciseId: string
      weight: number
      reps: number
      date: string
      workoutId: string
      e1rm: number
    }
  >()
  
  // 1. Fetch all existing PRs in parallel
  const exerciseIds = workout.exercises.map(e => e.exerciseId)
  const existingPRs = await db.personalRecords.bulkGet(exerciseIds)
  const existingPRMap = new Map(existingPRs.filter(Boolean).map(pr => [pr!.exerciseId, pr!]))

  // 2. Calculate updates in memory
  for (const exercise of workout.exercises) {
    const completedSets = exercise.sets.filter(s => s.isCompleted && s.weight > 0 && s.reps > 0)
    if (completedSets.length === 0) continue

    // Find the best set by estimated 1RM
    let bestSet = completedSets[0]
    let bestE1RM = calculateOneRepMax(bestSet.weight, bestSet.reps)

    for (const set of completedSets) {
      const e1rm = calculateOneRepMax(set.weight, set.reps)
      if (e1rm > bestE1RM) {
        bestE1RM = e1rm
        bestSet = set
      }
    }

    const currentBest = bestByExerciseId.get(exercise.exerciseId)
    if (!currentBest || bestE1RM > currentBest.e1rm) {
      bestByExerciseId.set(exercise.exerciseId, {
        exerciseId: exercise.exerciseId,
        weight: bestSet.weight,
        reps: bestSet.reps,
        date: workout.date,
        workoutId: workout.id,
        e1rm: bestE1RM,
      })
    }
  }

  for (const best of bestByExerciseId.values()) {
    const existingPR = existingPRMap.get(best.exerciseId)
    const existingE1RM = existingPR
      ? calculateOneRepMax(existingPR.weight, existingPR.reps)
      : 0

    // Queue update if this is a new record
    if (best.e1rm > existingE1RM) {
      exercisesToUpdate.push({
        exerciseId: best.exerciseId,
        pr: {
          exerciseId: best.exerciseId,
          weight: best.weight,
          reps: best.reps,
          date: best.date,
          workoutId: best.workoutId,
        }
      })
    }
  }

  // 3. Perform bulk update
  if (exercisesToUpdate.length > 0) {
    await db.personalRecords.bulkPut(exercisesToUpdate.map(e => e.pr))
  }
}

export const activeSessionService = {
  async getSession(): Promise<ActiveWorkoutSession | null> {
    const session = await db.activeSession.get(ACTIVE_SESSION_ID)
    return session || null
  },

  /**
   * Check if an active session exists (lightweight check for route guards)
   */
  async hasActiveSession(): Promise<boolean> {
    const session = await db.activeSession.get(ACTIVE_SESSION_ID)
    return !!session
  },

  async startWorkout(name: string, templateId?: string, exercises: WorkoutExercise[] = []) {
    try {
      let resolvedExercises = exercises

      if (templateId && resolvedExercises.length === 0) {
        const template = await db.workoutTemplates.get(templateId)
        if (template) {
          resolvedExercises = template.exercises.map(buildWorkoutExerciseFromTemplate)
        }
      }

      // Capture weight unit at session start for data integrity
      const settings = await db.settings.get("settings")
      const weightUnit = settings?.unitPreferences?.weight ?? "kg"

      const workout: Workout = {
        id: crypto.randomUUID(),
        name,
        date: getToday(),
        exercises: resolvedExercises,
        weightUnit,
      }

      const session: ActiveWorkoutSession = {
        workout,
        startedAt: new Date().toISOString(),
        templateId,
      }

      await db.transaction("rw", [db.activeSession, db.syncPendingChanges, db.syncRecordVersions], async () => {
        await db.activeSession.put({ id: ACTIVE_SESSION_ID, ...session })
      })
      return session
    } catch (error) {
      console.error("Failed to start workout:", error)
      toast.error("Failed to start workout")
      throw error
    }
  },

  async finishWorkout() {
    try {
      const session = await db.activeSession.get(ACTIVE_SESSION_ID)
      if (!session) return null

      const completedWorkout: Workout = {
        ...session.workout,
        completedAt: new Date().toISOString(),
        exerciseIds: session.workout.exercises.map((e) => e.exerciseId),
      }

      await db.transaction(
        "rw",
        [db.workoutSessions, db.activeSession, db.personalRecords, db.userStats, db.syncPendingChanges, db.syncRecordVersions],
        async () => {
        await db.workoutSessions.add(completedWorkout)
        await db.activeSession.delete(ACTIVE_SESSION_ID)

        // Update incremental stats
        await statsService.addWorkout(completedWorkout)

        // Check and update personal records
        await updatePersonalRecords(completedWorkout)
      })

      // Defer achievement checks to background so they don't block UI
      deferToBackground(() => {
        // Run streak update and achievement checks without blocking
        // The dynamic import is safe here since we're not in a transaction
        achievementService.updateStreaks()
          .then(async () => {
            const { exerciseDatabaseMap } = await import("@/data/exerciseDatabase")
            return achievementService.checkWorkoutAchievements(exerciseDatabaseMap)
          })
          .catch((error) => console.error("Background achievement check failed:", error))
      })

      return completedWorkout
    } catch (error) {
      console.error("Failed to finish workout:", error)
      toast.error("Failed to save workout history. Please try again.")
      throw error
    }
  },

  async cancelWorkout() {
    try {
      await db.transaction("rw", [db.activeSession, db.syncPendingChanges, db.syncRecordVersions], async () => {
        await db.activeSession.delete(ACTIVE_SESSION_ID)
      })
    } catch (error) {
      console.error("Failed to cancel workout:", error)
      toast.error("Failed to cancel workout")
      throw error
    }
  },

  async updateWorkoutName(name: string) {
    try {
      await db.transaction("rw", [db.activeSession, db.syncPendingChanges, db.syncRecordVersions], async () => {
        await db.activeSession.update(ACTIVE_SESSION_ID, { "workout.name": name })
      })
    } catch (error) {
      console.error("Failed to update workout name:", error)
      toast.error("Failed to update workout name")
      throw error
    }
  },

  async addExercise(exerciseId: string) {
    try {
      await db.transaction("rw", [db.activeSession, db.syncPendingChanges, db.syncRecordVersions], async () => {
        const session = await db.activeSession.get(ACTIVE_SESSION_ID)
        if (!session) return

        const newExercise: WorkoutExercise = {
          id: crypto.randomUUID(),
          exerciseId,
          sets: [{ id: crypto.randomUUID(), reps: 0, weight: 0, isCompleted: false }],
        }

        session.workout.exercises.push(newExercise)
        await db.activeSession.put(session)
      })
    } catch (error) {
      console.error("Failed to add exercise:", error)
      toast.error("Failed to add exercise")
      throw error
    }
  },

  async removeExercise(workoutExerciseId: string) {
    try {
      await db.transaction("rw", [db.activeSession, db.syncPendingChanges, db.syncRecordVersions], async () => {
        const session = await db.activeSession.get(ACTIVE_SESSION_ID)
        if (!session) return

        session.workout.exercises = session.workout.exercises.filter(e => e.id !== workoutExerciseId)
        await db.activeSession.put(session)
      })
    } catch (error) {
      console.error("Failed to remove exercise:", error)
      toast.error("Failed to remove exercise")
      throw error
    }
  },

  async reorderExercises(exerciseIds: string[]) {
    try {
      await db.transaction("rw", [db.activeSession, db.syncPendingChanges, db.syncRecordVersions], async () => {
        const session = await db.activeSession.get(ACTIVE_SESSION_ID)
        if (!session) return

        const exercisesById = new Map(session.workout.exercises.map(e => [e.id, e]))
        const seenExerciseIds = new Set<string>()
        const uniqueExerciseIds = exerciseIds.filter((id) => {
          if (seenExerciseIds.has(id)) return false
          seenExerciseIds.add(id)
          return true
        })

        // Build reordered list, filtering out any missing exercises
        const reorderedExercises = uniqueExerciseIds
          .map(id => exercisesById.get(id))
          .filter((exercise): exercise is NonNullable<typeof exercise> => exercise !== undefined)

        // Preserve any exercises that weren't in the provided list (safety measure)
        const reorderedIds = new Set(uniqueExerciseIds)
        const preservedExercises = session.workout.exercises.filter(e => !reorderedIds.has(e.id))

        session.workout.exercises = [...reorderedExercises, ...preservedExercises]

        await db.activeSession.put(session)
      })
    } catch (error) {
      console.error("Failed to reorder exercises:", error)
      toast.error("Failed to reorder exercises")
      throw error
    }
  },

  async updateExerciseNotes(workoutExerciseId: string, notes: string) {
    try {
      await db.transaction("rw", [db.activeSession, db.syncPendingChanges, db.syncRecordVersions], async () => {
        const session = await db.activeSession.get(ACTIVE_SESSION_ID)
        if (!session) return

        const exercise = session.workout.exercises.find(e => e.id === workoutExerciseId)
        if (exercise) {
          exercise.notes = notes || undefined
          await db.activeSession.put(session)
        }
      })
    } catch (error) {
      console.error("Failed to update exercise notes:", error)
      toast.error("Failed to update notes")
      throw error
    }
  },

  async addSet(workoutExerciseId: string) {
    try {
      await db.transaction("rw", [db.activeSession, db.syncPendingChanges, db.syncRecordVersions], async () => {
        const session = await db.activeSession.get(ACTIVE_SESSION_ID)
        if (!session) return

        const exercise = session.workout.exercises.find(e => e.id === workoutExerciseId)
        if (exercise) {
          const lastSet = exercise.sets[exercise.sets.length - 1]
          const newSet: WorkoutSet = {
            id: crypto.randomUUID(),
            reps: lastSet?.reps ?? 0,
            weight: lastSet?.weight ?? 0,
            isCompleted: false
          }
          exercise.sets.push(newSet)
          await db.activeSession.put(session)
        }
      })
    } catch (error) {
      console.error("Failed to add set:", error)
      toast.error("Failed to add set")
      throw error
    }
  },

  async updateSet(workoutExerciseId: string, setId: string, updates: Partial<WorkoutSet>) {
    try {
      await db.transaction("rw", [db.activeSession, db.syncPendingChanges, db.syncRecordVersions], async () => {
        const session = await db.activeSession.get(ACTIVE_SESSION_ID)
        if (!session) return

        const exercise = session.workout.exercises.find(e => e.id === workoutExerciseId)
        if (exercise) {
          const setIndex = exercise.sets.findIndex(s => s.id === setId)
          if (setIndex !== -1) {
            exercise.sets[setIndex] = { ...exercise.sets[setIndex], ...updates }
            await db.activeSession.put(session)
          }
        }
      })
    } catch (error) {
      console.error("Failed to update set:", error)
      toast.error("Failed to update set")
      throw error
    }
  },

  async removeSet(workoutExerciseId: string, setId: string) {
    try {
      await db.transaction("rw", [db.activeSession, db.syncPendingChanges, db.syncRecordVersions], async () => {
        const session = await db.activeSession.get(ACTIVE_SESSION_ID)
        if (!session) return

        const exercise = session.workout.exercises.find(e => e.id === workoutExerciseId)
        if (exercise) {
          exercise.sets = exercise.sets.filter(s => s.id !== setId)
          await db.activeSession.put(session)
        }
      })
    } catch (error) {
      console.error("Failed to remove set:", error)
      toast.error("Failed to remove set")
      throw error
    }
  },

  async toggleSetComplete(workoutExerciseId: string, setId: string) {
    try {
      await db.transaction("rw", [db.activeSession, db.syncPendingChanges, db.syncRecordVersions], async () => {
        const session = await db.activeSession.get(ACTIVE_SESSION_ID)
        if (!session) return

        const exercise = session.workout.exercises.find(e => e.id === workoutExerciseId)
        if (exercise) {
          const setIndex = exercise.sets.findIndex(s => s.id === setId)
          if (setIndex !== -1) {
            exercise.sets[setIndex].isCompleted = !exercise.sets[setIndex].isCompleted
            await db.activeSession.put(session)
          }
        }
      })
    } catch (error) {
      console.error("Failed to toggle set completion:", error)
      toast.error("Failed to update set")
      throw error
    }
  }
}
