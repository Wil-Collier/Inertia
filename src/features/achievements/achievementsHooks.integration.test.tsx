import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"
import { useAchievements } from "@/features/achievements/queries"
import { useUnlockAchievement } from "@/features/achievements/mutations"

const toastSuccessMock = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}))

describe("achievement hooks integration", () => {
  beforeEach(async () => {
    await clearDatabase()
    vi.clearAllMocks()
  })

  it("returns default achievement state when nothing is stored", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useAchievements(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toMatchObject({
      id: "achievements",
      unlockedAchievements: [],
      streaks: {
        currentWorkoutStreak: 0,
        longestWorkoutStreak: 0,
        currentNutritionStreak: 0,
        longestNutritionStreak: 0,
      },
    })
  })

  it("reads stored achievement state", async () => {
    await db.achievements.put({
      id: "achievements",
      unlockedAchievements: [{ id: "first-workout", unlockedAt: "2026-02-07T00:00:00.000Z" }],
      streaks: {
        currentWorkoutStreak: 3,
        longestWorkoutStreak: 5,
        lastWorkoutDate: "2026-02-07",
        currentNutritionStreak: 2,
        longestNutritionStreak: 4,
        lastNutritionDate: "2026-02-07",
      },
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useAchievements(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.streaks.currentWorkoutStreak).toBe(3)
    expect(result.current.data?.unlockedAchievements).toHaveLength(1)
  })

  it("unlocks known achievements once and ignores duplicates/unknown ids", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useUnlockAchievement(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync("first-workout")
      await result.current.mutateAsync("first-workout")
      await result.current.mutateAsync("missing-achievement")
    })

    const saved = await db.achievements.get("achievements")
    expect(saved?.unlockedAchievements).toHaveLength(1)
    expect(saved?.unlockedAchievements[0]?.id).toBe("first-workout")
    expect(toastSuccessMock).toHaveBeenCalledTimes(1)
  })
})
