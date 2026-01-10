import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  Workout,
  WorkoutTemplate,
  WorkoutExercise,
  WorkoutSet,
  ActiveWorkoutSession,
  PersonalRecord,
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
          ? template.exercises.map((te) => ({
              id: uuidv4(),
              exerciseId: te.exerciseId,
              sets: Array.from({ length: te.targetSets }, () => ({
                id: uuidv4(),
                reps: te.targetReps ?? 0,
                weight: te.targetWeight ?? 0,
                completed: false,
              })),
            }))
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
        set((state) => {
          if (!state.activeSession) return state

          const newExercise: WorkoutExercise = {
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
