import { v4 as uuidv4 } from "uuid"
import type { WorkoutSliceCreator, TemplateSlice, WorkoutTemplate } from "./types"
import { db } from "@/services/db"
import { toast } from "sonner"

export const createTemplateSlice: WorkoutSliceCreator<TemplateSlice> = (set) => ({
  createTemplate: async (name, workout) => {
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

    try {
      await db.workoutTemplates.add(template)
      set((state) => ({
        templates: [...state.templates, template],
      }))
      return template
    } catch (error) {
      console.error("Failed to create template:", error)
      toast.error("Failed to save template")
      throw error
    }
  },

  updateTemplate: async (id, updates) => {
    try {
      await db.workoutTemplates.update(id, updates)
      set((state) => ({
        templates: state.templates.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
      }))
    } catch (error) {
      console.error("Failed to update template:", error)
      toast.error("Failed to update template")
      throw error
    }
  },

  deleteTemplate: async (id) => {
    try {
      await db.workoutTemplates.delete(id)
      set((state) => ({
        templates: state.templates.filter((t) => t.id !== id),
      }))
    } catch (error) {
      console.error("Failed to delete template:", error)
      toast.error("Failed to delete template")
      throw error
    }
  },
})
