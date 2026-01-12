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
  ProgressionSuggestion,
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
  getProgressionSuggestion: (exerciseId: string, isTimeBased?: boolean) => ProgressionSuggestion | null
  applyProgressionSuggestion: (workoutExerciseId: string, suggestion: ProgressionSuggestion) => void

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
                      weight: useProgressedWeight && suggestion 
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
                weight: useProgressedWeight && suggestion 
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

      // Get smart progression suggestion for an exercise based on history analysis
      getProgressionSuggestion: (exerciseId, isTimeBased = false) => {
        const history = get().getExerciseHistory(exerciseId)
        
        // Need at least 1 session to make a suggestion
        if (history.length === 0) {
          return null
        }

        // Get the most recent sessions (up to 5) for analysis
        const recentHistory = history.slice(-5)
        const lastSession = recentHistory[recentHistory.length - 1]

        // For time-based exercises, analyze duration progression
        if (isTimeBased) {
          // Duration is stored in reps field for time-based exercises
          const lastDuration = lastSession.sets.length > 0 
            ? Math.max(...lastSession.sets.map(s => s.reps))
            : 0

          if (lastDuration === 0) {
            return null
          }

          // Detect duration increment pattern from history
          let durationIncrement = 5 // default 5 seconds
          if (recentHistory.length >= 2) {
            const durationChanges: number[] = []
            for (let i = 1; i < recentHistory.length; i++) {
              const prevMax = Math.max(...recentHistory[i - 1].sets.map(s => s.reps))
              const currMax = Math.max(...recentHistory[i].sets.map(s => s.reps))
              if (currMax > prevMax) {
                durationChanges.push(currMax - prevMax)
              }
            }
            if (durationChanges.length > 0) {
              durationIncrement = Math.min(...durationChanges)
            }
          }

          // For time-based, we generally suggest progression if they completed the last session
          const lastAllCompleted = lastSession.sets.length > 0
          
          if (lastAllCompleted) {
            return {
              type: "increase",
              suggestedWeight: 0,
              suggestedReps: 0,
              suggestedDuration: lastDuration + durationIncrement,
              reason: `You completed ${lastDuration}s last time`,
              confidence: "medium" as const,
              increment: durationIncrement,
              isTimeBased: true,
            }
          }

          return {
            type: "maintain",
            suggestedWeight: 0,
            suggestedReps: 0,
            suggestedDuration: lastDuration,
            reason: "Keep building duration",
            confidence: "medium" as const,
            increment: durationIncrement,
            isTimeBased: true,
          }
        }

        // For weighted exercises - analyze weight and rep patterns
        const allSets = recentHistory.flatMap(s => s.sets)
        
        // Infer target reps from recent history (use median of recent reps)
        const recentReps = allSets.map(s => s.reps).sort((a, b) => a - b)
        const medianReps = recentReps[Math.floor(recentReps.length / 2)] || 8
        const targetReps = Math.ceil(medianReps)

        // Detect weight increment pattern (smallest positive weight jump in history)
        let weightIncrement = 5 // default 5 lbs
        if (recentHistory.length >= 2) {
          const weightChanges: number[] = []
          for (let i = 1; i < recentHistory.length; i++) {
            const change = recentHistory[i].maxWeight - recentHistory[i - 1].maxWeight
            if (change > 0) {
              weightChanges.push(change)
            }
          }
          if (weightChanges.length > 0) {
            // Use the smallest increment they've used (usually 2.5, 5, or 10)
            const minChange = Math.min(...weightChanges)
            // Round to nearest 2.5 for sanity
            weightIncrement = Math.round(minChange / 2.5) * 2.5 || 5
          }
        }

        // Analyze last session for mixed weights (user dropped weight mid-workout)
        const lastSessionSets = lastSession.sets
        const uniqueWeights = [...new Set(lastSessionSets.map(s => s.weight))].sort((a, b) => b - a)
        const hasMultipleWeights = uniqueWeights.length > 1
        const maxWeightInSession = uniqueWeights[0] || 0
        
        // Find the "working weight" - the weight at which user successfully hit target reps
        // This handles the case where user tried heavier weight, failed, dropped back
        let workingWeight = maxWeightInSession
        if (hasMultipleWeights) {
          // Check if sets at the max weight hit target reps
          const setsAtMaxWeight = lastSessionSets.filter(s => s.weight === maxWeightInSession)
          const maxWeightHitTarget = setsAtMaxWeight.every(s => s.reps >= targetReps)
          
          if (!maxWeightHitTarget) {
            // User failed at the higher weight - find the weight where they succeeded
            for (const weight of uniqueWeights) {
              const setsAtWeight = lastSessionSets.filter(s => s.weight === weight)
              const hitTargetAtWeight = setsAtWeight.every(s => s.reps >= targetReps)
              if (hitTargetAtWeight && setsAtWeight.length > 0) {
                workingWeight = weight
                break
              }
            }
          }
        }

        // Check if weight was lowered compared to previous session's working weight
        let weightWasLowered = false
        let previousWorkingWeight = workingWeight
        if (recentHistory.length >= 2) {
          const prevSession = recentHistory[recentHistory.length - 2]
          previousWorkingWeight = prevSession.maxWeight
          weightWasLowered = workingWeight < previousWorkingWeight
        }

        // Check if all sets at the working weight hit target reps
        const setsAtWorkingWeight = lastSessionSets.filter(s => s.weight === workingWeight)
        const hitAllTargetRepsAtWorkingWeight = setsAtWorkingWeight.length > 0 && 
          setsAtWorkingWeight.every(s => s.reps >= targetReps)
        
        // Check if user attempted a higher weight and had to drop back (failed progression)
        const failedProgressionAttempt = hasMultipleWeights && workingWeight < maxWeightInSession
        
        const avgReps = lastSessionSets.reduce((sum, s) => sum + s.reps, 0) / lastSessionSets.length
        
        // Determine recommendation
        if (failedProgressionAttempt) {
          // User tried to progress but couldn't complete all sets at higher weight
          // Recommend staying at the successful working weight
          return {
            type: "maintain",
            suggestedWeight: workingWeight,
            suggestedReps: targetReps,
            reason: `Build strength at ${workingWeight} lbs first`,
            confidence: "high" as const,
            increment: weightIncrement,
            isTimeBased: false,
          }
        } else if (weightWasLowered) {
          // User lowered weight from previous session - recommend building back up
          if (hitAllTargetRepsAtWorkingWeight) {
            // They hit their reps at the lower weight - suggest getting back to previous weight
            return {
              type: "maintain",
              suggestedWeight: previousWorkingWeight,
              suggestedReps: targetReps,
              reason: `Build back to ${previousWorkingWeight} lbs`,
              confidence: "high" as const,
              increment: weightIncrement,
              isTimeBased: false,
            }
          } else {
            // Still working at lower weight
            return {
              type: "maintain",
              suggestedWeight: workingWeight,
              suggestedReps: targetReps,
              reason: "Rebuild strength at current weight",
              confidence: "medium" as const,
              increment: weightIncrement,
              isTimeBased: false,
            }
          }
        } else if (hitAllTargetRepsAtWorkingWeight) {
          // Weight maintained or increased AND all sets hit target reps - ready to progress
          return {
            type: "increase",
            suggestedWeight: workingWeight + weightIncrement,
            suggestedReps: targetReps,
            reason: `You hit ${targetReps}+ reps on all sets`,
            confidence: setsAtWorkingWeight.length >= 3 ? "high" as const : "medium" as const,
            increment: weightIncrement,
            isTimeBased: false,
          }
        } else if (avgReps >= targetReps * 0.8) {
          // Close to target - maintain weight
          return {
            type: "maintain",
            suggestedWeight: workingWeight,
            suggestedReps: targetReps,
            reason: `Build to ${targetReps} reps on all sets`,
            confidence: "medium" as const,
            increment: weightIncrement,
            isTimeBased: false,
          }
        } else {
          // Far from target - maintain
          return {
            type: "maintain",
            suggestedWeight: workingWeight,
            suggestedReps: targetReps,
            reason: "Focus on hitting rep targets",
            confidence: "low" as const,
            increment: weightIncrement,
            isTimeBased: false,
          }
        }
      },

      // Apply a progression suggestion to uncompleted sets
      applyProgressionSuggestion: (workoutExerciseId, suggestion) => {
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
                            : suggestion.isTimeBased
                              ? { ...s, reps: suggestion.suggestedDuration ?? s.reps }
                              : { ...s, weight: suggestion.suggestedWeight }
                        ),
                      }
                    : e
                ),
              },
            },
          }
        })
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
