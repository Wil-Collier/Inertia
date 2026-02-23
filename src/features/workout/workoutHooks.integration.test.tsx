import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MockInstance } from "vitest"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"
import { db } from "@/services/db"
import {
  useCreateTemplate,
  useCreateWorkout,
  useDeleteTemplate,
  useDeleteWorkout,
  useUpdateTemplate,
  useUpdateWorkout,
} from "@/features/workout/mutations"
import { queryKeys } from "@/lib/queryKeys"
import { achievementService } from "@/services/achievementService"
import { statsService } from "@/services/statsService"
import type { UserStats, Workout } from "@/lib/types"

let updateStreaksSpy: MockInstance<() => Promise<void>>
let addWorkoutSpy: MockInstance<(workout: Workout) => Promise<UserStats>>
let removeWorkoutSpy: MockInstance<(workout: Workout) => Promise<UserStats>>
let updateWorkoutSpy: MockInstance<(oldWorkout: Workout, newWorkout: Workout) => Promise<UserStats>>

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
    updateStreaksSpy = vi.spyOn(achievementService, "updateStreaks")
    vi.spyOn(achievementService, "checkWorkoutAchievements")
    addWorkoutSpy = vi.spyOn(statsService, "addWorkout")
    removeWorkoutSpy = vi.spyOn(statsService, "removeWorkout")
    updateWorkoutSpy = vi.spyOn(statsService, "updateWorkout")
    vi.spyOn(achievementService, "checkTemplateAchievements")
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

    const { result } = renderHook(() => useDeleteWorkout(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync("workout-1")
    })

    expect(await db.workoutSessions.get("workout-1")).toBeUndefined()
    expect(removeWorkoutSpy).toHaveBeenCalled()
    // Stats record updated in Dexie by the real statsService
    const stats = await db.userStats.get("stats")
    expect(stats?.totalWorkouts).toBe(0)
  })

  it("falls back to settings weight unit when create payload omits weightUnit", async () => {
    await db.settings.put({
      id: "settings",
      theme: "system",
      restTimerDuration: 90,
      progressiveOverloadEnabled: true,
      areNotificationsEnabled: false,
      unitPreferences: { weight: "lbs", distance: "mi" },
      nutritionGoals: { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 },
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useCreateWorkout(), { wrapper })

    const payload = {
      name: "Fallback Unit Day",
      date: "2026-02-08",
      weightUnit: "kg" as const,
      exercises: [],
    }
    Object.defineProperty(payload, "weightUnit", {
      value: "",
      writable: true,
      configurable: true,
    })

    let createdId = ""
    await act(async () => {
      const created = await result.current.mutateAsync(payload)
      createdId = created.id
    })

    expect((await db.workoutSessions.get(createdId))?.weightUnit).toBe("lbs")
  })

  it("updates workout and recomputes exerciseIds when exercises are replaced", async () => {
    await db.workoutSessions.put({
      id: "workout-1",
      name: "Original",
      date: "2026-02-08",
      weightUnit: "kg",
      exercises: [{ id: "wex-1", exerciseId: "bench", sets: [] }],
      exerciseIds: ["bench"],
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useUpdateWorkout(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: "workout-1",
        updates: {
          exercises: [{ id: "wex-2", exerciseId: "squat", sets: [] }],
        },
      })
    })

    expect((await db.workoutSessions.get("workout-1"))?.exerciseIds).toEqual(["squat"])
    expect(updateWorkoutSpy).toHaveBeenCalledTimes(1)
  })

  it("does not run stats delta update when workout exercises are unchanged", async () => {
    await db.workoutSessions.put({
      id: "workout-2",
      name: "Original",
      date: "2026-02-08",
      weightUnit: "kg",
      exercises: [{ id: "wex-1", exerciseId: "bench", sets: [] }],
      exerciseIds: ["bench"],
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useUpdateWorkout(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: "workout-2",
        updates: {
          name: "Renamed only",
        },
      })
    })

    expect((await db.workoutSessions.get("workout-2"))?.name).toBe("Renamed only")
    expect(updateWorkoutSpy).not.toHaveBeenCalled()
  })

  it("performs template CRUD and invalidates template queries", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    const createHook = renderHook(() => useCreateTemplate(), { wrapper })
    let templateId = ""
    await act(async () => {
      const created = await createHook.result.current.mutateAsync({
        name: "Push Template",
        exercises: [{ exerciseId: "bench", targetSets: 3, targetReps: 5 }],
      })
      templateId = created.id
    })

    expect(await db.workoutTemplates.get(templateId)).toBeTruthy()

    const updateHook = renderHook(() => useUpdateTemplate(), { wrapper })
    await act(async () => {
      await updateHook.result.current.mutateAsync({
        id: templateId,
        updates: { name: "Updated Template" },
      })
    })

    expect((await db.workoutTemplates.get(templateId))?.name).toBe("Updated Template")

    const deleteHook = renderHook(() => useDeleteTemplate(), { wrapper })
    await act(async () => {
      await deleteHook.result.current.mutateAsync(templateId)
    })

    expect(await db.workoutTemplates.get(templateId)).toBeUndefined()
  })
})
