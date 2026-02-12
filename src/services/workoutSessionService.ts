import { db } from "./db"
import type { ActiveWorkoutSession } from "@/lib/types"
import { ACTIVE_SESSION_ID } from "@/lib/constants"
import { ACTIVE_SESSION_SYNC_WRITE_TABLES } from "@/services/dbTransactionTables"

export const workoutSessionService = {
  async saveActiveSession(session: ActiveWorkoutSession) {
    try {
      // Ensure callers can't accidentally override the primary key
      await db.transaction("rw", ACTIVE_SESSION_SYNC_WRITE_TABLES, async () => {
        await db.activeSession.put({ ...session, id: ACTIVE_SESSION_ID })
      })
    } catch (error) {
      console.error("Failed to save active session:", error)
      throw error
    }
  },

  async getActiveSession(): Promise<ActiveWorkoutSession | undefined> {
    try {
      const data = await db.activeSession.get(ACTIVE_SESSION_ID)
      if (!data) return undefined
      
      // Remove the 'id' field used for Dexie primary key
      const { id: _, ...session } = data
      return session
    } catch (error) {
      console.error("Failed to get active session:", error)
      return undefined
    }
  },

  async deleteActiveSession() {
    try {
      await db.transaction("rw", ACTIVE_SESSION_SYNC_WRITE_TABLES, async () => {
        await db.activeSession.delete(ACTIVE_SESSION_ID)
      })
    } catch (error) {
      console.error("Failed to delete active session:", error)
      throw error
    }
  }
}
