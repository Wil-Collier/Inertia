import { create } from "zustand"
import type { UserSettings, ThemeMode, NutritionGoals, WeightUnit, DistanceUnit, UnitPreferences } from "@/lib/types"
import { db } from "@/services/db"

import { toast } from "sonner"

// DB stores settings with an id field for the singleton pattern
type SettingsDBEntry = UserSettings & { id: string }

interface SettingsStore {
  settings: UserSettings
  isInitialized: boolean
  loadSettings: () => Promise<void>
  setTheme: (theme: ThemeMode) => Promise<void>
  setNutritionGoals: (goals: NutritionGoals) => Promise<void>
  updateNutritionGoal: (key: keyof NutritionGoals, value: number) => Promise<void>
  setRestTimerDuration: (seconds: number) => Promise<void>
  setWeightUnit: (unit: WeightUnit) => Promise<void>
  setDistanceUnit: (unit: DistanceUnit) => Promise<void>
  setUnitPreferences: (prefs: Partial<UnitPreferences>) => Promise<void>
  setNotificationsEnabled: (enabled: boolean) => Promise<void>
  resetSettings: () => Promise<void>
}

const defaultUnitPreferences: UnitPreferences = {
  weight: "lbs",
  distance: "mi",
}

const defaultSettings: UserSettings = {
  theme: "system",
  nutritionGoals: {
    calories: 2500,
    protein: 150,
    carbs: 300,
    fat: 80,
    fiber: 30,
    sugar: 50,
  },
  restTimerDuration: 90,
  unitPreferences: defaultUnitPreferences,
  notificationsEnabled: false,
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,
  isInitialized: false,

  loadSettings: async () => {
    try {
      const saved = await db.settings.get("settings") as SettingsDBEntry | undefined
      if (saved) {
        // Strip the id field from the DB entry to get UserSettings
        const { id: _id, ...settings } = saved
        set({ settings: { ...defaultSettings, ...settings }, isInitialized: true })
      } else {
        // First run, save defaults
        await db.settings.put({ ...defaultSettings, id: "settings" })
        set({ isInitialized: true })
      }
    } catch (error) {
      console.error("Failed to load settings:", error)
      set({ isInitialized: true })
    }
  },

  setTheme: async (theme) => {
    const previousSettings = get().settings
    set((state) => ({
      settings: { ...state.settings, theme }
    }))

    try {
      await db.settings.update("settings", { theme })
    } catch (error) {
      console.error("Failed to set theme:", error)
      toast.error("Failed to save theme setting")
      set({ settings: previousSettings })
    }
  },

  setNutritionGoals: async (goals) => {
    const previousSettings = get().settings
    set((state) => ({
      settings: { ...state.settings, nutritionGoals: goals }
    }))

    try {
      await db.settings.update("settings", { nutritionGoals: goals })
    } catch (error) {
      console.error("Failed to set nutrition goals:", error)
      toast.error("Failed to save nutrition goals")
      set({ settings: previousSettings })
    }
  },

  updateNutritionGoal: async (key, value) => {
    const previousSettings = get().settings
    const newGoals = { ...previousSettings.nutritionGoals, [key]: value }

    set((state) => ({
      settings: { ...state.settings, nutritionGoals: newGoals }
    }))

    try {
      await db.settings.update("settings", { nutritionGoals: newGoals })
    } catch (error) {
      console.error("Failed to update nutrition goal:", error)
      toast.error("Failed to save nutrition goal")
      set({ settings: previousSettings })
    }
  },

  setRestTimerDuration: async (seconds) => {
    const previousSettings = get().settings
    set((state) => ({
      settings: { ...state.settings, restTimerDuration: seconds }
    }))

    try {
      await db.settings.update("settings", { restTimerDuration: seconds })
    } catch (error) {
      console.error("Failed to set rest timer:", error)
      toast.error("Failed to save rest timer setting")
      set({ settings: previousSettings })
    }
  },

  setWeightUnit: async (unit) => {
    const previousSettings = get().settings
    const newPrefs = { ...previousSettings.unitPreferences, weight: unit }

    set((state) => ({
      settings: { ...state.settings, unitPreferences: newPrefs }
    }))

    try {
      await db.settings.update("settings", { unitPreferences: newPrefs })
    } catch (error) {
      console.error("Failed to set weight unit:", error)
      toast.error("Failed to save weight unit setting")
      set({ settings: previousSettings })
    }
  },

  setDistanceUnit: async (unit) => {
    const previousSettings = get().settings
    const newPrefs = { ...previousSettings.unitPreferences, distance: unit }

    set((state) => ({
      settings: { ...state.settings, unitPreferences: newPrefs }
    }))

    try {
      await db.settings.update("settings", { unitPreferences: newPrefs })
    } catch (error) {
      console.error("Failed to set distance unit:", error)
      toast.error("Failed to save distance unit setting")
      set({ settings: previousSettings })
    }
  },

  setUnitPreferences: async (prefs) => {
    const previousSettings = get().settings
    const newPrefs = { ...previousSettings.unitPreferences, ...prefs }

    set((state) => ({
      settings: { ...state.settings, unitPreferences: newPrefs }
    }))

    try {
      await db.settings.update("settings", { unitPreferences: newPrefs })
    } catch (error) {
      console.error("Failed to set unit preferences:", error)
      toast.error("Failed to save unit preferences")
      set({ settings: previousSettings })
    }
  },

  setNotificationsEnabled: async (enabled) => {
    const previousSettings = get().settings
    set((state) => ({
      settings: { ...state.settings, notificationsEnabled: enabled }
    }))

    try {
      await db.settings.update("settings", { notificationsEnabled: enabled })
    } catch (error) {
      console.error("Failed to set notifications:", error)
      toast.error("Failed to save notification setting")
      set({ settings: previousSettings })
    }
  },

  resetSettings: async () => {
    try {
      await db.settings.put({ ...defaultSettings, id: "settings" })
      set({ settings: defaultSettings })
    } catch (error) {
      console.error("Failed to reset settings:", error)
      toast.error("Failed to reset settings")
      throw error
    }
  },
}))

