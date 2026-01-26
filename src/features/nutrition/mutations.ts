import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { MealEntry, FoodItem, MealType, DailyNutrition, NutritionTotals } from "@/lib/types"
import { calculateNutritionTotals } from "@/lib/nutritionUtils"
import type { MealEntryWithFood } from "./queries"

import { achievementService } from "@/services/achievementService"

export function useAddMealEntry() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({
      date,
      foodId,
      quantity,
      mealType,
    }: {
      date: string
      foodId: string
      quantity: number
      mealType: MealType
    }) => {
      const entry: MealEntry = {
        id: crypto.randomUUID(),
        foodId,
        quantity,
        mealType,
      }
      
      await db.transaction("rw", db.nutritionLogs, async () => {
        const existing = await db.nutritionLogs.get(date)
        
        if (existing) {
          await db.nutritionLogs.update(date, {
            entries: [...existing.entries, entry],
          })
        } else {
          await db.nutritionLogs.add({ date, entries: [entry] })
        }
      })

      // Update streaks and check achievements
      await achievementService.updateNutritionStreak(date)
      await achievementService.checkNutritionAchievements()
      
      return entry
    },
    onSuccess: (_, { date }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.nutrition.daily(date) })
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.nutrition.all, "dates"] })
    },
    onError: () => {
      toast.error("Failed to add food entry")
    },
  })
}

export function useUpdateMealEntry() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      date, 
      entryId, 
      updates 
    }: { 
      date: string; 
      entryId: string; 
      updates: Partial<MealEntry> 
    }) => {
      await db.transaction("rw", db.nutritionLogs, async () => {
        const existing = await db.nutritionLogs.get(date)
        if (!existing) throw new Error("Log not found")
        
        const updatedEntries = existing.entries.map(e => 
          e.id === entryId ? { ...e, ...updates } : e
        )
        
        await db.nutritionLogs.update(date, { entries: updatedEntries })
      })
    },
    onSuccess: (_, { date }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.nutrition.daily(date) })
    },
    onError: () => {
      toast.error("Failed to update entry")
    }
  })
}

export function useRemoveMealEntry() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ date, entryId }: { date: string; entryId: string }) => {
      await db.transaction("rw", db.nutritionLogs, async () => {
        const existing = await db.nutritionLogs.get(date)
        if (!existing) return
        
        await db.nutritionLogs.update(date, {
          entries: existing.entries.filter((e) => e.id !== entryId),
        })
      })
      
      // Check nutrition achievements after entry removal
      await achievementService.checkNutritionAchievements()
    },
    onMutate: async ({ date, entryId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.nutrition.daily(date) })
      
      const previous = queryClient.getQueryData<{
        log: DailyNutrition | null;
        totals: NutritionTotals;
        entriesWithFood: MealEntryWithFood[];
      }>(queryKeys.nutrition.daily(date))
      
      if (previous) {
        const updatedEntriesWithFood = previous.entriesWithFood.filter((e) => e.id !== entryId)
        const foodsById = new Map(
          updatedEntriesWithFood
            .filter((e): e is MealEntryWithFood & { food: FoodItem } => !!e.food)
            .map((e) => [e.foodId, e.food])
        )
        const updatedTotals = calculateNutritionTotals(
          updatedEntriesWithFood,
          foodsById
        )

        queryClient.setQueryData(queryKeys.nutrition.daily(date), {
          ...previous,
          log: previous.log ? {
            ...previous.log,
            entries: previous.log.entries.filter((e: MealEntry) => e.id !== entryId)
          } : null,
          entriesWithFood: updatedEntriesWithFood,
          totals: updatedTotals,
        })
      }
      
      return { previous }
    },
    onError: (_, { date }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.nutrition.daily(date), context.previous)
      }
      toast.error("Failed to remove entry")
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.nutrition.daily(variables.date) })
    }
  })
}

export function useAddFood() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (food: Omit<FoodItem, "id">) => {
      const id = crypto.randomUUID()
      const newFood = { ...food, id, isCustom: food.isCustom ?? true }
      await db.foods.add(newFood)
      return newFood
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.foods.all })
    },
    onError: () => {
      toast.error("Failed to add food")
    },
  })
}

export function useDeleteFood() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Check if food is used in any meal entries using until() for proper early termination
      let isUsed = false
      await db.nutritionLogs
        .toCollection()
        .until(() => isUsed)
        .each((log) => {
          if (log.entries.some((entry) => entry.foodId === id)) {
            isUsed = true
          }
        })
      
      if (isUsed) {
        throw new Error("Cannot delete food that is used in meal entries. Remove the entries first.")
      }

      await db.foods.delete(id)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.foods.all })
      toast.success("Food deleted")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete food")
    }
  })
}

export function useToggleFavoriteFood() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, isFavorite, food }: { id: string; isFavorite: boolean; food?: FoodItem }) => {
      const existing = await db.foods.get(id)
      
      if (existing) {
        await db.foods.update(id, { isFavorite })
      } else if (food) {
        // If food doesn't exist locally (e.g. from search), add it to DB
        await db.foods.add({ ...food, isFavorite })
      }
    },
    onMutate: async ({ id, isFavorite }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: queryKeys.foods.all })

      // Snapshot the current search/favorites data
      const previousData = queryClient.getQueriesData({ queryKey: queryKeys.foods.all })

      // Optimistically update any queries that might contain this food
      queryClient.setQueriesData({ queryKey: queryKeys.foods.all }, (old: unknown) => {
        if (Array.isArray(old)) {
          return old.map((item: unknown) => {
            if (item && typeof item === "object" && "id" in item && item.id === id) {
              return { ...item, isFavorite }
            }
            return item
          })
        }
        return old
      })

      return { previousData }
    },
    onError: (_err, _variables, context) => {
      // Rollback to the previous state if mutation fails
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data)
        }
      }
      toast.error("Failed to update favorite")
    },
    onSettled: () => {
      // Invalidate to ensure consistency with DB
      void queryClient.invalidateQueries({ queryKey: queryKeys.foods.all })
    },
  })
}

export function useSaveMealTemplate() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ name, entries }: { name: string; entries: Omit<MealEntry, "id">[] }) => {
      const id = crypto.randomUUID()
      await db.mealTemplates.add({ id, name, entries })
      return id
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.foods.all, "meal-templates"] })
      toast.success("Template saved")
    },
    onError: () => {
      toast.error("Failed to save template")
    }
  })
}

export function useUpdateMealTemplate() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, name, entries }: { id: string; name: string; entries: Omit<MealEntry, "id">[] }) => {
      await db.mealTemplates.update(id, { name, entries })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.foods.all, "meal-templates"] })
      toast.success("Template updated")
    },
    onError: () => {
      toast.error("Failed to update template")
    }
  })
}

export function useDeleteMealTemplate() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      await db.mealTemplates.delete(id)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.foods.all, "meal-templates"] })
      toast.success("Template deleted")
    },
    onError: () => {
      toast.error("Failed to delete template")
    }
  })
}

export function useApplyMealTemplate() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      templateId, 
      date, 
      mealType 
    }: { 
      templateId: string; 
      date: string; 
      mealType: MealType 
    }) => {
      const template = await db.mealTemplates.get(templateId)
      if (!template) throw new Error("Template not found")
      
      const instanceId = crypto.randomUUID()

      const newEntries: MealEntry[] = template.entries.map(e => ({
        ...e,
        id: crypto.randomUUID(),
        mealType, // Override with current meal type
        templateId: template.id,
        templateInstanceId: instanceId,
        templateName: template.name
      }))
      
      await db.transaction("rw", db.nutritionLogs, async () => {
        const existing = await db.nutritionLogs.get(date)
        if (existing) {
          await db.nutritionLogs.update(date, {
            entries: [...existing.entries, ...newEntries]
          })
        } else {
          await db.nutritionLogs.add({ date, entries: newEntries })
        }
      })

      // Update streaks and check achievements
      await achievementService.updateNutritionStreak(date)
      await achievementService.checkNutritionAchievements()
    },
    onSuccess: (_, { date }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.nutrition.daily(date) })
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.nutrition.all, "dates"] })
      toast.success("Template applied")
    },
    onError: () => {
      toast.error("Failed to apply template")
    }
  })
}

export function useRemoveMealEntryGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ date, templateInstanceId }: { date: string; templateInstanceId: string }) => {
      await db.transaction("rw", db.nutritionLogs, async () => {
        const existing = await db.nutritionLogs.get(date)
        if (!existing) return

        await db.nutritionLogs.update(date, {
          entries: existing.entries.filter((e) => e.templateInstanceId !== templateInstanceId),
        })
      })
      
      await achievementService.checkNutritionAchievements()
    },
    onSuccess: (_, { date }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.nutrition.daily(date) })
    },
    onError: () => {
      toast.error("Failed to remove template group")
    }
  })
}
