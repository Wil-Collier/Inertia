import { useQuery } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { UserSettings } from "@/lib/types"
import { 
  DEFAULT_THEME, 
  DEFAULT_UNIT_PREFERENCES, 
  DEFAULT_REST_TIMER_DURATION, 
  DEFAULT_NUTRITION_GOALS 
} from "@/lib/constants"

const DEFAULT_SETTINGS: UserSettings = {
  theme: DEFAULT_THEME,
  unitPreferences: DEFAULT_UNIT_PREFERENCES,
  restTimerDuration: DEFAULT_REST_TIMER_DURATION,
  nutritionGoals: DEFAULT_NUTRITION_GOALS,
  areNotificationsEnabled: false,
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async (): Promise<UserSettings> => {
      const settings = await db.settings.get("settings")
      return settings ?? DEFAULT_SETTINGS
    },
  })
}
