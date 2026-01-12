import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  Workout,
  WorkoutTemplate,
  WorkoutExercise,
  WorkoutSet,
  ActiveWorkoutSession,
  PersonalRecord,
  LastPerformance,
} from "@/lib/types"
import { defaultTemplates } from "@/data/defaultTemplates"
import { v4 as uuidv4 } from "uuid"
import { format } from "date-fns"

interface WorkoutStore {
  // Workouts
  workouts: Workout[]
  templates: WorkoutTemplate[]
  activeSession: ActiveWorkoutSession | null
  personalRecords: Record<string, PersonalRecord> // keyed by exerciseId

  // Workout Actions
  startWorkout: (name: string, templateId?: string) => void
  cancelWorkout: () => void
  finishWorkout: () => Workout | null
  addExerciseToWorkout: (exerciseId: string) => void
  removeExerciseFromWorkout: (workoutExerciseId: string) => void
  addSet: (workoutExerciseId: string) => void
  updateSet: (
    workoutExerciseId: string,
    setId: string,
    updates: Partial<Omit<WorkoutSet, "id">>
  ) => void
  removeSet: (workoutExerciseId: string, setId: string) => void
  toggleSetComplete: (workoutExerciseId: string, setId: string) => void
  updateExerciseNotes: (workoutExerciseId: string, notes: string) => void
  bumpExerciseWeight: (workoutExerciseId: string, increment: number) => void

  // Template Actions
  createTemplate: (name: string, workout?: Workout) => WorkoutTemplate
  updateTemplate: (
    id: string,
    updates: Partial<Omit<WorkoutTemplate, "id">>
  ) => void
  deleteTemplate: (id: string) => void

  // Workout History
  getWorkoutsByDate: (date: string) => Workout[]
  getWorkoutDates: () => string[]
  deleteWorkout: (id: string) => void

  // Personal Records
  getPersonalRecord: (exerciseId: string) => PersonalRecord | undefined
  calculateOneRepMax: (weight: number, reps: number) => number

  // Progressive Overload
  getLastPerformance: (exerciseId: string) => LastPerformance | null

  // Exercise History (for progress charts)
  getExerciseHistory: (exerciseId: string) => Array<{
    date: string
    workoutId: string
    maxWeight: number
    totalVolume: number
    totalReps: number
    sets: Array<{ weight: number; reps: number }>
  }>
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      workouts: [],
      templates: defaultTemplates,
      activeSession: null,
      personalRecords: {},

      startWorkout: (name, templateId) => {
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
                  sets: Array.from({ length: targetSetCount }, (_, i) => ({
                    id: uuidv4(),
                    // Use corresponding set from history, or last set if fewer sets in history
                    reps: lastSets[Math.min(i, lastSets.length - 1)]?.reps ?? te.targetReps ?? 0,
                    weight: lastSets[Math.min(i, lastSets.length - 1)]?.weight ?? te.targetWeight ?? 0,
                    completed: false,
                  })),
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

      createTemplate: (name, workout) => {
        const template: WorkoutTemplate = {
          id: uuidv4(),
          name,
          exercises: workout
            ? workout.exercises.map((e) => ({
                exerciseId: e.exerciseId,
                targetSets: e.sets.length,
                targetReps: e.sets[0]?.reps,
                targetWeight: e.sets[0]?.weight,
              }))
            : [],
        }

        set((state) => ({
          templates: [...state.templates, template],
        }))

        return template
      },

      updateTemplate: (id, updates) => {
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        }))
      },

      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }))
      },

      getWorkoutsByDate: (date) => {
        return get().workouts.filter((w) => w.date === date)
      },

      getWorkoutDates: () => {
        const dates = new Set(get().workouts.map((w) => w.date))
        return Array.from(dates).sort().reverse()
      },

      deleteWorkout: (id) => {
        set((state) => ({
          workouts: state.workouts.filter((w) => w.id !== id),
        }))
      },

      getPersonalRecord: (exerciseId) => {
        return get().personalRecords[exerciseId]
      },

      // Brzycki formula for estimated 1RM
      calculateOneRepMax: (weight, reps) => {
        if (reps === 1) return weight
        if (reps > 12) return weight * (1 + reps / 30) // simplified for high reps
        return weight * (36 / (37 - reps))
      },

      // Get the last performance for an exercise (for progressive overload)
      getLastPerformance: (exerciseId) => {
        const workouts = get().workouts
        // Sort by date descending (newest first)
        const sortedWorkouts = [...workouts].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )

        for (const workout of sortedWorkouts) {
          const workoutExercise = workout.exercises.find(
            (e) => e.exerciseId === exerciseId
          )
          if (workoutExercise) {
            // Get completed sets with meaningful data
            const completedSets = workoutExercise.sets
              .filter((s) => s.completed)
              .map((s) => ({ weight: s.weight, reps: s.reps }))

            // If no completed sets, use all sets that have data
            const setsWithData =
              completedSets.length > 0
                ? completedSets
                : workoutExercise.sets
                    .filter((s) => s.weight > 0 || s.reps > 0)
                    .map((s) => ({ weight: s.weight, reps: s.reps }))

            if (setsWithData.length > 0) {
              return {
                sets: setsWithData,
                date: workout.date,
                workoutId: workout.id,
              }
            }
          }
        }
        return null
      },

      // Get full exercise history for progress charts
      getExerciseHistory: (exerciseId) => {
        const workouts = get().workouts
        const history: Array<{
          date: string
          workoutId: string
          maxWeight: number
          totalVolume: number
          totalReps: number
          sets: Array<{ weight: number; reps: number }>
        }> = []

        // Sort by date ascending (oldest first) for chronological chart
        const sortedWorkouts = [...workouts].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )

        for (const workout of sortedWorkouts) {
          const workoutExercise = workout.exercises.find(
            (e) => e.exerciseId === exerciseId
          )
          if (workoutExercise) {
            const completedSets = workoutExercise.sets
              .filter((s) => s.completed && (s.weight > 0 || s.reps > 0))
              .map((s) => ({ weight: s.weight, reps: s.reps }))

            if (completedSets.length > 0) {
              const maxWeight = Math.max(...completedSets.map((s) => s.weight))
              const totalVolume = completedSets.reduce(
                (sum, s) => sum + s.weight * s.reps,
                0
              )
              const totalReps = completedSets.reduce(
                (sum, s) => sum + s.reps,
                0
              )

              history.push({
                date: workout.date,
                workoutId: workout.id,
                maxWeight,
                totalVolume,
                totalReps,
                sets: completedSets,
              })
            }
          }
        }

        return history
      },
    }),
    {
      name: "training-app-workouts",
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as WorkoutStore
        if (version < 2) {
          // Add default templates if they don't exist
          const existingTemplateIds = new Set(state.templates.map((t) => t.id))
          const newTemplates = defaultTemplates.filter(
            (t) => !existingTemplateIds.has(t.id)
          )
          return {
            ...state,
            templates: [...state.templates, ...newTemplates],
          }
        }
        return state
      },
    }
  )
)
