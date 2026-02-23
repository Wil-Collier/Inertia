import { useQuery } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { UserSettings } from "@/lib/types"
import { 
  DEFAULT_THEME, 
  DEFAULT_UNIT_PREFERENCES, 
  DEFAULT_REST_TIMER_DURATION, 
  DEFAULT_PROGRESSIVE_OVERLOAD_ENABLED,
  DEFAULT_NUTRITION_GOALS 
} from "@/lib/constants"

const DEFAULT_SETTINGS: UserSettings = {
  theme: DEFAULT_THEME,
  unitPreferences: DEFAULT_UNIT_PREFERENCES,
  restTimerDuration: DEFAULT_REST_TIMER_DURATION,
  progressiveOverloadEnabled: DEFAULT_PROGRESSIVE_OVERLOAD_ENABLED,
  nutritionGoals: DEFAULT_NUTRITION_GOALS,
  areNotificationsEnabled: false,
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async (): Promise<UserSettings> => {
      const settings = await db.settings.get("settings")
      if (!settings) return DEFAULT_SETTINGS

      return {
        ...DEFAULT_SETTINGS,
        ...settings,
        unitPreferences: {
          ...DEFAULT_SETTINGS.unitPreferences,
          ...settings.unitPreferences,
        },
        nutritionGoals: {
          ...DEFAULT_SETTINGS.nutritionGoals,
          ...settings.nutritionGoals,
        },
      }
    },
  })
}
