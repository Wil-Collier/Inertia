import { create } from "zustand"
import type { WorkoutStore } from "./types"
import { createSessionSlice } from "./sessionSlice"
import { createTemplateSlice } from "./templateSlice"
import { createHistorySlice } from "./historySlice"
import { defaultTemplates } from "@/data/defaultTemplates"
import { db } from "@/services/db"

let initPromise: Promise<void> | null = null

export const useWorkoutStore = create<WorkoutStore>((set, get, api) => ({
  // Initial state
  activeSession: null,
  isInitialized: false,

  init: async () => {
    if (get().isInitialized) return
    if (initPromise) return initPromise

    initPromise = (async () => {
      try {
        const activeSessionData = await db.activeSession.get("current")

        set({
          activeSession: activeSessionData ? { 
            workout: activeSessionData.workout, 
            startedAt: activeSessionData.startedAt,
            templateId: activeSessionData.templateId
          } : null,
          isInitialized: true,
        })

        // Ensure default templates exist in DB
        const count = await db.workoutTemplates.count()
        if (count === 0) {
          await db.workoutTemplates.bulkAdd(defaultTemplates)
        }
      } catch (error) {
        console.error("Failed to init workout store:", error)
        set({ isInitialized: true })
      } finally {
        initPromise = null
      }
    })()

    return initPromise
  },


  // Combine all slices
  ...createSessionSlice(set, get, api),
  ...createTemplateSlice(set, get, api),
  ...createHistorySlice(set, get, api),
}))

// Re-export types for consumers
export type { WorkoutStore } from "./types"

