import { useMutation, useQueryClient } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { UserSettings, ThemeMode } from "@/lib/types"

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (updates: Partial<UserSettings>) => {
      const existing = await db.settings.get("settings")
      
      const defaultUnitPreferences: UserSettings["unitPreferences"] = { weight: "kg", distance: "km" }
      const defaultNutritionGoals: UserSettings["nutritionGoals"] = { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 }

      const newSettings: UserSettings & { id: string } = { 
        theme: existing?.theme ?? ("system" as ThemeMode),
        restTimerDuration: existing?.restTimerDuration ?? 90,
        areNotificationsEnabled: existing?.areNotificationsEnabled ?? false,
        ...updates,
        unitPreferences: {
          ...(existing?.unitPreferences || defaultUnitPreferences),
          ...(updates.unitPreferences || {})
        },
        nutritionGoals: {
          ...(existing?.nutritionGoals || defaultNutritionGoals),
          ...(updates.nutritionGoals || {})
        },
        id: "settings" 
      }
      await db.settings.put(newSettings)
      return newSettings
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings.all })
      const previous = queryClient.getQueryData<UserSettings>(queryKeys.settings.all)
      
      if (previous) {
        queryClient.setQueryData(queryKeys.settings.all, { ...previous, ...updates })
      }
      
      return { previous }
    },
    onError: (_error, _updates, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.settings.all, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all })
    }
  })
}
