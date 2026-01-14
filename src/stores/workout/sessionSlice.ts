import { v4 as uuidv4 } from "uuid"
import { format } from "date-fns"
import type { WorkoutSliceCreator, SessionSlice, Workout, WorkoutExercise } from "./types"

export const createSessionSlice: WorkoutSliceCreator<SessionSlice> = (set, get) => ({
  startWorkout: (name, templateId) => {
    const template = templateId
      ? get().templates.find((t) => t.id === templateId)
      : undefined

    const exercises: WorkoutExercise[] = template
      ? template.exercises.map((te) => {
          // Check for last performance to enable progressive overload
          const lastPerformance = get().getLastPerformance(te.exerciseId)

          if (lastPerformance && lastPerformance.sets.length > 0) {
            // Get progression suggestion to auto-apply smart weight
            const suggestion = get().getProgressionSuggestion(te.exerciseId)
            const useProgressedWeight = suggestion?.type === "increase"

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
                  // Apply suggested progression if ready
                  weight:
                    useProgressedWeight && suggestion
                      ? suggestion.suggestedWeight
                      : baseWeight,
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

    set({
      activeSession: {
        workout,
        startedAt: new Date().toISOString(),
        templateId,
      },
    })
  },

  cancelWorkout: () => {
    set({ activeSession: null })
  },

  finishWorkout: () => {
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
            newRecords[we.exerciseId] = {
              exerciseId: we.exerciseId,
              weight: s.weight,
              reps: s.reps,
              date: completedWorkout.date,
              workoutId: completedWorkout.id,
            }
          }
        })
    })

    set((state) => ({
      workouts: [...state.workouts, completedWorkout],
      activeSession: null,
      personalRecords: newRecords,
    }))

    return completedWorkout
  },

  addExerciseToWorkout: (exerciseId) => {
    const lastPerformance = get().getLastPerformance(exerciseId)

    set((state) => {
      if (!state.activeSession) return state

      let newExercise: WorkoutExercise

      if (lastPerformance && lastPerformance.sets.length > 0) {
        // Get progression suggestion for smart weight pre-fill
        const suggestion = get().getProgressionSuggestion(exerciseId)
        const useProgressedWeight = suggestion?.type === "increase"

        // Pre-fill with last performance data, applying progression if suggested
        newExercise = {
          id: uuidv4(),
          exerciseId,
          lastPerformanceDate: lastPerformance.date,
          sets: lastPerformance.sets.map((s) => ({
            id: uuidv4(),
            reps: s.reps,
            weight:
              useProgressedWeight && suggestion
                ? suggestion.suggestedWeight
                : s.weight,
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

      return {
        activeSession: {
          ...state.activeSession,
          workout: {
            ...state.activeSession.workout,
            exercises: [...state.activeSession.workout.exercises, newExercise],
          },
        },
      }
    })
  },

  removeExerciseFromWorkout: (workoutExerciseId) => {
    set((state) => {
      if (!state.activeSession) return state

      return {
        activeSession: {
          ...state.activeSession,
          workout: {
            ...state.activeSession.workout,
            exercises: state.activeSession.workout.exercises.filter(
              (e) => e.id !== workoutExerciseId
            ),
          },
        },
      }
    })
  },

  addSet: (workoutExerciseId) => {
    set((state) => {
      if (!state.activeSession) return state

      return {
        activeSession: {
          ...state.activeSession,
          workout: {
            ...state.activeSession.workout,
            exercises: state.activeSession.workout.exercises.map((e) =>
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
        },
      }
    })
  },

  updateSet: (workoutExerciseId, setId, updates) => {
    set((state) => {
      if (!state.activeSession) return state

      return {
        activeSession: {
          ...state.activeSession,
          workout: {
            ...state.activeSession.workout,
            exercises: state.activeSession.workout.exercises.map((e) =>
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
        },
      }
    })
  },

  removeSet: (workoutExerciseId, setId) => {
    set((state) => {
      if (!state.activeSession) return state

      return {
        activeSession: {
          ...state.activeSession,
          workout: {
            ...state.activeSession.workout,
            exercises: state.activeSession.workout.exercises.map((e) =>
              e.id === workoutExerciseId
                ? {
                    ...e,
                    sets: e.sets.filter((s) => s.id !== setId),
                  }
                : e
            ),
          },
        },
      }
    })
  },

  toggleSetComplete: (workoutExerciseId, setId) => {
    set((state) => {
      if (!state.activeSession) return state

      return {
        activeSession: {
          ...state.activeSession,
          workout: {
            ...state.activeSession.workout,
            exercises: state.activeSession.workout.exercises.map((e) =>
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
        },
      }
    })
  },

  updateExerciseNotes: (workoutExerciseId, notes) => {
    set((state) => {
      if (!state.activeSession) return state

      return {
        activeSession: {
          ...state.activeSession,
          workout: {
            ...state.activeSession.workout,
            exercises: state.activeSession.workout.exercises.map((e) =>
              e.id === workoutExerciseId ? { ...e, notes } : e
            ),
          },
        },
      }
    })
  },

  bumpExerciseWeight: (workoutExerciseId, increment) => {
    set((state) => {
      if (!state.activeSession) return state

      return {
        activeSession: {
          ...state.activeSession,
          workout: {
            ...state.activeSession.workout,
            exercises: state.activeSession.workout.exercises.map((e) =>
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
        },
      }
    })
  },
})
