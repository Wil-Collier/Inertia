import { v4 as uuidv4 } from "uuid"
import type { WorkoutSliceCreator, TemplateSlice, WorkoutTemplate } from "./types"

export const createTemplateSlice: WorkoutSliceCreator<TemplateSlice> = (set) => ({
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
})
