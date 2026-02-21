import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type {
  DailyNutrition,
  FoodItem,
  MealTemplateEntry,
  MealType,
  NutritionMealEntry,
  NutritionTotals,
} from "@/lib/types"
import { calculateNutritionTotals, INITIAL_TOTALS } from "@/lib/nutritionUtils"
import type { MealEntryWithFood } from "./queries"
import {
  FOODS_SYNC_WRITE_TABLES,
  MEAL_TEMPLATES_SYNC_WRITE_TABLES,
  NUTRITION_LOG_AND_FOODS_SYNC_WRITE_TABLES,
} from "@/services/dbTransactionTables"
import {
  getActiveEntries,
  isEntryDeleted,
  stampEntryUpdatedAt,
  toDeletedEntry,
} from "@/lib/nutritionEntryUtils"

import { achievementService } from "@/services/achievementService"

/**
 * Shared helper to remove entries from a daily log and update food usage counts.
 * Handles single or multiple entry removal.
 */
async function runNutritionLogMutation(
  date: string,
  mutation: (existing: DailyNutrition) => Promise<void>
): Promise<void> {
  await db.transaction("rw", NUTRITION_LOG_AND_FOODS_SYNC_WRITE_TABLES, async () => {
    const existing = await db.nutritionLogs.get(date)
    if (!existing) return
    await mutation(existing)
  })
}

async function updateFoodUsageCount(foodId: string, delta: number): Promise<void> {
  const food = await db.foods.get(foodId)
  if (!food) return
  await db.foods.update(foodId, { usageCount: Math.max(0, (food.usageCount ?? 0) + delta) })
}

async function removeEntriesFromLog(date: string, filterFn: (entry: NutritionMealEntry) => boolean) {
  await runNutritionLogMutation(date, async (existing) => {
    const entriesToRemove = existing.entries.filter(
      (entry) => !isEntryDeleted(entry) && filterFn(entry)
    )
    if (entriesToRemove.length === 0) return

    const now = Date.now()

    // Calculate usage count decrements
    const foodCounts = new Map<string, number>()
    entriesToRemove.forEach(e => {
      foodCounts.set(e.foodId, (foodCounts.get(e.foodId) || 0) + 1)
    })

    // Update food usage counts
    await Promise.all(
      Array.from(foodCounts).map(async ([foodId, count]) => {
        await updateFoodUsageCount(foodId, -count)
      })
    )

    // Tombstone matching active entries; keep record to preserve sync history.
    const nextEntries = existing.entries.map((entry) =>
      !isEntryDeleted(entry) && filterFn(entry) ? toDeletedEntry(entry, now) : entry
    )
    await db.nutritionLogs.update(date, { entries: nextEntries })
  })
}

type MealEntryUpdateInput = Partial<
  Pick<
    NutritionMealEntry,
    "foodId" | "quantity" | "mealType" | "templateId" | "templateInstanceId" | "templateName"
  >
>

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
      const entry: NutritionMealEntry = {
        id: crypto.randomUUID(),
        foodId,
        quantity,
        mealType,
        updatedAt: Date.now(),
      }
      
      await db.transaction("rw", NUTRITION_LOG_AND_FOODS_SYNC_WRITE_TABLES, async () => {
        const food = await db.foods.get(foodId)
        if (!food) {
          throw new Error("Selected food does not exist")
        }

        const existing = await db.nutritionLogs.get(date)

        if (existing) {
          await db.nutritionLogs.update(date, {
            entries: [...existing.entries, entry],
          })
        } else {
          await db.nutritionLogs.add({ date, entries: [entry] })
        }

        await updateFoodUsageCount(foodId, 1)
      })

      await achievementService.runNutritionSideEffects()
      
      return entry
    },
    onSuccess: (_, { date }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.nutrition.daily(date) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.nutrition.dates() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to add food entry")
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
      updates: MealEntryUpdateInput
    }) => {
      await db.transaction("rw", NUTRITION_LOG_AND_FOODS_SYNC_WRITE_TABLES, async () => {
        const existing = await db.nutritionLogs.get(date)
        if (!existing) throw new Error("Log not found")

        const previousEntry = existing.entries.find((e) => e.id === entryId)
        if (!previousEntry) throw new Error("Entry not found")
        if (isEntryDeleted(previousEntry)) throw new Error("Entry has been deleted")

        const nextFoodId = updates.foodId ?? previousEntry.foodId

        // If the foodId changes, keep usageCount consistent for safe deletion checks.
        if (updates.foodId && updates.foodId !== previousEntry.foodId) {
          const newFood = await db.foods.get(nextFoodId)

          if (!newFood) {
            throw new Error("Selected food does not exist")
          }
          await updateFoodUsageCount(previousEntry.foodId, -1)
          await updateFoodUsageCount(nextFoodId, 1)
        }

        const now = Date.now()
        const updatedEntries = existing.entries.map((e) =>
          e.id === entryId
            ? stampEntryUpdatedAt(
                {
                  ...e,
                  ...updates,
                },
                now
              )
            : e
        )

        await db.nutritionLogs.update(date, { entries: updatedEntries })
      })

      await achievementService.runNutritionSideEffects()
    },
    onSuccess: (_, { date }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.nutrition.daily(date) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.nutrition.dates() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
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
      await removeEntriesFromLog(date, (e) => e.id === entryId)

      await achievementService.runNutritionSideEffects()
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

        const updatedLog = previous.log
          ? {
              ...previous.log,
              entries: previous.log.entries.map((entry) =>
                entry.id === entryId && !isEntryDeleted(entry)
                  ? toDeletedEntry(entry, Date.now())
                  : entry
              ),
            }
          : null

        const activeLogEntries = updatedLog ? getActiveEntries(updatedLog.entries) : []

        queryClient.setQueryData(queryKeys.nutrition.daily(date), {
          ...previous,
          log: updatedLog && activeLogEntries.length > 0 ? updatedLog : null,
          entriesWithFood: updatedEntriesWithFood,
          totals: updatedEntriesWithFood.length > 0 ? updatedTotals : INITIAL_TOTALS,
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.nutrition.dates() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
    }
  })
}

export function useAddFood() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (food: Omit<FoodItem, "id"> & { id?: string }) => {
      const id = food.id ?? crypto.randomUUID()
      const newFood: FoodItem = { ...food, id, isCustom: food.isCustom ?? true, usageCount: food.usageCount ?? 0 }
      // Upsert to avoid duplicates when the ID is canonical (e.g. barcode IDs).
      await db.transaction("rw", FOODS_SYNC_WRITE_TABLES, async () => {
        await db.foods.put(newFood)
      })
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
      await db.transaction("rw", FOODS_SYNC_WRITE_TABLES, async () => {
        const food = await db.foods.get(id)
        if (!food) return // Already deleted?

        if ((food.usageCount ?? 0) > 0) {
          throw new Error("Cannot delete food that is used in meal entries. Remove the entries first.")
        }

        await db.foods.delete(id)
      })
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
        await db.transaction("rw", FOODS_SYNC_WRITE_TABLES, async () => {
          await db.foods.update(id, { isFavorite })
        })
      } else if (food) {
        // If food doesn't exist locally (e.g. from search), upsert it.
        await db.transaction("rw", FOODS_SYNC_WRITE_TABLES, async () => {
          await db.foods.put({ ...food, isFavorite, isCustom: food.isCustom ?? false, usageCount: food.usageCount ?? 0 })
        })
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
    mutationFn: async ({ name, entries }: { name: string; entries: MealTemplateEntry[] }) => {
      const id = crypto.randomUUID()
      await db.transaction("rw", MEAL_TEMPLATES_SYNC_WRITE_TABLES, async () => {
        await db.mealTemplates.add({ id, name, entries })
      })
      return id
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.foods.mealTemplates() })
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
    mutationFn: async ({ id, name, entries }: { id: string; name: string; entries: MealTemplateEntry[] }) => {
      await db.transaction("rw", MEAL_TEMPLATES_SYNC_WRITE_TABLES, async () => {
        await db.mealTemplates.update(id, { name, entries })
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.foods.mealTemplates() })
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
      await db.transaction("rw", MEAL_TEMPLATES_SYNC_WRITE_TABLES, async () => {
        await db.mealTemplates.delete(id)
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.foods.mealTemplates() })
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

      const now = Date.now()
      const newEntries: NutritionMealEntry[] = template.entries.map(e => ({
        ...e,
        id: crypto.randomUUID(),
        mealType, // Override with current meal type
        templateId: template.id,
        templateInstanceId: instanceId,
        templateName: template.name,
        updatedAt: now,
      }))
      
      await db.transaction("rw", NUTRITION_LOG_AND_FOODS_SYNC_WRITE_TABLES, async () => {
        const existing = await db.nutritionLogs.get(date)
        if (existing) {
          await db.nutritionLogs.update(date, {
            entries: [...existing.entries, ...newEntries],
          })
        } else {
          await db.nutritionLogs.add({ date, entries: newEntries })
        }

        // Increment usage counts
        const foodCounts = new Map<string, number>()
        newEntries.forEach(e => {
          foodCounts.set(e.foodId, (foodCounts.get(e.foodId) || 0) + 1)
        })

        await Promise.all(
          Array.from(foodCounts).map(async ([foodId, count]) => {
            const food = await db.foods.get(foodId)
            if (food) {
              await updateFoodUsageCount(foodId, count)
            }
          })
        )
      })

      await achievementService.runNutritionSideEffects()
    },
    onSuccess: (_, { date }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.nutrition.daily(date) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.nutrition.dates() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
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
      await removeEntriesFromLog(date, (e) => e.templateInstanceId === templateInstanceId)

      await achievementService.runNutritionSideEffects()
    },
    onSuccess: (_, { date }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.nutrition.daily(date) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.nutrition.dates() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
    },
    onError: () => {
      toast.error("Failed to remove template group")
    }
  })
}
