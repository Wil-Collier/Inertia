import { create } from "zustand"
import { toast } from "sonner"
import { db } from "@/services/db"
import type { TemplateExercise, Workout, WorkoutExercise, WorkoutSet } from "@/lib/types"
import { achievementService } from "@/services/achievementService"

interface ActiveSession {
  workout: Workout
  startedAt: string
  templateId?: string
}

interface ActiveSessionStore {
  session: ActiveSession | null
  isInitialized: boolean
  
  // Lifecycle
  init: () => Promise<void>
  startWorkout: (name: string, templateId?: string, exercises?: WorkoutExercise[]) => Promise<void>
  finishWorkout: () => Promise<Workout | null>
  cancelWorkout: () => Promise<void>
  
  // Workout properties
  updateWorkoutName: (name: string) => Promise<void>
  
  // Exercise operations
  addExercise: (exerciseId: string) => Promise<void>
  removeExercise: (workoutExerciseId: string) => Promise<void>
  reorderExercises: (exerciseIds: string[]) => Promise<void>
  updateExerciseNotes: (workoutExerciseId: string, notes: string) => Promise<void>
  
  // Set operations
  addSet: (workoutExerciseId: string) => Promise<void>
  updateSet: (workoutExerciseId: string, setId: string, updates: Partial<WorkoutSet>) => Promise<void>
  removeSet: (workoutExerciseId: string, setId: string) => Promise<void>
  toggleSetComplete: (workoutExerciseId: string, setId: string) => Promise<void>
  
  // Persistence helper
  _persist: () => Promise<void>
}

function buildWorkoutExerciseFromTemplate(templateExercise: TemplateExercise): WorkoutExercise {
  const setCount = Math.max(1, templateExercise.targetSets || 0)
  const reps = templateExercise.targetReps ?? 0
  const weight = templateExercise.targetWeight ?? 0

  return {
    id: crypto.randomUUID(),
    exerciseId: templateExercise.exerciseId,
    sets: Array.from({ length: setCount }, () => ({
      id: crypto.randomUUID(),
      reps,
      weight,
      isCompleted: false,
    })),
  }
}

export const useActiveSessionStore = create<ActiveSessionStore>((set, get) => ({
  session: null,
  isInitialized: false,
  
  init: async () => {
    if (get().isInitialized) return

    try {
      const saved = await db.activeSession.get("current")
      set({
        session: saved
          ? {
              workout: saved.workout,
              startedAt: saved.startedAt,
              templateId: saved.templateId ?? undefined,
            }
          : null,
        isInitialized: true,
      })
    } catch (error) {
      console.error("Failed to restore active session:", error)
      set({ isInitialized: true })
    }
  },
  
  startWorkout: async (name, templateId, exercises = []) => {
    try {
      let resolvedExercises = exercises

      if (templateId && resolvedExercises.length === 0) {
        const template = await db.workoutTemplates.get(templateId)

        if (!template) {
          toast.error("Template not found")
        } else {
          resolvedExercises = template.exercises.map((templateExercise) =>
            buildWorkoutExerciseFromTemplate(templateExercise)
          )
        }
      }

      const workout: Workout = {
        id: crypto.randomUUID(),
        name,
        date: new Date().toISOString().split("T")[0],
        exercises: resolvedExercises,
      }

      const session: ActiveSession = {
        workout,
        startedAt: new Date().toISOString(),
        templateId,
      }

      // Set synchronously so routing guards can see it immediately.
      set({ session })
      await db.activeSession.put({ id: "current", ...session })
    } catch (error) {
      console.error("Failed to start workout:", error)
      toast.error("Failed to start workout")
      throw error
    }
  },
  
  finishWorkout: async () => {
    const { session } = get()
    if (!session) return null
    
    const completedWorkout: Workout = {
      ...session.workout,
      completedAt: new Date().toISOString(),
      exerciseIds: session.workout.exercises.map((e) => e.exerciseId),
    }
    
    try {
      await db.workoutSessions.add(completedWorkout)
      await db.activeSession.delete("current")
      
      // Update streaks and check achievements
      await achievementService.updateWorkoutStreak(completedWorkout.date)
      await achievementService.checkWorkoutAchievements()

      set({ session: null })
      return completedWorkout
    } catch (error) {
      console.error("Failed to finish workout:", error)
      toast.error("Failed to save workout history. Please try again.")
      throw error
    }
  },
  
  cancelWorkout: async () => {
    await db.activeSession.delete("current")
    set({ session: null })
  },
  
  updateWorkoutName: async (name) => {
    const { session } = get()
    if (!session) return
    
    set({
      session: {
        ...session,
        workout: { ...session.workout, name }
      }
    })
    await get()._persist()
  },
  
  _persist: async () => {
    const { session } = get()
    if (session) {
      await db.activeSession.put({ id: "current", ...session })
    }
  },
  
  addExercise: async (exerciseId) => {
    const { session } = get()
    if (!session) return
    
    const newExercise: WorkoutExercise = {
      id: crypto.randomUUID(),
      exerciseId,
      sets: [{ id: crypto.randomUUID(), reps: 0, weight: 0, isCompleted: false }],
    }
    
    set({
      session: {
        ...session,
        workout: {
          ...session.workout,
          exercises: [...session.workout.exercises, newExercise],
        },
      },
    })
    await get()._persist()
  },
  
  removeExercise: async (workoutExerciseId) => {
    const { session } = get()
    if (!session) return
    
    set({
      session: {
        ...session,
        workout: {
          ...session.workout,
          exercises: session.workout.exercises.filter(e => e.id !== workoutExerciseId)
        }
      }
    })
    await get()._persist()
  },

  reorderExercises: async (exerciseIds) => {
    const { session } = get()
    if (!session) return

    const exercisesById = new Map(session.workout.exercises.map(e => [e.id, e]))
    const reordered = exerciseIds.map(id => exercisesById.get(id)!).filter(Boolean)

    set({
      session: {
        ...session,
        workout: {
          ...session.workout,
          exercises: reordered
        }
      }
    })
    await get()._persist()
  },

  updateExerciseNotes: async (workoutExerciseId, notes) => {
    const { session } = get()
    if (!session) return

    set({
      session: {
        ...session,
        workout: {
          ...session.workout,
          exercises: session.workout.exercises.map(e => 
            e.id === workoutExerciseId ? { ...e, notes: notes || undefined } : e
          )
        }
      }
    })
    await get()._persist()
  },
  
  addSet: async (workoutExerciseId) => {
    const { session } = get()
    if (!session) return
    
    const lastSet = session.workout.exercises.find(e => e.id === workoutExerciseId)?.sets.slice(-1)[0]
    
    const newSet: WorkoutSet = {
      id: crypto.randomUUID(),
      reps: lastSet?.reps ?? 0,
      weight: lastSet?.weight ?? 0,
      isCompleted: false
    }
    
    set({
      session: {
        ...session,
        workout: {
          ...session.workout,
          exercises: session.workout.exercises.map(e => 
            e.id === workoutExerciseId 
              ? { ...e, sets: [...e.sets, newSet] }
              : e
          )
        }
      }
    })
    await get()._persist()
  },
  
  updateSet: async (workoutExerciseId, setId, updates) => {
    const { session } = get()
    if (!session) return
    
    set({
      session: {
        ...session,
        workout: {
          ...session.workout,
          exercises: session.workout.exercises.map(e => 
            e.id === workoutExerciseId 
              ? { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, ...updates } : s) }
              : e
          )
        }
      }
    })
    await get()._persist()
  },
  
  removeSet: async (workoutExerciseId, setId) => {
    const { session } = get()
    if (!session) return
    
    set({
      session: {
        ...session,
        workout: {
          ...session.workout,
          exercises: session.workout.exercises.map(e => 
            e.id === workoutExerciseId 
              ? { ...e, sets: e.sets.filter(s => s.id !== setId) }
              : e
          )
        }
      }
    })
    await get()._persist()
  },
  
  toggleSetComplete: async (workoutExerciseId, setId) => {
    const { session } = get()
    if (!session) return
    
    set({
      session: {
        ...session,
        workout: {
          ...session.workout,
          exercises: session.workout.exercises.map(e => 
            e.id === workoutExerciseId 
              ? { ...e, sets: e.sets.map(s => s.id === setId ? { ...s, isCompleted: !s.isCompleted } : s) }
              : e
          )
        }
      }
    })
    await get()._persist()
  }
}))
