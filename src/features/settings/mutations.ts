import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { UserSettings, ThemeMode } from "@/lib/types"
import { 
  DEFAULT_THEME, 
  DEFAULT_UNIT_PREFERENCES, 
  DEFAULT_REST_TIMER_DURATION, 
  DEFAULT_NUTRITION_GOALS 
} from "@/lib/constants"

type UserSettingsUpdate = Partial<Omit<UserSettings, "unitPreferences" | "nutritionGoals">> & {
  unitPreferences?: Partial<UserSettings["unitPreferences"]>
  nutritionGoals?: Partial<UserSettings["nutritionGoals"]>
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (updates: UserSettingsUpdate) => {
      return await db.transaction("rw", [db.settings, db.syncPendingChanges, db.syncRecordVersions], async () => {
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
        queryClient.setQueryData(queryKeys.settings.all, {
          ...previous,
          ...updates,
          unitPreferences: { ...previous.unitPreferences, ...updates.unitPreferences },
          nutritionGoals: { ...previous.nutritionGoals, ...updates.nutritionGoals },
        })
      }
      
      return { previous }
    },
    onError: (_error, _updates, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.settings.all, context.previous)
      }
      toast.error("Failed to update settings")
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.all })
    }
  })
}
