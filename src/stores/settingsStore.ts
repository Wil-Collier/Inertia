import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { UserSettings, ThemeMode, NutritionGoals, WeightUnit, DistanceUnit, UnitPreferences } from "@/lib/types"

interface SettingsStore {
  settings: UserSettings
  setTheme: (theme: ThemeMode) => void
  setNutritionGoals: (goals: NutritionGoals) => void
  updateNutritionGoal: (key: keyof NutritionGoals, value: number) => void
  setRestTimerDuration: (seconds: number) => void
  setWeightUnit: (unit: WeightUnit) => void
  setDistanceUnit: (unit: DistanceUnit) => void
  setUnitPreferences: (prefs: Partial<UnitPreferences>) => void
  setNotificationsEnabled: (enabled: boolean) => void
  resetSettings: () => void
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
  weightUnit: "lbs",
  unitPreferences: defaultUnitPreferences,
  notificationsEnabled: false,
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,

      setTheme: (theme) => {
        set((state) => ({
          settings: { ...state.settings, theme },
        }))
      },

      setNutritionGoals: (goals) => {
        set((state) => ({
          settings: { ...state.settings, nutritionGoals: goals },
        }))
      },

      updateNutritionGoal: (key, value) => {
        set((state) => ({
          settings: {
            ...state.settings,
            nutritionGoals: {
              ...state.settings.nutritionGoals,
              [key]: value,
            },
          },
        }))
      },

      setRestTimerDuration: (seconds) => {
        set((state) => ({
          settings: { ...state.settings, restTimerDuration: seconds },
        }))
      },

      setWeightUnit: (unit) => {
        set((state) => ({
          settings: {
            ...state.settings,
            weightUnit: unit,
            unitPreferences: { ...state.settings.unitPreferences, weight: unit },
          },
        }))
      },

      setDistanceUnit: (unit) => {
        set((state) => ({
          settings: {
            ...state.settings,
            unitPreferences: { ...state.settings.unitPreferences, distance: unit },
          },
        }))
      },

      setUnitPreferences: (prefs) => {
        set((state) => ({
          settings: {
            ...state.settings,
            unitPreferences: { ...state.settings.unitPreferences, ...prefs },
            // Keep weightUnit in sync for backward compatibility
            ...(prefs.weight && { weightUnit: prefs.weight }),
          },
        }))
      },

      setNotificationsEnabled: (enabled) => {
        set((state) => ({
          settings: { ...state.settings, notificationsEnabled: enabled },
        }))
      },

      resetSettings: () => {
        set({ settings: defaultSettings })
      },
    }),
    {
      name: "training-app-settings",
      version: 6,
      migrate: (persistedState, version) => {
        const state = persistedState as SettingsStore
        if (version < 2) {
          // Add fiber and sugar goals if they don't exist
          return {
            ...state,
            settings: {
              ...state.settings,
              nutritionGoals: {
                ...state.settings.nutritionGoals,
                fiber: state.settings.nutritionGoals.fiber ?? 30,
                sugar: state.settings.nutritionGoals.sugar ?? 50,
              },
            },
          }
        }
        if (version < 3) {
          // Add rest timer duration setting
          return {
            ...state,
            settings: {
              ...state.settings,
              restTimerDuration: state.settings.restTimerDuration ?? 90,
            },
          }
        }
        if (version < 4) {
          // Add weight unit setting
          return {
            ...state,
            settings: {
              ...state.settings,
              weightUnit: state.settings.weightUnit ?? "lbs",
            },
          }
        }
        if (version < 5) {
          // Add notifications setting
          return {
            ...state,
            settings: {
              ...state.settings,
              notificationsEnabled: state.settings.notificationsEnabled ?? false,
            },
          }
        }
        if (version < 6) {
          // Add unit preferences (migrate from legacy weightUnit)
          const existingWeightUnit = state.settings.weightUnit ?? "lbs"
          return {
            ...state,
            settings: {
              ...state.settings,
              unitPreferences: {
                weight: existingWeightUnit,
                distance: existingWeightUnit === "kg" ? "km" : "mi",
              },
            },
          }
        }
        return state
      },
    }
  )
)
