import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useActiveSession, useActiveSessionActions } from "@/features/workout/hooks/useActiveSession"
import { queryKeys } from "@/lib/queryKeys"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"

const { activeSessionServiceMock } = vi.hoisted(() => ({
  activeSessionServiceMock: {
    getSession: vi.fn(),
    startWorkout: vi.fn(),
    finishWorkout: vi.fn(),
    cancelWorkout: vi.fn(),
    updateWorkoutName: vi.fn(),
    addExercise: vi.fn(),
    removeExercise: vi.fn(),
    reorderExercises: vi.fn(),
    updateExerciseNotes: vi.fn(),
    addSet: vi.fn(),
    updateSet: vi.fn(),
    removeSet: vi.fn(),
    toggleSetComplete: vi.fn(),
  },
}))

vi.mock("@/features/workout/services/activeSessionService", () => ({
  activeSessionService: activeSessionServiceMock,
}))

describe("useActiveSession hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    activeSessionServiceMock.getSession.mockResolvedValue({
      id: "current",
      workout: {
        id: "w1",
        name: "Push",
        date: "2026-02-07",
        weightUnit: "kg",
        exercises: [],
      },
      startedAt: "2026-02-07T00:00:00.000Z",
    })
    activeSessionServiceMock.startWorkout.mockResolvedValue(undefined)
    activeSessionServiceMock.finishWorkout.mockResolvedValue(undefined)
    activeSessionServiceMock.cancelWorkout.mockResolvedValue(undefined)
    activeSessionServiceMock.updateWorkoutName.mockResolvedValue(undefined)
    activeSessionServiceMock.addExercise.mockResolvedValue(undefined)
    activeSessionServiceMock.removeExercise.mockResolvedValue(undefined)
    activeSessionServiceMock.reorderExercises.mockResolvedValue(undefined)
    activeSessionServiceMock.updateExerciseNotes.mockResolvedValue(undefined)
    activeSessionServiceMock.addSet.mockResolvedValue(undefined)
    activeSessionServiceMock.updateSet.mockResolvedValue(undefined)
    activeSessionServiceMock.removeSet.mockResolvedValue(undefined)
    activeSessionServiceMock.toggleSetComplete.mockResolvedValue(undefined)
  })

  it("returns the current active session from query data", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useActiveSession(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.workout.name).toBe("Push")
  })

  it("invalidates active-session query after mutation actions", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue()
    const { result } = renderHook(() => useActiveSessionActions(), { wrapper })

    await act(async () => {
      await result.current.startWorkout({ name: "Leg Day", exercises: [] })
      await result.current.cancelWorkout()
      await result.current.updateWorkoutName("Renamed")
      await result.current.addExercise("bench")
      await result.current.removeExercise("wex-1")
      await result.current.reorderExercises(["wex-2", "wex-1"])
      await result.current.updateExerciseNotes({ workoutExerciseId: "wex-1", notes: "keep elbows tucked" })
      await result.current.addSet("wex-1")
      await result.current.updateSet({
        workoutExerciseId: "wex-1",
        setId: "set-1",
        updates: { reps: 8, weight: 80 },
      })
      await result.current.removeSet({ workoutExerciseId: "wex-1", setId: "set-1" })
      await result.current.toggleSetComplete({ workoutExerciseId: "wex-1", setId: "set-2" })
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.activeSession.current })
    expect(activeSessionServiceMock.startWorkout).toHaveBeenCalledWith("Leg Day", undefined, [])
  })

  it("invalidates both active-session and workout-list data after finishing workout", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue()
    const { result } = renderHook(() => useActiveSessionActions(), { wrapper })

    await act(async () => {
      await result.current.finishWorkout()
    })

    expect(activeSessionServiceMock.finishWorkout).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.activeSession.current })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workouts.all })
  })
})
