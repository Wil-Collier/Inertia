import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/queryKeys"
import { achievementService } from "@/services/achievementService"

export function useUnlockAchievement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => await achievementService.unlockAchievement(id, { showToast: true }),
    onSuccess: (result) => {
      if (result?.isNew) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
      }
    },
    onError: (error) => {
      console.error("Failed to unlock achievement:", error)
    },
  })
}
