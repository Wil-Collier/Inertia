import { db } from "./db"
import type { ActiveWorkoutSession } from "@/lib/types"

export const workoutSessionService = {
  async saveActiveSession(session: ActiveWorkoutSession) {
    try {
      await db.activeSession.put({ id: "current", ...session })
    } catch (error) {
      console.error("Failed to save active session:", error)
      throw error
    }
  },

  async getActiveSession(): Promise<ActiveWorkoutSession | undefined> {
    try {
      const data = await db.activeSession.get("current")
      if (!data) return undefined
      
      // Remove the 'id' field used for Dexie primary key
      const { id: _, ...session } = data as any
      return session as ActiveWorkoutSession
    } catch (error) {
      console.error("Failed to get active session:", error)
      return undefined
    }
  },

  async deleteActiveSession() {
    try {
      await db.activeSession.delete("current")
    } catch (error) {
      console.error("Failed to delete active session:", error)
      throw error
    }
  }
}
