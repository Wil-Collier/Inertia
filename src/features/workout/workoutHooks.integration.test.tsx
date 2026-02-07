import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MockInstance } from "vitest"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"
import { db } from "@/services/db"
import { useCreateWorkout, useDeleteWorkout } from "@/features/workout/mutations"
import { queryKeys } from "@/lib/queryKeys"
import { achievementService } from "@/services/achievementService"
import { statsService } from "@/services/statsService"
import type { UserStats, Workout } from "@/lib/types"

let updateStreaksSpy: MockInstance<() => Promise<void>>
let addWorkoutSpy: MockInstance<(workout: Workout) => Promise<UserStats>>
let removeWorkoutSpy: MockInstance<(workout: Workout) => Promise<UserStats>>

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe("workout hooks integration", () => {
  beforeEach(async () => {
    await clearDatabase()
    vi.restoreAllMocks()
    updateStreaksSpy = vi.spyOn(achievementService, "updateStreaks").mockResolvedValue()
    vi.spyOn(achievementService, "checkWorkoutAchievements").mockResolvedValue()
    addWorkoutSpy = vi.spyOn(statsService, "addWorkout").mockResolvedValue({
      totalWorkouts: 1,
      totalVolumeLbs: 1000,
      lastUpdated: new Date().toISOString(),
    })
    removeWorkoutSpy = vi.spyOn(statsService, "removeWorkout").mockResolvedValue({
      totalWorkouts: 0,
      totalVolumeLbs: 0,
      lastUpdated: new Date().toISOString(),
    })
  })

  it("creates workout with exerciseIds and updates query cache", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    const { result } = renderHook(() => useCreateWorkout(), { wrapper })

    let createdId = ""
    await act(async () => {
      const created = await result.current.mutateAsync({
        name: "Push Day",
        date: "2026-02-08",
        weightUnit: "kg",
        exercises: [
          {
            id: "wex-1",
            exerciseId: "bench",
            sets: [{ id: "set-1", reps: 5, weight: 100, isCompleted: true }],
          },
        ],
      })
      createdId = created.id
    })

    const saved = await db.workoutSessions.get(createdId)
    expect(saved?.exerciseIds).toEqual(["bench"])
    expect(queryClient.getQueryData(queryKeys.workouts.detail(createdId))).toMatchObject({ id: createdId })
    expect(addWorkoutSpy).toHaveBeenCalled()
    expect(updateStreaksSpy).toHaveBeenCalled()
  })

  it("deletes workouts and triggers stats + achievement side effects", async () => {
    await db.workoutSessions.put({
      id: "workout-1",
      name: "Delete",
      date: "2026-02-08",
      weightUnit: "kg",
      exercises: [],
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue()

    const { result } = renderHook(() => useDeleteWorkout(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync("workout-1")
    })

    expect(await db.workoutSessions.get("workout-1")).toBeUndefined()
    expect(removeWorkoutSpy).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workouts.all })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.achievements.all })
  })
})
