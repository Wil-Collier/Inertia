import type { WorkoutSliceCreator, HistorySlice } from "./types"
import { db } from "@/services/db"
import { calculateOneRepMax } from "@/lib/workoutUtils"
import { toast } from "sonner"

export const createHistorySlice: WorkoutSliceCreator<HistorySlice> = (_set, _get) => ({
  deleteWorkout: async (id) => {
    try {
      await db.workoutSessions.delete(id)
    } catch (error) {
      console.error("Failed to delete workout:", error)
      toast.error("Failed to delete workout history")
      throw error
    }
  },

  calculateOneRepMax,
})
