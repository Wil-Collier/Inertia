import { useMutation, useQueryClient } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { UserSettings, ThemeMode } from "@/lib/types"
import { 
  DEFAULT_THEME, 
  DEFAULT_UNIT_PREFERENCES, 
  DEFAULT_REST_TIMER_DURATION, 
  DEFAULT_NUTRITION_GOALS 
} from "@/lib/constants"

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (updates: Partial<UserSettings>) => {
      return await db.transaction("rw", [db.settings, db.metadata], async () => {
        const existing = await db.settings.get("settings")

        const newSettings: UserSettings & { id: string } = { 
          theme: existing?.theme ?? (DEFAULT_THEME as ThemeMode),
          restTimerDuration: existing?.restTimerDuration ?? DEFAULT_REST_TIMER_DURATION,
          areNotificationsEnabled: existing?.areNotificationsEnabled ?? false,
          ...updates,
          unitPreferences: {
            ...(existing?.unitPreferences || DEFAULT_UNIT_PREFERENCES),
            ...updates.unitPreferences
          },
          nutritionGoals: {
            ...(existing?.nutritionGoals || DEFAULT_NUTRITION_GOALS),
            ...updates.nutritionGoals
          },
          id: "settings" 
        }
        await db.settings.put(newSettings)
        return newSettings
      })
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.all })
    }
  })
}
