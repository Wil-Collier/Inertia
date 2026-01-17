import { create } from "zustand"
import type { Exercise, MuscleGroup } from "@/lib/types"
import { v4 as uuidv4 } from "uuid"
import { db } from "@/services/db"
import { loadDefaultExercises } from "@/data/exerciseLoader"

import { toast } from "sonner"

interface ExerciseStore {
  exercises: Exercise[]
  isLoaded: boolean
  init: () => Promise<void>
  addExercise: (name: string, muscleGroup: MuscleGroup, isWeighted?: boolean, isTimeBased?: boolean) => Promise<Exercise>
  updateExercise: (id: string, updates: Partial<Omit<Exercise, "id">>) => Promise<void>
  deleteExercise: (id: string) => Promise<void>
  getExercise: (id: string) => Exercise | undefined
  getExercisesByMuscleGroup: (muscleGroup: MuscleGroup) => Exercise[]
  resetToDefaults: () => Promise<void>
}

export const useExerciseStore = create<ExerciseStore>((set, get) => ({
  exercises: [],
  isLoaded: false,

  init: async () => {
    if (get().isLoaded) return
    try {
      const stored = await db.exercises.toArray()
      if (stored.length > 0) {
        set({ exercises: stored, isLoaded: true })
      } else {
        // Seed defaults
        const defaults = await loadDefaultExercises()
        // Ensure defaults have ID? loadDefaultExercises maps ID.
        await db.exercises.bulkAdd(defaults)
        set({ exercises: defaults, isLoaded: true })
      }
    } catch (error) {
      console.error("Failed to init exercise store:", error)
      set({ isLoaded: true })
    }
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
      set((state) => ({
        exercises: [...state.exercises, newExercise],
      }))
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
      set((state) => ({
        exercises: state.exercises.map((ex) =>
          ex.id === id ? { ...ex, ...updates } : ex
        ),
      }))
    } catch (error) {
      console.error("Failed to update exercise:", error)
      toast.error("Failed to update exercise")
      throw error
    }
  },

  deleteExercise: async (id) => {
    try {
      await db.exercises.delete(id)
      set((state) => ({
        exercises: state.exercises.filter((ex) => ex.id !== id),
      }))
    } catch (error) {
      console.error("Failed to delete exercise:", error)
      toast.error("Failed to delete exercise")
      throw error
    }
  },

  getExercise: (id) => {
    return get().exercises.find((ex) => ex.id === id)
  },

  getExercisesByMuscleGroup: (muscleGroup) => {
    return get().exercises.filter((ex) => ex.muscleGroup === muscleGroup)
  },

  resetToDefaults: async () => {
    try {
      // 1. Clear all exercises from DB
      await db.exercises.clear()
      
      // 2. Load fresh defaults
      const defaults = await loadDefaultExercises()
      
      // 3. Add defaults to DB
      await db.exercises.bulkAdd(defaults)
      
      // 4. Update state
      set({ exercises: defaults })
      
      toast.success("Exercises reset to defaults")
    } catch (error) {
      console.error("Failed to reset exercises:", error)
      toast.error("Failed to reset exercises")
    }
  },
}))
