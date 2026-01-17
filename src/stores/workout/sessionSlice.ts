import { v4 as uuidv4 } from "uuid"
import { format } from "date-fns"
import type { WorkoutSliceCreator, SessionSlice, Workout, WorkoutExercise } from "./types"
import type { PersonalRecord } from "@/lib/types"
import { db } from "@/services/db"
import { toast } from "sonner"

export const createSessionSlice: WorkoutSliceCreator<SessionSlice> = (set, get) => ({
  startWorkout: async (name, templateId) => {
    const template = templateId
      ? get().templates.find((t) => t.id === templateId)
      : undefined

    const exercises: WorkoutExercise[] = template
      ? template.exercises.map((te) => {
          // Check for last performance to enable progressive overload
          const lastPerformance = get().getLastPerformance(te.exerciseId)

          if (lastPerformance && lastPerformance.sets.length > 0) {
            // Use last performance data, but match template set count
            const targetSetCount = te.targetSets
            const lastSets = lastPerformance.sets

            return {
              id: uuidv4(),
              exerciseId: te.exerciseId,
              lastPerformanceDate: lastPerformance.date,
              sets: Array.from({ length: targetSetCount }, (_, i) => {
                const lastSetData = lastSets[Math.min(i, lastSets.length - 1)]
                const baseWeight = lastSetData?.weight ?? te.targetWeight ?? 0
                const baseReps = lastSetData?.reps ?? te.targetReps ?? 0

                return {
                  id: uuidv4(),
                  reps: baseReps,
                  weight: baseWeight,
                  completed: false,
                }
              }),
            }
          }

          // No history - use template defaults
          return {
            id: uuidv4(),
            exerciseId: te.exerciseId,
            sets: Array.from({ length: te.targetSets }, () => ({
              id: uuidv4(),
              reps: te.targetReps ?? 0,
              weight: te.targetWeight ?? 0,
              completed: false,
            })),
          }
        })
      : []

    const workout: Workout = {
      id: uuidv4(),
      date: format(new Date(), "yyyy-MM-dd"),
      name,
      exercises,
    }

    const session = {
      workout,
      startedAt: new Date().toISOString(),
      templateId,
    }

    try {
      await db.activeSession.put({ id: "current", ...session })
      set({ activeSession: session })
    } catch (error) {
      console.error("Failed to start workout:", error)
      toast.error("Failed to start workout")
      throw error
    }
  },

  cancelWorkout: async () => {
    try {
      await db.activeSession.delete("current")
      set({ activeSession: null })
    } catch (error) {
      console.error("Failed to cancel workout:", error)
      toast.error("Failed to cancel workout")
      throw error
    }
  },

  finishWorkout: async () => {
    const session = get().activeSession
    if (!session) return null

    const startTime = new Date(session.startedAt).getTime()
    const endTime = Date.now()
    const duration = Math.round((endTime - startTime) / 1000 / 60)

    const completedWorkout: Workout = {
      ...session.workout,
      duration,
      completedAt: new Date().toISOString(),
    }

    // Calculate personal records
    const newRecords = { ...get().personalRecords }
    const prsToUpdate: Record<string, PersonalRecord> = {}

    completedWorkout.exercises.forEach((we) => {
      we.sets
        .filter((s) => s.completed && s.weight > 0 && s.reps > 0)
        .forEach((s) => {
          const oneRepMax = get().calculateOneRepMax(s.weight, s.reps)
          const currentRecord = newRecords[we.exerciseId]
          const currentMax = currentRecord
            ? get().calculateOneRepMax(currentRecord.weight, currentRecord.reps)
            : 0

          if (oneRepMax > currentMax) {
            // DB uses exerciseId as primary key - one PR per exercise (current max)
            const newPr: PersonalRecord = {
              exerciseId: we.exerciseId,
              weight: s.weight,
              reps: s.reps,
              date: completedWorkout.date,
              workoutId: completedWorkout.id,
            }
            newRecords[we.exerciseId] = newPr
            prsToUpdate[we.exerciseId] = newPr
          }
        })
    })

    try {
      // Use a transaction for the final completion
      await db.transaction("rw", [db.workoutSessions, db.personalRecords, db.activeSession], async () => {
        await db.workoutSessions.add(completedWorkout)
        
        if (Object.keys(prsToUpdate).length > 0) {
          await db.personalRecords.bulkPut(Object.values(prsToUpdate))
        }

        await db.activeSession.delete("current")
      })

      set((state) => ({
        workouts: [...state.workouts, completedWorkout],
        activeSession: null,
        personalRecords: newRecords,
      }))

      return completedWorkout
    } catch (error) {
      console.error("Failed to finish workout:", error)
      toast.error("Failed to save completed workout")
      throw error
    }
  },

  addExerciseToWorkout: async (exerciseId) => {
    const lastPerformance = get().getLastPerformance(exerciseId)
    const session = get().activeSession
    if (!session) return

    let newExercise: WorkoutExercise

    if (lastPerformance && lastPerformance.sets.length > 0) {
      // Pre-fill with last performance data
      newExercise = {
        id: uuidv4(),
        exerciseId,
        lastPerformanceDate: lastPerformance.date,
        sets: lastPerformance.sets.map((s) => ({
          id: uuidv4(),
          reps: s.reps,
          weight: s.weight,
          completed: false,
        })),
      }
    } else {
      // No history - create single empty set
      newExercise = {
        id: uuidv4(),
        exerciseId,
        sets: [
          {
            id: uuidv4(),
            reps: 0,
            weight: 0,
            completed: false,
          },
        ],
      }
    }

    const newSession = {
      ...session,
      workout: {
        ...session.workout,
        exercises: [...session.workout.exercises, newExercise],
      },
    }

    try {
      await db.activeSession.put({ id: "current", ...newSession })
      set({ activeSession: newSession })
    } catch (error) {
      console.error("Failed to add exercise:", error)
      toast.error("Failed to update workout session")
      throw error
    }
  },

  removeExerciseFromWorkout: async (workoutExerciseId) => {
    const session = get().activeSession
    if (!session) return

    const newSession = {
      ...session,
      workout: {
        ...session.workout,
        exercises: session.workout.exercises.filter(
          (e) => e.id !== workoutExerciseId
        ),
      },
    }

    try {
      await db.activeSession.put({ id: "current", ...newSession })
      set({ activeSession: newSession })
    } catch (error) {
      console.error("Failed to remove exercise:", error)
      toast.error("Failed to update workout session")
      throw error
    }
  },

  addSet: async (workoutExerciseId) => {
    const session = get().activeSession
    if (!session) return

    const newSession = {
      ...session,
      workout: {
        ...session.workout,
        exercises: session.workout.exercises.map((e) =>
          e.id === workoutExerciseId
            ? {
                ...e,
                sets: [
                  ...e.sets,
                  {
                    id: uuidv4(),
                    reps: e.sets[e.sets.length - 1]?.reps ?? 0,
                    weight: e.sets[e.sets.length - 1]?.weight ?? 0,
                    completed: false,
                  },
                ],
              }
            : e
        ),
      },
    }

    try {
      await db.activeSession.put({ id: "current", ...newSession })
      set({ activeSession: newSession })
    } catch (error) {
      console.error("Failed to add set:", error)
      toast.error("Failed to update workout session")
      throw error
    }
  },

  updateSet: async (workoutExerciseId, setId, updates) => {
    const session = get().activeSession
    if (!session) return

    const newSession = {
      ...session,
      workout: {
        ...session.workout,
        exercises: session.workout.exercises.map((e) =>
          e.id === workoutExerciseId
            ? {
                ...e,
                sets: e.sets.map((s) =>
                  s.id === setId ? { ...s, ...updates } : s
                ),
              }
            : e
        ),
      },
    }

    try {
      await db.activeSession.put({ id: "current", ...newSession })
      set({ activeSession: newSession })
    } catch (error) {
      console.error("Failed to update set:", error)
      toast.error("Failed to update workout session")
      throw error
    }
  },

  removeSet: async (workoutExerciseId, setId) => {
    const session = get().activeSession
    if (!session) return

    const newSession = {
      ...session,
      workout: {
        ...session.workout,
        exercises: session.workout.exercises.map((e) =>
          e.id === workoutExerciseId
            ? {
                ...e,
                sets: e.sets.filter((s) => s.id !== setId),
              }
            : e
        ),
      },
    }

    try {
      await db.activeSession.put({ id: "current", ...newSession })
      set({ activeSession: newSession })
    } catch (error) {
      console.error("Failed to remove set:", error)
      toast.error("Failed to update workout session")
      throw error
    }
  },

  toggleSetComplete: async (workoutExerciseId, setId) => {
    const session = get().activeSession
    if (!session) return

    const newSession = {
      ...session,
      workout: {
        ...session.workout,
        exercises: session.workout.exercises.map((e) =>
          e.id === workoutExerciseId
            ? {
                ...e,
                sets: e.sets.map((s) =>
                  s.id === setId ? { ...s, completed: !s.completed } : s
                ),
              }
            : e
        ),
      },
    }

    try {
      await db.activeSession.put({ id: "current", ...newSession })
      set({ activeSession: newSession })
    } catch (error) {
      console.error("Failed to toggle set:", error)
      toast.error("Failed to update workout session")
      throw error
    }
  },

  updateExerciseNotes: async (workoutExerciseId, notes) => {
    const session = get().activeSession
    if (!session) return

    const newSession = {
      ...session,
      workout: {
        ...session.workout,
        exercises: session.workout.exercises.map((e) =>
          e.id === workoutExerciseId ? { ...e, notes } : e
        ),
      },
    }

    try {
      await db.activeSession.put({ id: "current", ...newSession })
      set({ activeSession: newSession })
    } catch (error) {
      console.error("Failed to update notes:", error)
      toast.error("Failed to update workout session")
      throw error
    }
  },

  bumpExerciseWeight: async (workoutExerciseId, increment) => {
    const session = get().activeSession
    if (!session) return

    const newSession = {
      ...session,
      workout: {
        ...session.workout,
        exercises: session.workout.exercises.map((e) =>
          e.id === workoutExerciseId
            ? {
                ...e,
                sets: e.sets.map((s) =>
                  s.completed
                    ? s // Don't modify completed sets
                    : { ...s, weight: s.weight + increment }
                ),
              }
            : e
        ),
      },
    }

    try {
      await db.activeSession.put({ id: "current", ...newSession })
      set({ activeSession: newSession })
    } catch (error) {
      console.error("Failed to bump weight:", error)
      toast.error("Failed to update workout session")
      throw error
    }
  },
})
