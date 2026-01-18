import { v4 as uuidv4 } from "uuid"
import { format } from "date-fns"
import type { WorkoutSliceCreator, SessionSlice, Workout, WorkoutExercise, WorkoutSet, ActiveWorkoutSession } from "./types"
import type { PersonalRecord } from "@/lib/types"
import { db } from "@/services/db"
import { getLastPerformance } from "@/services/workoutService"
import { achievementService } from "@/services/achievementService"
import { workoutSessionService } from "@/services/workoutSessionService"
import { calculateOneRepMax } from "@/lib/workoutUtils"
import { toast } from "sonner"

export const createSessionSlice: WorkoutSliceCreator<SessionSlice> = (set, get) => {
  // Helper for optimistic updates with persistence
  const withPersistence = async (
    updater: (session: ActiveWorkoutSession) => ActiveWorkoutSession,
    errorMsg: string = "Failed to save changes"
  ) => {
    const previousSession = get().activeSession
    if (!previousSession) return

    // 1. Optimistic update
    set((state) => {
      if (!state.activeSession) return state
      return { activeSession: updater(state.activeSession) }
    })

    // 2. Persist
    const currentSession = get().activeSession
    if (currentSession) {
      try {
        await workoutSessionService.saveActiveSession(currentSession)
      } catch (error) {
        console.error(`${errorMsg}:`, error)
        toast.error(errorMsg)
        set({ activeSession: previousSession })
      }
    }
  }

  return {
    startWorkout: async (name, templateId) => {
      const template = templateId
        ? await db.workoutTemplates.get(templateId)
        : undefined

      const exercises: WorkoutExercise[] = template
        ? await Promise.all(template.exercises.map(async (templateExercise) => {
            const lastPerformance = await getLastPerformance(templateExercise.exerciseId)

            if (lastPerformance && lastPerformance.sets.length > 0) {
              const targetSetCount = templateExercise.targetSets
              const lastPerformanceSets = lastPerformance.sets

              return {
                id: uuidv4(),
                exerciseId: templateExercise.exerciseId,
                lastPerformanceDate: lastPerformance.date,
                sets: Array.from({ length: targetSetCount }, (_, i) => {
                  const lastSetData = lastPerformanceSets[Math.min(i, lastPerformanceSets.length - 1)]
                  const baseWeight = lastSetData?.weight ?? templateExercise.targetWeight ?? 0
                  const baseReps = lastSetData?.reps ?? templateExercise.targetReps ?? 0

                  return {
                    id: uuidv4(),
                    reps: baseReps,
                    weight: baseWeight,
                    isCompleted: false,
                  }
                }),
              }
            }

            return {
              id: uuidv4(),
              exerciseId: templateExercise.exerciseId,
              sets: Array.from({ length: templateExercise.targetSets }, () => ({
                id: uuidv4(),
                reps: templateExercise.targetReps ?? 0,
                weight: templateExercise.targetWeight ?? 0,
                isCompleted: false,
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
        await workoutSessionService.saveActiveSession(session)
        set({ activeSession: session })
      } catch (error) {
        console.error("Failed to start workout:", error)
        toast.error("Failed to start workout")
        throw error
      }
    },

    cancelWorkout: async () => {
      try {
        await workoutSessionService.deleteActiveSession()
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
      const personalRecordsToUpdate: Record<string, PersonalRecord> = {}
      const exerciseIds = completedWorkout.exercises.map(e => e.exerciseId)
      const currentPersonalRecords = await db.personalRecords.where("exerciseId").anyOf(exerciseIds).toArray()
      const personalRecordsMap = new Map(currentPersonalRecords.map(pr => [pr.exerciseId, pr]))

      completedWorkout.exercises.forEach((workoutExercise) => {
        workoutExercise.sets
          .filter((set) => set.isCompleted && set.weight > 0 && set.reps > 0)
          .forEach((set) => {
            const calculatedOneRepMax = calculateOneRepMax(set.weight, set.reps)
            const currentPersonalRecord = personalRecordsMap.get(workoutExercise.exerciseId)
            const currentMax = currentPersonalRecord
              ? calculateOneRepMax(currentPersonalRecord.weight, currentPersonalRecord.reps)
              : 0

            if (calculatedOneRepMax > currentMax) {
              const newPersonalRecord: PersonalRecord = {
                exerciseId: workoutExercise.exerciseId,
                weight: set.weight,
                reps: set.reps,
                date: completedWorkout.date,
                workoutId: completedWorkout.id,
              }
              personalRecordsMap.set(workoutExercise.exerciseId, newPersonalRecord)
              personalRecordsToUpdate[workoutExercise.exerciseId] = newPersonalRecord
            }
          })
      })

      try {
        await db.transaction("rw", [db.workoutSessions, db.personalRecords, db.activeSession], async () => {
          await db.workoutSessions.add(completedWorkout)
          
          if (Object.keys(personalRecordsToUpdate).length > 0) {
            await db.personalRecords.bulkPut(Object.values(personalRecordsToUpdate))
          }

          await workoutSessionService.deleteActiveSession()
        })

        set({ activeSession: null })

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
      const lastPerformance = await getLastPerformance(exerciseId)
      
      await withPersistence((session: ActiveWorkoutSession) => {
        let newExercise: WorkoutExercise

        if (lastPerformance && lastPerformance.sets.length > 0) {
          newExercise = {
            id: uuidv4(),
            exerciseId,
            lastPerformanceDate: lastPerformance.date,
            sets: lastPerformance.sets.map((set) => ({
              id: uuidv4(),
              reps: set.reps,
              weight: set.weight,
              isCompleted: false,
            })),
          }
        } else {
          newExercise = {
            id: uuidv4(),
            exerciseId,
            sets: [{ id: uuidv4(), reps: 0, weight: 0, isCompleted: false }],
          }
        }

        return {
          ...session,
          workout: {
            ...session.workout,
            exercises: [...session.workout.exercises, newExercise],
          },
        }
      }, "Failed to add exercise")
    },

    removeExerciseFromWorkout: async (workoutExerciseId) => {
      await withPersistence((session: ActiveWorkoutSession) => ({
        ...session,
        workout: {
          ...session.workout,
          exercises: session.workout.exercises.filter(
            (workoutExercise: WorkoutExercise) => workoutExercise.id !== workoutExerciseId
          ),
        },
      }), "Failed to remove exercise")
    },

    addSet: async (workoutExerciseId) => {
      await withPersistence((session: ActiveWorkoutSession) => ({
        ...session,
        workout: {
          ...session.workout,
          exercises: session.workout.exercises.map((workoutExercise: WorkoutExercise) =>
            workoutExercise.id === workoutExerciseId
              ? {
                  ...workoutExercise,
                  sets: [
                    ...workoutExercise.sets,
                    {
                      id: uuidv4(),
                      reps: workoutExercise.sets[workoutExercise.sets.length - 1]?.reps ?? 0,
                      weight: workoutExercise.sets[workoutExercise.sets.length - 1]?.weight ?? 0,
                      isCompleted: false,
                    },
                  ],
                }
              : workoutExercise
          ),
        },
      }), "Failed to add set")
    },

    updateSet: async (workoutExerciseId, setId, updates) => {
      await withPersistence((session: ActiveWorkoutSession) => ({
        ...session,
        workout: {
          ...session.workout,
          exercises: session.workout.exercises.map((workoutExercise: WorkoutExercise) =>
            workoutExercise.id === workoutExerciseId
              ? {
                  ...workoutExercise,
                  sets: workoutExercise.sets.map((set: WorkoutSet) =>
                    set.id === setId ? { ...set, ...updates } : set
                  ),
                }
              : workoutExercise
          ),
        },
      }), "Failed to update set")
    },

    removeSet: async (workoutExerciseId, setId) => {
      await withPersistence((session: ActiveWorkoutSession) => ({
        ...session,
        workout: {
          ...session.workout,
          exercises: session.workout.exercises.map((workoutExercise: WorkoutExercise) =>
            workoutExercise.id === workoutExerciseId
              ? {
                  ...workoutExercise,
                  sets: workoutExercise.sets.filter((set: WorkoutSet) => set.id !== setId),
                }
              : workoutExercise
          ),
        },
      }), "Failed to remove set")
    },

    toggleSetComplete: async (workoutExerciseId, setId) => {
      await withPersistence((session: ActiveWorkoutSession) => ({
        ...session,
        workout: {
          ...session.workout,
          exercises: session.workout.exercises.map((workoutExercise: WorkoutExercise) =>
            workoutExercise.id === workoutExerciseId
              ? {
                  ...workoutExercise,
                  sets: workoutExercise.sets.map((set: WorkoutSet) =>
                    set.id === setId ? { ...set, isCompleted: !set.isCompleted } : set
                  ),
                }
              : workoutExercise
          ),
        },
      }), "Failed to toggle set")
    },

    updateExerciseNotes: async (workoutExerciseId, notes) => {
      await withPersistence((session: ActiveWorkoutSession) => ({
        ...session,
        workout: {
          ...session.workout,
          exercises: session.workout.exercises.map((workoutExercise: WorkoutExercise) =>
            workoutExercise.id === workoutExerciseId ? { ...workoutExercise, notes } : workoutExercise
          ),
        },
      }), "Failed to update notes")
    },

    bumpExerciseWeight: async (workoutExerciseId, increment) => {
      await withPersistence((session: ActiveWorkoutSession) => ({
        ...session,
        workout: {
          ...session.workout,
          exercises: session.workout.exercises.map((workoutExercise: WorkoutExercise) =>
            workoutExercise.id === workoutExerciseId
              ? {
                  ...workoutExercise,
                  sets: workoutExercise.sets.map((set: WorkoutSet) =>
                    set.isCompleted ? set : { ...set, weight: set.weight + increment }
                  ),
                }
              : workoutExercise
          ),
        },
      }), "Failed to update weight")
    },
  }
}
