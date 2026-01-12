import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { WeightEntry, WeightUnit } from "@/lib/types"
import { v4 as uuidv4 } from "uuid"
import { format } from "date-fns"

interface BodyWeightStore {
  entries: WeightEntry[]
  preferredUnit: WeightUnit

  // Entry Actions
  addEntry: (weight: number, date?: string, note?: string) => WeightEntry
  updateEntry: (id: string, updates: Partial<Omit<WeightEntry, "id">>) => void
  deleteEntry: (id: string) => void

  // Query Actions
  getLatestEntry: () => WeightEntry | undefined
  getEntryForDate: (date: string) => WeightEntry | undefined
  getEntriesForRange: (startDate: string, endDate: string) => WeightEntry[]
  getAllEntriesSorted: () => WeightEntry[]

  // Settings
  setPreferredUnit: (unit: WeightUnit) => void

  // Utility
  convertWeight: (weight: number, from: WeightUnit, to: WeightUnit) => number
}

export const useBodyWeightStore = create<BodyWeightStore>()(
  persist(
    (set, get) => ({
      entries: [],
      preferredUnit: "lbs",

      addEntry: (weight, date, note) => {
        const entryDate = date || format(new Date(), "yyyy-MM-dd")
        
        // Check if entry for this date already exists
        const existingEntry = get().entries.find((e) => e.date === entryDate)
        
        if (existingEntry) {
          // Update existing entry
          get().updateEntry(existingEntry.id, { weight, note })
          return { ...existingEntry, weight, note }
        }

        const newEntry: WeightEntry = {
          id: uuidv4(),
          date: entryDate,
          weight,
          note,
        }

        set((state) => ({
          entries: [...state.entries, newEntry],
        }))

        return newEntry
      },

      updateEntry: (id, updates) => {
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        }))
      },

      deleteEntry: (id) => {
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        }))
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

      setPreferredUnit: (unit) => {
        set({ preferredUnit: unit })
      },

      convertWeight: (weight, from, to) => {
        if (from === to) return weight
        if (from === "lbs" && to === "kg") return weight * 0.453592
        if (from === "kg" && to === "lbs") return weight * 2.20462
        return weight
      },
    }),
    {
      name: "training-app-bodyweight",
      version: 1,
    }
  )
)

// Helper to get today's date formatted
export const getTodayDate = () => format(new Date(), "yyyy-MM-dd")
