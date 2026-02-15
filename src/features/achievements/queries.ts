import { useQuery } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import { DEFAULT_STREAKS } from "@/services/achievementService"

export function useAchievements() {
  return useQuery({
    queryKey: queryKeys.achievements.all,
    queryFn: async () => {
      const data = await db.achievements.get("achievements")
      return data ?? {
        id: "achievements",
        unlockedAchievements: [],
        streaks: DEFAULT_STREAKS,
      }
    },
  })
}
