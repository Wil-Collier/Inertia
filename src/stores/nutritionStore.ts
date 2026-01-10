import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  FoodItem,
  DailyNutrition,
  MealEntry,
  MealType,
  NutritionGoals,
} from "@/lib/types"
import { v4 as uuidv4 } from "uuid"
import { format } from "date-fns"

interface NutritionStore {
  foods: FoodItem[]
  dailyLogs: DailyNutrition[]
  mealTemplates: { id: string; name: string; entries: Omit<MealEntry, "id">[] }[]

  // Food Actions
  addFood: (food: Omit<FoodItem, "id" | "isCustom">) => FoodItem
  updateFood: (id: string, updates: Partial<Omit<FoodItem, "id">>) => void
  deleteFood: (id: string) => void
  toggleFavorite: (id: string) => void
  getFood: (id: string) => FoodItem | undefined
  getFavorites: () => FoodItem[]
  searchFoods: (query: string) => FoodItem[]

  // Meal Entry Actions
  addMealEntry: (
    date: string,
    foodId: string,
    quantity: number,
    mealType: MealType
  ) => void
  updateMealEntry: (
    date: string,
    entryId: string,
    updates: Partial<Omit<MealEntry, "id">>
  ) => void
  removeMealEntry: (date: string, entryId: string) => void

  // Daily Log Actions
  getDailyLog: (date: string) => DailyNutrition | undefined
  getDailyTotals: (
    date: string
  ) => { calories: number; protein: number; carbs: number; fat: number }
  getEntriesByMealType: (date: string, mealType: MealType) => MealEntry[]

  // Template Actions
  saveMealTemplate: (name: string, entries: Omit<MealEntry, "id">[]) => void
  deleteMealTemplate: (id: string) => void
  applyMealTemplate: (templateId: string, date: string) => void

  // Progress calculation
  getProgressToGoals: (
    date: string,
    goals: NutritionGoals
  ) => {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
}

export const useNutritionStore = create<NutritionStore>()(
  persist(
    (set, get) => ({
      foods: [],
      dailyLogs: [],
      mealTemplates: [],

      addFood: (food) => {
        const newFood: FoodItem = {
          ...food,
          id: uuidv4(),
          isCustom: true,
        }
        set((state) => ({
          foods: [...state.foods, newFood],
        }))
        return newFood
      },

      updateFood: (id, updates) => {
        set((state) => ({
          foods: state.foods.map((f) => (f.id === id ? { ...f, ...updates } : f)),
        }))
      },

      deleteFood: (id) => {
        set((state) => ({
          foods: state.foods.filter((f) => f.id !== id),
        }))
      },

      toggleFavorite: (id) => {
        set((state) => ({
          foods: state.foods.map((f) =>
            f.id === id ? { ...f, isFavorite: !f.isFavorite } : f
          ),
        }))
      },

      getFood: (id) => {
        return get().foods.find((f) => f.id === id)
      },

      getFavorites: () => {
        return get().foods.filter((f) => f.isFavorite)
      },

      searchFoods: (query) => {
        const q = query.toLowerCase()
        return get().foods.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.brand?.toLowerCase().includes(q)
        )
      },

      addMealEntry: (date, foodId, quantity, mealType) => {
        const entry: MealEntry = {
          id: uuidv4(),
          foodId,
          quantity,
          mealType,
        }

        set((state) => {
          const existingLog = state.dailyLogs.find((l) => l.date === date)

          if (existingLog) {
            return {
              dailyLogs: state.dailyLogs.map((l) =>
                l.date === date
                  ? { ...l, entries: [...l.entries, entry] }
                  : l
              ),
            }
          }

          return {
            dailyLogs: [
              ...state.dailyLogs,
              { date, entries: [entry] },
            ],
          }
        })
      },

      updateMealEntry: (date, entryId, updates) => {
        set((state) => ({
          dailyLogs: state.dailyLogs.map((l) =>
            l.date === date
              ? {
                  ...l,
                  entries: l.entries.map((e) =>
                    e.id === entryId ? { ...e, ...updates } : e
                  ),
                }
              : l
          ),
        }))
      },

      removeMealEntry: (date, entryId) => {
        set((state) => ({
          dailyLogs: state.dailyLogs.map((l) =>
            l.date === date
              ? {
                  ...l,
                  entries: l.entries.filter((e) => e.id !== entryId),
                }
              : l
          ),
        }))
      },

      getDailyLog: (date) => {
        return get().dailyLogs.find((l) => l.date === date)
      },

      getDailyTotals: (date) => {
        const log = get().getDailyLog(date)
        if (!log) return { calories: 0, protein: 0, carbs: 0, fat: 0 }

        return log.entries.reduce(
          (acc, entry) => {
            const food = get().getFood(entry.foodId)
            if (!food) return acc

            return {
              calories: acc.calories + food.calories * entry.quantity,
              protein: acc.protein + food.protein * entry.quantity,
              carbs: acc.carbs + food.carbs * entry.quantity,
              fat: acc.fat + food.fat * entry.quantity,
            }
          },
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        )
      },

      getEntriesByMealType: (date, mealType) => {
        const log = get().getDailyLog(date)
        if (!log) return []
        return log.entries.filter((e) => e.mealType === mealType)
      },

      saveMealTemplate: (name, entries) => {
        set((state) => ({
          mealTemplates: [
            ...state.mealTemplates,
            { id: uuidv4(), name, entries },
          ],
        }))
      },

      deleteMealTemplate: (id) => {
        set((state) => ({
          mealTemplates: state.mealTemplates.filter((t) => t.id !== id),
        }))
      },

      applyMealTemplate: (templateId, date) => {
        const template = get().mealTemplates.find((t) => t.id === templateId)
        if (!template) return

        template.entries.forEach((entry) => {
          get().addMealEntry(date, entry.foodId, entry.quantity, entry.mealType)
        })
      },

      getProgressToGoals: (date, goals) => {
        const totals = get().getDailyTotals(date)
        return {
          calories: goals.calories > 0 ? (totals.calories / goals.calories) * 100 : 0,
          protein: goals.protein > 0 ? (totals.protein / goals.protein) * 100 : 0,
          carbs: goals.carbs > 0 ? (totals.carbs / goals.carbs) * 100 : 0,
          fat: goals.fat > 0 ? (totals.fat / goals.fat) * 100 : 0,
        }
      },
    }),
    {
      name: "training-app-nutrition",
      version: 1,
    }
  )
)

// Helper to get today's date formatted
export const getTodayDate = () => format(new Date(), "yyyy-MM-dd")
