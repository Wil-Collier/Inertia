import { db } from "@/services/db"
import { toast } from "sonner"
import type { Workout, WorkoutExercise, WorkoutSet, ActiveWorkoutSession } from "@/lib/types"
import { achievementService } from "@/services/achievementService"
import { buildWorkoutExerciseFromTemplate } from "@/lib/workoutUtils"
import { getToday } from "@/lib/dateUtils"

export const activeSessionService = {
  async getSession(): Promise<ActiveWorkoutSession | null> {
    const session = await db.activeSession.get("current")
    return session || null
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

      // Update streaks and check achievements
      await achievementService.updateWorkoutStreak(completedWorkout.date)
      await achievementService.checkWorkoutAchievements()

      return completedWorkout
    } catch (error) {
      console.error("Failed to finish workout:", error)
      toast.error("Failed to save workout history. Please try again.")
      throw error
    }
  },

  async cancelWorkout() {
    await db.activeSession.delete("current")
  },

  async updateWorkoutName(name: string) {
    await db.activeSession.update("current", { "workout.name": name })
  },

  async addExercise(exerciseId: string) {
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
  },

  async removeExercise(workoutExerciseId: string) {
    await db.transaction("rw", db.activeSession, async () => {
      const session = await db.activeSession.get("current")
      if (!session) return

      session.workout.exercises = session.workout.exercises.filter(e => e.id !== workoutExerciseId)
      await db.activeSession.put(session)
    })
  },

  async reorderExercises(exerciseIds: string[]) {
    await db.transaction("rw", db.activeSession, async () => {
      const session = await db.activeSession.get("current")
      if (!session) return

      const exercisesById = new Map(session.workout.exercises.map(e => [e.id, e]))
      session.workout.exercises = exerciseIds
        .map(id => exercisesById.get(id)!)
        .filter(Boolean)

      await db.activeSession.put(session)
    })
  },

  async updateExerciseNotes(workoutExerciseId: string, notes: string) {
    await db.transaction("rw", db.activeSession, async () => {
      const session = await db.activeSession.get("current")
      if (!session) return

      const exercise = session.workout.exercises.find(e => e.id === workoutExerciseId)
      if (exercise) {
        exercise.notes = notes || undefined
        await db.activeSession.put(session)
      }
    })
  },

  async addSet(workoutExerciseId: string) {
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
  },

  async updateSet(workoutExerciseId: string, setId: string, updates: Partial<WorkoutSet>) {
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
  },

  async removeSet(workoutExerciseId: string, setId: string) {
    await db.transaction("rw", db.activeSession, async () => {
      const session = await db.activeSession.get("current")
      if (!session) return

      const exercise = session.workout.exercises.find(e => e.id === workoutExerciseId)
      if (exercise) {
        exercise.sets = exercise.sets.filter(s => s.id !== setId)
        await db.activeSession.put(session)
      }
    })
  },

  async toggleSetComplete(workoutExerciseId: string, setId: string) {
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
  }
}
