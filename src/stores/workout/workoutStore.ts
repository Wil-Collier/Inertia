import { create } from "zustand"
import type { WorkoutStore, PersonalRecord } from "./types"
import { createSessionSlice } from "./sessionSlice"
import { createTemplateSlice } from "./templateSlice"
import { createHistorySlice } from "./historySlice"
import { defaultTemplates } from "@/data/defaultTemplates"
import { db } from "@/services/db"

let initPromise: Promise<void> | null = null

export const useWorkoutStore = create<WorkoutStore>((set, get, api) => ({
  // Initial state
  workouts: [],
  templates: defaultTemplates,
  activeSession: null,
  personalRecords: {},
  isInitialized: false,

  init: async () => {
    if (get().isInitialized) return
    if (initPromise) return initPromise

    initPromise = (async () => {
      try {
        const [templates, sessions, prs, activeSessionData] = await Promise.all([
          db.workoutTemplates.toArray(),
          db.workoutSessions.orderBy("date").reverse().toArray(),
          db.personalRecords.toArray(),
          db.activeSession.get("current")
        ])

        const prRecord: Record<string, PersonalRecord> = {}
        prs.forEach((pr) => {
          prRecord[pr.exerciseId] = pr
        })

        set({
          workouts: sessions,
          templates: templates.length > 0 ? templates : defaultTemplates,
          personalRecords: prRecord,
          activeSession: activeSessionData ? { 
            workout: activeSessionData.workout, 
            startedAt: activeSessionData.startedAt,
            templateId: activeSessionData.templateId
          } : null,
          isInitialized: true,
        })

        // If no templates, save defaults
        if (templates.length === 0) {
          // Double check count before writing
          const count = await db.workoutTemplates.count()
          if (count === 0) {
            await db.workoutTemplates.bulkAdd(defaultTemplates)
          }
        }
      } catch (error) {
        console.error("Failed to init workout store:", error)
        
        // Recover from race condition on bulkAdd
        if (error instanceof Error && error.name === 'BulkError') {
             // Just ignore, as it means data exists
        }
        
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

