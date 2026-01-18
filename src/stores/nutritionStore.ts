import { create } from "zustand"
import type {
  FoodItem,
  DailyNutrition,
  MealEntry,
  MealType,
} from "@/lib/types"
import { v4 as uuidv4 } from "uuid"
import { db } from "@/services/db"
import { achievementService } from "@/services/achievementService"
import { toast } from "sonner"
import { getToday } from "@/lib/dateUtils"

interface NutritionStore {
  isInitialized: boolean
  
  init: () => Promise<void>

  // Food Actions
  addFood: (food: Omit<FoodItem, "id" | "isCustom">) => Promise<FoodItem>
  updateFood: (id: string, updates: Partial<Omit<FoodItem, "id">>) => Promise<void>
  deleteFood: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>

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

  // Template Actions
  saveMealTemplate: (name: string, entries: Omit<MealEntry, "id">[]) => Promise<void>
  deleteMealTemplate: (id: string) => Promise<void>
  applyMealTemplate: (templateId: string, date: string, mealType: MealType) => Promise<void>
}

export const useNutritionStore = create<NutritionStore>((set, get) => ({
  isInitialized: false,

  init: async () => {
    if (get().isInitialized) return
    // No need to load arrays into memory anymore.
    // Just mark as initialized so the app can boot.
    set({ isInitialized: true })
  },

  addFood: async (food) => {
    const newFood: FoodItem = {
      ...food,
      id: uuidv4(),
      isCustom: true,
    }
    try {
      await db.foods.add(newFood)
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
    } catch (error) {
      console.error("Failed to update food:", error)
      toast.error("Failed to update food")
      throw error
    }
  },

  deleteFood: async (id) => {
    try {
      await db.foods.delete(id)
    } catch (error) {
      console.error("Failed to delete food:", error)
      toast.error("Failed to delete food")
      throw error
    }
  },

  toggleFavorite: async (id) => {
    try {
      const food = await db.foods.get(id)
      if (food) {
        await db.foods.update(id, { isFavorite: !food.isFavorite })
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error)
      toast.error("Failed to update favorite status")
      throw error
    }
  },

  addMealEntry: async (date, foodId, quantity, mealType) => {
    const entry: MealEntry = {
      id: uuidv4(),
      foodId,
      quantity,
      mealType,
    }

    try {
      const existingLog = await db.nutritionLogs.get(date)
      let newLog: DailyNutrition

      if (existingLog) {
        newLog = { ...existingLog, entries: [...existingLog.entries, entry] }
      } else {
        newLog = { date, entries: [entry] }
      }

      await db.nutritionLogs.put(newLog)
      // Update achievements
      achievementService.checkNutritionAchievements()
      achievementService.updateStreaks()
    } catch (error) {
      console.error("Failed to add meal entry:", error)
      toast.error("Failed to save meal entry")
      throw error
    }
  },

  updateMealEntry: async (date, entryId, updates) => {
    try {
      const existingLog = await db.nutritionLogs.get(date)
      if (existingLog) {
        const newLog: DailyNutrition = {
          ...existingLog,
          entries: existingLog.entries.map((e) =>
            e.id === entryId ? { ...e, ...updates } : e
          ),
        }
        await db.nutritionLogs.put(newLog)
      }
    } catch (error) {
      console.error("Failed to update meal entry:", error)
      toast.error("Failed to update meal entry")
      throw error
    }
  },

  removeMealEntry: async (date, entryId) => {
    try {
      const existingLog = await db.nutritionLogs.get(date)
      if (existingLog) {
        const newEntries = existingLog.entries.filter((e) => e.id !== entryId)
        
        if (newEntries.length === 0) {
          await db.nutritionLogs.delete(date)
        } else {
          await db.nutritionLogs.put({ ...existingLog, entries: newEntries })
        }
        // Update achievements
        achievementService.checkNutritionAchievements()
        achievementService.updateStreaks()
      }
    } catch (error) {
      console.error("Failed to remove meal entry:", error)
      toast.error("Failed to remove meal entry")
      throw error
    }
  },

  saveMealTemplate: async (name, entries) => {
    const template = { id: uuidv4(), name, entries }
    try {
      await db.mealTemplates.add(template)
    } catch (error) {
      console.error("Failed to save meal template:", error)
      toast.error("Failed to save meal template")
      throw error
    }
  },

  deleteMealTemplate: async (id) => {
    try {
      await db.mealTemplates.delete(id)
    } catch (error) {
      console.error("Failed to delete meal template:", error)
      toast.error("Failed to delete meal template")
      throw error
    }
  },

  applyMealTemplate: async (templateId, date, mealType) => {
    try {
      const template = await db.mealTemplates.get(templateId)
      if (!template) return

      const entriesToAdd: MealEntry[] = template.entries.map(e => ({
        ...e,
        id: uuidv4(),
        mealType
      }))

      const existingLog = await db.nutritionLogs.get(date)
      if (existingLog) {
        await db.nutritionLogs.put({
          ...existingLog,
          entries: [...existingLog.entries, ...entriesToAdd]
        })
      } else {
        await db.nutritionLogs.put({
          date,
          entries: entriesToAdd
        })
      }
      // Update achievements
      achievementService.checkNutritionAchievements()
      achievementService.updateStreaks()
    } catch (error) {
      console.error("Failed to apply meal template:", error)
      toast.error("Failed to apply meal template")
      throw error
    }
  },
}))

// Helper to get today's date formatted
export const getTodayDate = getToday

