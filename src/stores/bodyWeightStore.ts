import { create } from "zustand"
import type { WeightEntry } from "@/lib/types"
import { v4 as uuidv4 } from "uuid"
import { format } from "date-fns"
import { db } from "@/services/db"

import { toast } from "sonner"

interface BodyWeightStore {
  entries: WeightEntry[]
  isInitialized: boolean
  init: () => Promise<void>

  // Entry Actions
  addEntry: (weight: number, date?: string, note?: string) => Promise<WeightEntry>
  updateEntry: (id: string, updates: Partial<Omit<WeightEntry, "id">>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>

  // Query Actions
  getLatestEntry: () => WeightEntry | undefined
  getEntryForDate: (date: string) => WeightEntry | undefined
  getEntriesForRange: (startDate: string, endDate: string) => WeightEntry[]
  getAllEntriesSorted: () => WeightEntry[]
}

export const useBodyWeightStore = create<BodyWeightStore>((set, get) => ({
  entries: [],
  isInitialized: false,

  init: async () => {
    if (get().isInitialized) return
    try {
      const entries = await db.bodyWeight.toArray()
      set({ entries, isInitialized: true })
    } catch (error) {
      console.error("Failed to init body weight store:", error)
      set({ isInitialized: true })
    }
  },

  addEntry: async (weight, date, note) => {
    const entryDate = date || format(new Date(), "yyyy-MM-dd")
    
    // Check if entry for this date already exists
    const existingEntry = get().entries.find((e) => e.date === entryDate)
    
    if (existingEntry) {
      // updateEntry already handles toast/error
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
      set((state) => ({
        entries: [...state.entries, newEntry],
      }))
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
      set((state) => ({
        entries: state.entries.map((e) =>
          e.id === id ? { ...e, ...updates } : e
        ),
      }))
    } catch (error) {
      console.error("Failed to update weight entry:", error)
      toast.error("Failed to update weight entry")
      throw error
    }
  },

  deleteEntry: async (id) => {
    try {
      await db.bodyWeight.delete(id)
      set((state) => ({
        entries: state.entries.filter((e) => e.id !== id),
      }))
    } catch (error) {
      console.error("Failed to delete weight entry:", error)
      toast.error("Failed to delete weight entry")
      throw error
    }
  },

  getLatestEntry: () => {
    const sorted = get().getAllEntriesSorted()
    return sorted[0]
  },

  getEntryForDate: (date) => {
    return get().entries.find((e) => e.date === date)
  },

  getEntriesForRange: (startDate, endDate) => {
    return get()
      .entries.filter((e) => e.date >= startDate && e.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date))
  },

  getAllEntriesSorted: () => {
    return [...get().entries].sort((a, b) => b.date.localeCompare(a.date))
  },
}))

// Helper to get today's date formatted
export const getTodayDate = () => format(new Date(), "yyyy-MM-dd")
