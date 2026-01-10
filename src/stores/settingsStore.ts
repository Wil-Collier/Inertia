import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { UserSettings, ThemeMode, NutritionGoals } from "@/lib/types"

interface SettingsStore {
  settings: UserSettings
  setTheme: (theme: ThemeMode) => void
  setNutritionGoals: (goals: NutritionGoals) => void
  updateNutritionGoal: (key: keyof NutritionGoals, value: number) => void
  resetSettings: () => void
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

      resetSettings: () => {
        set({ settings: defaultSettings })
      },
    }),
    {
      name: "training-app-settings",
      version: 2,
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
        return state
      },
    }
  )
)
