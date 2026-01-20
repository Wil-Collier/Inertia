import { db } from "@/services/db"
import { toast } from "sonner"
import type { Workout, WorkoutExercise, WorkoutSet, ActiveWorkoutSession } from "@/lib/types"
import { achievementService } from "@/services/achievementService"
import { buildWorkoutExerciseFromTemplate } from "@/lib/workoutUtils"
import { getToday } from "@/lib/dateUtils"

/** Defer a callback to run in the background without blocking UI */
function deferToBackground(callback: () => void) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: 2000 })
  } else {
    setTimeout(callback, 0)
  }
}

export const activeSessionService = {
  async getSession(): Promise<ActiveWorkoutSession | null> {
    const session = await db.activeSession.get("current")
    return session || null
  },

  /**
   * Check if an active session exists (lightweight check for route guards)
   */
  async hasActiveSession(): Promise<boolean> {
    const session = await db.activeSession.get("current")
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

      await db.activeSession.put({ id: "current", ...session })
      return session
    } catch (error) {
      console.error("Failed to start workout:", error)
      toast.error("Failed to start workout")
      throw error
    }
  },

  async finishWorkout() {
    try {
      const session = await db.activeSession.get("current")
      if (!session) return null

      const completedWorkout: Workout = {
        ...session.workout,
        completedAt: new Date().toISOString(),
        exerciseIds: session.workout.exercises.map((e) => e.exerciseId),
      }

      await db.transaction("rw", [db.workoutSessions, db.activeSession], async () => {
        await db.workoutSessions.add(completedWorkout)
        await db.activeSession.delete("current")
      })

      // Defer achievement checks to background so they don't block UI
      deferToBackground(() => {
        // Run streak update and achievement checks without blocking
        achievementService.updateWorkoutStreak(completedWorkout.date)
          .then(() => achievementService.checkWorkoutAchievements())
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
      await db.activeSession.delete("current")
    } catch (error) {
      console.error("Failed to cancel workout:", error)
      toast.error("Failed to cancel workout")
      throw error
    }
  },

  async updateWorkoutName(name: string) {
    try {
      await db.activeSession.update("current", { "workout.name": name })
    } catch (error) {
      console.error("Failed to update workout name:", error)
      toast.error("Failed to update workout name")
      throw error
    }
  },

  async addExercise(exerciseId: string) {
    try {
      await db.transaction("rw", db.activeSession, async () => {
        const session = await db.activeSession.get("current")
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
      await db.transaction("rw", db.activeSession, async () => {
        const session = await db.activeSession.get("current")
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
      await db.transaction("rw", db.activeSession, async () => {
        const session = await db.activeSession.get("current")
        if (!session) return

        const exercisesById = new Map(session.workout.exercises.map(e => [e.id, e]))
        
        // Build reordered list, filtering out any missing exercises
        const reorderedExercises = exerciseIds
          .map(id => exercisesById.get(id))
          .filter((exercise): exercise is NonNullable<typeof exercise> => exercise !== undefined)
        
        // Preserve any exercises that weren't in the provided list (safety measure)
        const reorderedIds = new Set(exerciseIds)
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
      await db.transaction("rw", db.activeSession, async () => {
        const session = await db.activeSession.get("current")
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
      await db.transaction("rw", db.activeSession, async () => {
        const session = await db.activeSession.get("current")
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
      await db.transaction("rw", db.activeSession, async () => {
        const session = await db.activeSession.get("current")
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
      await db.transaction("rw", db.activeSession, async () => {
        const session = await db.activeSession.get("current")
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
      await db.transaction("rw", db.activeSession, async () => {
        const session = await db.activeSession.get("current")
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
