import { create } from "zustand"
import type { WeightEntry } from "@/lib/types"
import { v4 as uuidv4 } from "uuid"
import { db } from "@/services/db"
import { toast } from "sonner"
import { getToday } from "@/lib/dateUtils"

interface BodyWeightStore {
  isInitialized: boolean
  init: () => Promise<void>

  // Entry Actions
  addEntry: (weight: number, date?: string, note?: string) => Promise<WeightEntry>
  updateEntry: (id: string, updates: Partial<Omit<WeightEntry, "id">>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
}

export const useBodyWeightStore = create<BodyWeightStore>((set, get) => ({
  isInitialized: false,

  init: async () => {
    if (get().isInitialized) return
    set({ isInitialized: true })
  },

  addEntry: async (weight, date, note) => {
    const entryDate = date || getToday()
    
    // Check if entry for this date already exists
    const existingEntry = await db.bodyWeight.where("date").equals(entryDate).first()
    
    if (existingEntry) {
      await get().updateEntry(existingEntry.id, { weight, note })
      return { ...existingEntry, weight, note }
    }

    const newEntry: WeightEntry = {
      id: uuidv4(),
      date: entryDate,
      weight,
      note,
    }

    try {
      await db.bodyWeight.add(newEntry)
      return newEntry
    } catch (error) {
      console.error("Failed to add weight entry:", error)
      toast.error("Failed to save weight entry")
      throw error
    }
  },

  updateEntry: async (id, updates) => {
    try {
      await db.bodyWeight.update(id, updates)
    } catch (error) {
      console.error("Failed to update weight entry:", error)
      toast.error("Failed to update weight entry")
      throw error
    }
  },

  deleteEntry: async (id) => {
    try {
      await db.bodyWeight.delete(id)
    } catch (error) {
      console.error("Failed to delete weight entry:", error)
      toast.error("Failed to delete weight entry")
      throw error
    }
  },
}))

// Helper to get today's date formatted
export const getTodayDate = getToday

