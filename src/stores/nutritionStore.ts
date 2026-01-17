import { create } from "zustand"
import type {
  FoodItem,
  DailyNutrition,
  MealEntry,
  MealType,
  NutritionGoals,
} from "@/lib/types"
import { v4 as uuidv4 } from "uuid"
import { format } from "date-fns"
import { db } from "@/services/db"

import { toast } from "sonner"

interface NutritionStore {
  foods: FoodItem[]
  dailyLogs: DailyNutrition[]
  mealTemplates: { id: string; name: string; entries: Omit<MealEntry, "id">[] }[]
  isInitialized: boolean
  
  init: () => Promise<void>

  // Food Actions
  addFood: (food: Omit<FoodItem, "id" | "isCustom">) => Promise<FoodItem>
  updateFood: (id: string, updates: Partial<Omit<FoodItem, "id">>) => Promise<void>
  deleteFood: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  getFood: (id: string) => FoodItem | undefined
  getFavorites: () => FoodItem[]
  getCustomFoods: () => FoodItem[]
  searchFoods: (query: string) => FoodItem[]

  // Meal Entry Actions
  addMealEntry: (
    date: string,
    foodId: string,
    quantity: number,
    mealType: MealType
  ) => Promise<void>
  updateMealEntry: (
    date: string,
    entryId: string,
    updates: Partial<Omit<MealEntry, "id">>
  ) => Promise<void>
  removeMealEntry: (date: string, entryId: string) => Promise<void>

  // Daily Log Actions
  getDailyLog: (date: string) => DailyNutrition | undefined
  getDailyTotals: (
    date: string
  ) => { calories: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number }
  getEntriesByMealType: (date: string, mealType: MealType) => MealEntry[]

  // Template Actions
  saveMealTemplate: (name: string, entries: Omit<MealEntry, "id">[]) => Promise<void>
  deleteMealTemplate: (id: string) => Promise<void>
  applyMealTemplate: (templateId: string, date: string, mealType: MealType) => Promise<void>

  // Progress calculation
  getProgressToGoals: (
    date: string,
    goals: NutritionGoals
  ) => {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    sugar: number
  }

  // History/Trends
  getDailyTotalsForRange: (
    startDate: string,
    endDate: string
  ) => Array<{
    date: string
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    sugar: number
  }>
  getAveragesForRange: (
    startDate: string,
    endDate: string
  ) => {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    sugar: number
  }
  getLoggedDates: () => string[]
}

export const useNutritionStore = create<NutritionStore>((set, get) => ({
  foods: [],
  dailyLogs: [],
  mealTemplates: [],
  isInitialized: false,

  init: async () => {
    if (get().isInitialized) return
    try {
      const [foods, logs, templates] = await Promise.all([
        db.foods.toArray(),
        db.nutritionLogs.toArray(),
        db.mealTemplates.toArray(),
      ])
      set({
        foods,
        dailyLogs: logs,
        mealTemplates: templates,
        isInitialized: true,
      })
    } catch (error) {
      console.error("Failed to init nutrition store:", error)
      set({ isInitialized: true })
    }
  },

  addFood: async (food) => {
    const newFood: FoodItem = {
      ...food,
      id: uuidv4(),
      isCustom: true,
    }
    try {
      await db.foods.add(newFood)
      set((state) => ({
        foods: [...state.foods, newFood],
      }))
      return newFood
    } catch (error) {
      console.error("Failed to add food:", error)
      toast.error("Failed to save food")
      throw error
    }
  },

  updateFood: async (id, updates) => {
    try {
      await db.foods.update(id, updates)
      set((state) => ({
        foods: state.foods.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      }))
    } catch (error) {
      console.error("Failed to update food:", error)
      toast.error("Failed to update food")
      throw error
    }
  },

  deleteFood: async (id) => {
    try {
      await db.foods.delete(id)
      set((state) => ({
        foods: state.foods.filter((f) => f.id !== id),
      }))
    } catch (error) {
      console.error("Failed to delete food:", error)
      toast.error("Failed to delete food")
      throw error
    }
  },

  toggleFavorite: async (id) => {
    const food = get().foods.find((f) => f.id === id)
    if (food) {
      const isFavorite = !food.isFavorite
      try {
        await db.foods.update(id, { isFavorite })
        set((state) => ({
          foods: state.foods.map((f) =>
            f.id === id ? { ...f, isFavorite } : f
          ),
        }))
      } catch (error) {
        console.error("Failed to toggle favorite:", error)
        toast.error("Failed to update favorite status")
        throw error
      }
    }
  },

  getFood: (id) => {
    return get().foods.find((f) => f.id === id)
  },

  getFavorites: () => {
    return get().foods.filter((f) => f.isFavorite)
  },

  getCustomFoods: () => {
    return get().foods.filter((f) => f.isCustom)
  },

  searchFoods: (query) => {
    const q = query.toLowerCase()
    return get().foods.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.brand?.toLowerCase().includes(q)
    )
  },

  addMealEntry: async (date, foodId, quantity, mealType) => {
    const entry: MealEntry = {
      id: uuidv4(),
      foodId,
      quantity,
      mealType,
    }

    const state = get()
    const existingLog = state.dailyLogs.find((l) => l.date === date)
    let newLog: DailyNutrition

    if (existingLog) {
      newLog = { ...existingLog, entries: [...existingLog.entries, entry] }
    } else {
      newLog = { date, entries: [entry] }
    }

    try {
      await db.nutritionLogs.put(newLog)
      if (existingLog) {
        set((state) => ({
          dailyLogs: state.dailyLogs.map((l) =>
            l.date === date ? newLog : l
          ),
        }))
      } else {
        set((state) => ({
          dailyLogs: [...state.dailyLogs, newLog],
        }))
      }
    } catch (error) {
      console.error("Failed to add meal entry:", error)
      toast.error("Failed to save meal entry")
      throw error
    }
  },

  updateMealEntry: async (date, entryId, updates) => {
    const state = get()
    const existingLog = state.dailyLogs.find((l) => l.date === date)
    
    if (existingLog) {
      const newLog: DailyNutrition = {
        ...existingLog,
        entries: existingLog.entries.map((e) =>
          e.id === entryId ? { ...e, ...updates } : e
        ),
      }
      
      try {
        await db.nutritionLogs.put(newLog)
        set((state) => ({
          dailyLogs: state.dailyLogs.map((l) =>
            l.date === date ? newLog : l
          ),
        }))
      } catch (error) {
        console.error("Failed to update meal entry:", error)
        toast.error("Failed to update meal entry")
        throw error
      }
    }
  },

  removeMealEntry: async (date, entryId) => {
    const state = get()
    const existingLog = state.dailyLogs.find((l) => l.date === date)
    
    if (existingLog) {
      const newLog: DailyNutrition = {
        ...existingLog,
        entries: existingLog.entries.filter((e) => e.id !== entryId),
      }

      try {
        if (newLog.entries.length === 0) {
          await db.nutritionLogs.delete(date)
          set((state) => ({
            dailyLogs: state.dailyLogs.filter((l) => l.date !== date),
          }))
        } else {
          await db.nutritionLogs.put(newLog)
          set((state) => ({
            dailyLogs: state.dailyLogs.map((l) =>
              l.date === date ? newLog : l
            ),
          }))
        }
      } catch (error) {
        console.error("Failed to remove meal entry:", error)
        toast.error("Failed to remove meal entry")
        throw error
      }
    }
  },

  getDailyLog: (date) => {
    return get().dailyLogs.find((l) => l.date === date)
  },

  getDailyTotals: (date) => {
    const log = get().getDailyLog(date)
    if (!log) return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }

    return log.entries.reduce(
      (acc, entry) => {
        const food = get().getFood(entry.foodId)
        if (!food) return acc

        return {
          calories: acc.calories + food.calories * entry.quantity,
          protein: acc.protein + food.protein * entry.quantity,
          carbs: acc.carbs + food.carbs * entry.quantity,
          fat: acc.fat + food.fat * entry.quantity,
          fiber: acc.fiber + (food.fiber ?? 0) * entry.quantity,
          sugar: acc.sugar + (food.sugar ?? 0) * entry.quantity,
        }
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
    )
  },

  getEntriesByMealType: (date, mealType) => {
    const log = get().getDailyLog(date)
    if (!log) return []
    return log.entries.filter((e) => e.mealType === mealType)
  },

  saveMealTemplate: async (name, entries) => {
    const template = { id: uuidv4(), name, entries }
    try {
      await db.mealTemplates.add(template)
      set((state) => ({
        mealTemplates: [
          ...state.mealTemplates,
          template,
        ],
      }))
    } catch (error) {
      console.error("Failed to save meal template:", error)
      toast.error("Failed to save meal template")
      throw error
    }
  },

  deleteMealTemplate: async (id) => {
    try {
      await db.mealTemplates.delete(id)
      set((state) => ({
        mealTemplates: state.mealTemplates.filter((t) => t.id !== id),
      }))
    } catch (error) {
      console.error("Failed to delete meal template:", error)
      toast.error("Failed to delete meal template")
      throw error
    }
  },

  applyMealTemplate: async (templateId, date, mealType) => {
    const template = get().mealTemplates.find((t) => t.id === templateId)
    if (!template) return

    try {
      await Promise.all(
        template.entries.map((entry) =>
          get().addMealEntry(date, entry.foodId, entry.quantity, mealType)
        )
      )
    } catch (error) {
      console.error("Failed to apply meal template:", error)
      toast.error("Failed to apply meal template")
      throw error
    }
  },

  getProgressToGoals: (date, goals) => {
    const totals = get().getDailyTotals(date)
    return {
      calories: goals.calories > 0 ? (totals.calories / goals.calories) * 100 : 0,
      protein: goals.protein > 0 ? (totals.protein / goals.protein) * 100 : 0,
      carbs: goals.carbs > 0 ? (totals.carbs / goals.carbs) * 100 : 0,
      fat: goals.fat > 0 ? (totals.fat / goals.fat) * 100 : 0,
      fiber: goals.fiber > 0 ? (totals.fiber / goals.fiber) * 100 : 0,
      sugar: goals.sugar > 0 ? (totals.sugar / goals.sugar) * 100 : 0,
    }
  },

  getDailyTotalsForRange: (startDate, endDate) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const results: Array<{
      date: string
      calories: number
      protein: number
      carbs: number
      fat: number
      fiber: number
      sugar: number
    }> = []

    const current = new Date(start)
    while (current <= end) {
      const dateStr = format(current, "yyyy-MM-dd")
      const totals = get().getDailyTotals(dateStr)
      results.push({ date: dateStr, ...totals })
      current.setDate(current.getDate() + 1)
    }

    return results
  },

  getAveragesForRange: (startDate, endDate) => {
    const dailyTotals = get().getDailyTotalsForRange(startDate, endDate)
    const daysWithData = dailyTotals.filter((d) => d.calories > 0)

    if (daysWithData.length === 0) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
    }

    const sums = daysWithData.reduce(
      (acc, day) => ({
        calories: acc.calories + day.calories,
        protein: acc.protein + day.protein,
        carbs: acc.carbs + day.carbs,
        fat: acc.fat + day.fat,
        fiber: acc.fiber + day.fiber,
        sugar: acc.sugar + day.sugar,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
    )

    return {
      calories: Math.round(sums.calories / daysWithData.length),
      protein: Math.round(sums.protein / daysWithData.length),
      carbs: Math.round(sums.carbs / daysWithData.length),
      fat: Math.round(sums.fat / daysWithData.length),
      fiber: Math.round(sums.fiber / daysWithData.length),
      sugar: Math.round(sums.sugar / daysWithData.length),
    }
  },

  getLoggedDates: () => {
    return get().dailyLogs.map((log) => log.date).sort()
  },
}))

// Helper to get today's date formatted
export const getTodayDate = () => format(new Date(), "yyyy-MM-dd")
