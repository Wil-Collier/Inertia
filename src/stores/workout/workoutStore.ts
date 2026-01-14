import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { WorkoutStore } from "./types"
import { createSessionSlice } from "./sessionSlice"
import { createTemplateSlice } from "./templateSlice"
import { createHistorySlice } from "./historySlice"
import { createProgressionSlice } from "./progressionSlice"
import { defaultTemplates } from "@/data/defaultTemplates"

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (...args) => ({
      // Initial state
      workouts: [],
      templates: defaultTemplates,
      activeSession: null,
      personalRecords: {},

      // Combine all slices
      ...createSessionSlice(...args),
      ...createTemplateSlice(...args),
      ...createHistorySlice(...args),
      ...createProgressionSlice(...args),
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

// Re-export types for consumers
export type { WorkoutStore } from "./types"
