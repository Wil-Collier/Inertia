import { create } from "zustand"
import type { Exercise, MuscleGroup } from "@/lib/types"
import { v4 as uuidv4 } from "uuid"
import { db } from "@/services/db"
import { loadDefaultExercises } from "@/data/exerciseLoader"
import { toast } from "sonner"

let initPromise: Promise<void> | null = null

interface ExerciseStore {
  isLoaded: boolean
  init: () => Promise<void>
  addExercise: (name: string, muscleGroup: MuscleGroup, isWeighted?: boolean, isTimeBased?: boolean) => Promise<Exercise>
  updateExercise: (id: string, updates: Partial<Omit<Exercise, "id">>) => Promise<void>
  deleteExercise: (id: string) => Promise<void>
  resetToDefaults: () => Promise<void>
}

export const useExerciseStore = create<ExerciseStore>((set, get) => ({
  isLoaded: false,

  init: async () => {
    if (get().isLoaded) return
    if (initPromise) return initPromise

    initPromise = (async () => {
      try {
        const currentCount = await db.exercises.count()
        if (currentCount === 0) {
          // Seed defaults
          const defaults = await loadDefaultExercises()
          await db.exercises.bulkAdd(defaults)
        }
        set({ isLoaded: true })
      } catch (error) {
        console.error("Failed to init exercise store:", error)
        // If it's a constraint error, it means another process beat us to it.
        if (error instanceof Error && error.name === 'BulkError') {
           set({ isLoaded: true })
           return
        }
        set({ isLoaded: true })
      } finally {
        initPromise = null
      }
    })()
    
    return initPromise
  },

  addExercise: async (name, muscleGroup, isWeighted = true, isTimeBased = false) => {
    const newExercise: Exercise = {
      id: uuidv4(),
      name,
      muscleGroup,
      isCustom: true,
      isWeighted,
      isTimeBased,
    }
    
    try {
      await db.exercises.add(newExercise)
      return newExercise
    } catch (error) {
      console.error("Failed to add exercise:", error)
      toast.error("Failed to save exercise")
      throw error
    }
  },

  updateExercise: async (id, updates) => {
    try {
      await db.exercises.update(id, updates)
    } catch (error) {
      console.error("Failed to update exercise:", error)
      toast.error("Failed to update exercise")
      throw error
    }
  },

  deleteExercise: async (id) => {
    try {
      await db.exercises.delete(id)
    } catch (error) {
      console.error("Failed to delete exercise:", error)
      toast.error("Failed to delete exercise")
      throw error
    }
  },

  resetToDefaults: async () => {
    try {
      await db.exercises.clear()
      const defaults = await loadDefaultExercises()
      await db.exercises.bulkAdd(defaults)
      toast.success("Exercises reset to defaults")
    } catch (error) {
      console.error("Failed to reset exercises:", error)
      toast.error("Failed to reset exercises")
    }
  },
}))
