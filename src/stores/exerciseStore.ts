import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Exercise, MuscleGroup } from "@/lib/types"
import { v4 as uuidv4 } from "uuid"

interface ExerciseStore {
  exercises: Exercise[]
  isLoaded: boolean
  addExercise: (name: string, muscleGroup: MuscleGroup, isWeighted?: boolean, isTimeBased?: boolean) => Exercise
  updateExercise: (id: string, updates: Partial<Omit<Exercise, "id">>) => void
  deleteExercise: (id: string) => void
  getExercise: (id: string) => Exercise | undefined
  getExercisesByMuscleGroup: (muscleGroup: MuscleGroup) => Exercise[]
  setDefaultExercises: (exercises: Exercise[]) => void
  resetToDefaults: () => void
}

export const useExerciseStore = create<ExerciseStore>()(
  persist(
    (set, get) => ({
      exercises: [],
      isLoaded: false,

      addExercise: (name, muscleGroup, isWeighted = true, isTimeBased = false) => {
        const newExercise: Exercise = {
          id: uuidv4(),
          name,
          muscleGroup,
          isCustom: true,
          isWeighted,
          isTimeBased,
        }
        set((state) => ({
          exercises: [...state.exercises, newExercise],
        }))
        return newExercise
      },

      updateExercise: (id, updates) => {
        set((state) => ({
          exercises: state.exercises.map((ex) =>
            ex.id === id ? { ...ex, ...updates } : ex
          ),
        }))
      },

      deleteExercise: (id) => {
        set((state) => ({
          exercises: state.exercises.filter((ex) => ex.id !== id),
        }))
      },

      getExercise: (id) => {
        return get().exercises.find((ex) => ex.id === id)
      },

      getExercisesByMuscleGroup: (muscleGroup) => {
        return get().exercises.filter((ex) => ex.muscleGroup === muscleGroup)
      },

      setDefaultExercises: (defaultExercises) => {
        set((state) => {
          // Keep custom exercises, add defaults that don't exist
          const customExercises = state.exercises.filter((ex) => ex.isCustom)
          const existingIds = new Set(state.exercises.map((ex) => ex.id))
          const newDefaults = defaultExercises.filter((ex) => !existingIds.has(ex.id))
          
          return {
            exercises: [...defaultExercises.filter(ex => !ex.isCustom), ...customExercises, ...newDefaults.filter(ex => ex.isCustom)],
            isLoaded: true,
          }
        })
      },

      resetToDefaults: () => {
        // This will be called after loading defaults
        set((state) => ({
          exercises: state.exercises.filter((ex) => !ex.isCustom),
          isLoaded: false,
        }))
      },
    }),
    {
      name: "training-app-exercises",
      version: 5,
      partialize: (state) => ({
        exercises: state.exercises.filter((ex) => ex.isCustom),
      }),
      migrate: (persistedState, version) => {
        const state = persistedState as ExerciseStore
        if (version < 5) {
          // Version 5: Lazy loading - keep only custom exercises in localStorage
          // Default exercises will be loaded dynamically
          const customExercises = state.exercises?.filter((ex) => ex.isCustom) || []
          return {
            ...state,
            exercises: customExercises,
            isLoaded: false,
          }
        }
        return state
      },
    }
  )
)
