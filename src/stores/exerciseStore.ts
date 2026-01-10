import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Exercise, MuscleGroup } from "@/lib/types"
import { defaultExercises } from "@/data/defaultExercises"
import { v4 as uuidv4 } from "uuid"

interface ExerciseStore {
  exercises: Exercise[]
  addExercise: (name: string, muscleGroup: MuscleGroup, isWeighted?: boolean) => Exercise
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

      addExercise: (name, muscleGroup, isWeighted = true) => {
        const newExercise: Exercise = {
          id: uuidv4(),
          name,
          muscleGroup,
          isCustom: true,
          isWeighted,
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
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as ExerciseStore
        if (version < 2) {
          // Add isWeighted to existing exercises (default to true for weighted)
          // Match against defaultExercises to get correct isWeighted value
          const defaultExerciseMap = new Map(
            defaultExercises.map((e) => [e.id, e.isWeighted])
          )
          return {
            ...state,
            exercises: state.exercises.map((ex) => ({
              ...ex,
              isWeighted: defaultExerciseMap.get(ex.id) ?? true,
            })),
          }
        }
        return state
      },
    }
  )
)
