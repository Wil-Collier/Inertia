import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Exercise, MuscleGroup } from "@/lib/types"
import { defaultExercises } from "@/data/defaultExercises"
import { v4 as uuidv4 } from "uuid"

interface ExerciseStore {
  exercises: Exercise[]
  addExercise: (name: string, muscleGroup: MuscleGroup, isWeighted?: boolean, isTimeBased?: boolean) => Exercise
  updateExercise: (id: string, updates: Partial<Omit<Exercise, "id">>) => void
  deleteExercise: (id: string) => void
  getExercise: (id: string) => Exercise | undefined
  getExercisesByMuscleGroup: (muscleGroup: MuscleGroup) => Exercise[]
  resetToDefaults: () => void
}

export const useExerciseStore = create<ExerciseStore>()(
  persist(
    (set, get) => ({
      exercises: defaultExercises,

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

      resetToDefaults: () => {
        set({ exercises: defaultExercises })
      },
    }),
    {
      name: "training-app-exercises",
      version: 4,
      migrate: (persistedState, version) => {
        const state = persistedState as ExerciseStore
        if (version < 4) {
          // Version 4: Complete exercise library overhaul
          // Replace old default exercises with new 873-exercise database
          // Keep only user's custom exercises
          const customExercises = state.exercises.filter((ex) => ex.isCustom)
          return {
            ...state,
            exercises: [...defaultExercises, ...customExercises],
          }
        }
        return state
      },
    }
  )
)
