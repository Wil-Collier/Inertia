import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"
import { useSettings } from "@/features/settings/queries"
import { useUpdateSettings } from "@/features/settings/mutations"
import { queryKeys } from "@/lib/queryKeys"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe("settings hooks integration", () => {
  beforeEach(async () => {
    await clearDatabase()
    vi.restoreAllMocks()
  })

  it("returns default settings when none are persisted", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    const { result } = renderHook(() => useSettings(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toMatchObject({
      theme: "system",
      restTimerDuration: 90,
      areNotificationsEnabled: false,
      unitPreferences: { weight: "kg", distance: "km" },
    })
  })

  it("merges partial updates with existing nested settings", async () => {
    await db.settings.put({
      id: "settings",
      theme: "dark",
      restTimerDuration: 75,
      areNotificationsEnabled: false,
      unitPreferences: { weight: "lbs", distance: "mi" },
      nutritionGoals: { calories: 2500, protein: 170, carbs: 300, fat: 80, fiber: 35, sugar: 60 },
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue()

    const { result } = renderHook(() => useUpdateSettings(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        nutritionGoals: { protein: 200 },
        unitPreferences: { weight: "kg" },
      })
    })

    const saved = await db.settings.get("settings")
    expect(saved).toMatchObject({
      unitPreferences: { weight: "kg", distance: "mi" },
      nutritionGoals: { calories: 2500, protein: 200, carbs: 300, fat: 80, fiber: 35, sugar: 60 },
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.settings.all })
  })

  it("rolls back optimistic cache update when mutation fails", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    const previous = {
      theme: "dark",
      restTimerDuration: 75,
      areNotificationsEnabled: false,
      unitPreferences: { weight: "lbs", distance: "mi" },
      nutritionGoals: { calories: 2500, protein: 170, carbs: 300, fat: 80, fiber: 35, sugar: 60 },
    }

    queryClient.setQueryData(queryKeys.settings.all, previous)

    const transactionSpy = vi.spyOn(db, "transaction").mockRejectedValueOnce(new Error("write failed"))

    const { result } = renderHook(() => useUpdateSettings(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync({ theme: "light" })).rejects.toThrow("write failed")
    })

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.settings.all)).toEqual(previous)
    })

    transactionSpy.mockRestore()
  })
})
