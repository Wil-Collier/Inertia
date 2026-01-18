import { v4 as uuidv4 } from "uuid"
import { format } from "date-fns"
import type { WorkoutSliceCreator, SessionSlice, Workout, WorkoutExercise } from "./types"
import type { PersonalRecord } from "@/lib/types"
import { db } from "@/services/db"
import { getLastPerformance } from "@/services/workoutService"
import { achievementService } from "@/services/achievementService"
import { calculateOneRepMax } from "@/lib/workoutUtils"
import { toast } from "sonner"

export const createSessionSlice: WorkoutSliceCreator<SessionSlice> = (set, get) => ({
  startWorkout: async (name, templateId) => {
    const template = templateId
      ? await db.workoutTemplates.get(templateId)
      : undefined

    const exercises: WorkoutExercise[] = template
      ? await Promise.all(template.exercises.map(async (te) => {
          // Check for last performance to enable progressive overload
          const lastPerf = await getLastPerformance(te.exerciseId)

          if (lastPerf && lastPerf.sets.length > 0) {
            // Use last performance data, but match template set count
            const targetSetCount = te.targetSets
            const lastSets = lastPerf.sets

            return {
              id: uuidv4(),
              exerciseId: te.exerciseId,
              lastPerformanceDate: lastPerf.date,
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
        }))
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
      exerciseIds: session.workout.exercises.map(e => e.exerciseId),
    }

    // Calculate personal records
    const prsToUpdate: Record<string, PersonalRecord> = {}

    // We need to fetch current PRs to compare
    const exerciseIds = completedWorkout.exercises.map(e => e.exerciseId)
    const currentPrs = await db.personalRecords.where("exerciseId").anyOf(exerciseIds).toArray()
    const prMap = new Map(currentPrs.map(pr => [pr.exerciseId, pr]))

    completedWorkout.exercises.forEach((we) => {
      we.sets
        .filter((s) => s.completed && s.weight > 0 && s.reps > 0)
        .forEach((s) => {
          const oneRepMax = calculateOneRepMax(s.weight, s.reps)
          const currentRecord = prMap.get(we.exerciseId)
          const currentMax = currentRecord
            ? calculateOneRepMax(currentRecord.weight, currentRecord.reps)
            : 0

          if (oneRepMax > currentMax) {
            const newPr: PersonalRecord = {
              exerciseId: we.exerciseId,
              weight: s.weight,
              reps: s.reps,
              date: completedWorkout.date,
              workoutId: completedWorkout.id,
            }
            prMap.set(we.exerciseId, newPr) // Update local map for next set of same exercise
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

      set({
        activeSession: null,
      })

      // Update achievements
      achievementService.checkWorkoutAchievements()
      achievementService.updateStreaks()

      return completedWorkout
    } catch (error) {
      console.error("Failed to finish workout:", error)
      toast.error("Failed to save completed workout")
      throw error
    }
  },

  addExerciseToWorkout: async (exerciseId) => {
    // 1. Fetch last performance (async)
    const lastPerf = await getLastPerformance(exerciseId)
    const previousSession = get().activeSession
    
    // 2. Optimistic update
    set((state) => {
      const session = state.activeSession
      if (!session) return state

      let newExercise: WorkoutExercise

      if (lastPerf && lastPerf.sets.length > 0) {
        newExercise = {
          id: uuidv4(),
          exerciseId,
          lastPerformanceDate: lastPerf.date,
          sets: lastPerf.sets.map((s) => ({
            id: uuidv4(),
            reps: s.reps,
            weight: s.weight,
            completed: false,
          })),
        }
      } else {
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

      return { activeSession: newSession }
    })

    // 3. Persist to DB
    const currentSession = get().activeSession
    if (currentSession) {
      try {
        await db.activeSession.put({ id: "current", ...currentSession })
      } catch (error) {
        console.error("Failed to persist new exercise:", error)
        toast.error("Failed to save changes to database")
        set({ activeSession: previousSession })
      }
    }
  },

  removeExerciseFromWorkout: async (workoutExerciseId) => {
    const previousSession = get().activeSession
    set((state) => {
      const session = state.activeSession
      if (!session) return state

      const newSession = {
        ...session,
        workout: {
          ...session.workout,
          exercises: session.workout.exercises.filter(
            (e) => e.id !== workoutExerciseId
          ),
        },
      }

      return { activeSession: newSession }
    })

    const currentSession = get().activeSession
    if (currentSession) {
      try {
        await db.activeSession.put({ id: "current", ...currentSession })
      } catch (error) {
        console.error("Failed to persist removal:", error)
        toast.error("Failed to save changes")
        set({ activeSession: previousSession })
      }
    }
  },

  addSet: async (workoutExerciseId) => {
    const previousSession = get().activeSession
    set((state) => {
      const session = state.activeSession
      if (!session) return state

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

      return { activeSession: newSession }
    })

    const currentSession = get().activeSession
    if (currentSession) {
      try {
        await db.activeSession.put({ id: "current", ...currentSession })
      } catch (error) {
        console.error("Failed to persist new set:", error)
        toast.error("Failed to save changes")
        set({ activeSession: previousSession })
      }
    }
  },

  updateSet: async (workoutExerciseId, setId, updates) => {
    const previousSession = get().activeSession
    set((state) => {
      const session = state.activeSession
      if (!session) return state

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

      return { activeSession: newSession }
    })

    const currentSession = get().activeSession
    if (currentSession) {
      try {
        await db.activeSession.put({ id: "current", ...currentSession })
      } catch (error) {
        console.error("Failed to persist set update:", error)
        toast.error("Failed to save changes")
        set({ activeSession: previousSession })
      }
    }
  },

  removeSet: async (workoutExerciseId, setId) => {
    const previousSession = get().activeSession
    set((state) => {
      const session = state.activeSession
      if (!session) return state

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

      return { activeSession: newSession }
    })

    const currentSession = get().activeSession
    if (currentSession) {
      try {
        await db.activeSession.put({ id: "current", ...currentSession })
      } catch (error) {
        console.error("Failed to persist set removal:", error)
        toast.error("Failed to save changes")
        set({ activeSession: previousSession })
      }
    }
  },

  toggleSetComplete: async (workoutExerciseId, setId) => {
    const previousSession = get().activeSession
    set((state) => {
      const session = state.activeSession
      if (!session) return state

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

      return { activeSession: newSession }
    })

    const currentSession = get().activeSession
    if (currentSession) {
      try {
        await db.activeSession.put({ id: "current", ...currentSession })
      } catch (error) {
        console.error("Failed to persist toggle:", error)
        toast.error("Failed to save changes")
        set({ activeSession: previousSession })
      }
    }
  },

  updateExerciseNotes: async (workoutExerciseId, notes) => {
    const previousSession = get().activeSession
    set((state) => {
      const session = state.activeSession
      if (!session) return state

      const newSession = {
        ...session,
        workout: {
          ...session.workout,
          exercises: session.workout.exercises.map((e) =>
            e.id === workoutExerciseId ? { ...e, notes } : e
          ),
        },
      }

      return { activeSession: newSession }
    })

    const currentSession = get().activeSession
    if (currentSession) {
      try {
        await db.activeSession.put({ id: "current", ...currentSession })
      } catch (error) {
        console.error("Failed to persist notes:", error)
        toast.error("Failed to save changes")
        set({ activeSession: previousSession })
      }
    }
  },

  bumpExerciseWeight: async (workoutExerciseId, increment) => {
    const previousSession = get().activeSession
    set((state) => {
      const session = state.activeSession
      if (!session) return state

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

      return { activeSession: newSession }
    })

    const currentSession = get().activeSession
    if (currentSession) {
      try {
        await db.activeSession.put({ id: "current", ...currentSession })
      } catch (error) {
        console.error("Failed to persist weight bump:", error)
        toast.error("Failed to save changes")
        set({ activeSession: previousSession })
      }
    }
  },
})
