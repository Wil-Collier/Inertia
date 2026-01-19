import { useQuery } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { UserSettings } from "@/lib/types"

const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  unitPreferences: { weight: "kg", distance: "km" },
  restTimerDuration: 90,
  nutritionGoals: { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 },
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
