import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"
import { useAddExercise, useDeleteExercise } from "@/features/exercises/mutations"

const toastError = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => toastError(...args),
    info: vi.fn(),
  },
}))

describe("exercise hooks integration", () => {
  beforeEach(async () => {
    await clearDatabase()
    vi.restoreAllMocks()
    toastError.mockReset()
  })

  it("creates custom exercises with generated metadata", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    const { result } = renderHook(() => useAddExercise(), { wrapper })

    let createdId = ""
    await act(async () => {
      const exercise = await result.current.mutateAsync({
        name: "Custom Pull-Up",
        muscleGroup: "back",
        isWeighted: true,
        isTimeBased: false,
      })
      createdId = exercise.id
    })

    const created = await db.customExercises.get(createdId)
    expect(created).toMatchObject({
      name: "Custom Pull-Up",
      isCustom: true,
      muscleGroup: "back",
      isWeighted: true,
      isTimeBased: false,
    })
    expect(typeof created?.createdAt).toBe("string")
  })

  it("blocks deletion of built-in default exercises", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    const { result } = renderHook(() => useDeleteExercise(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync("ex-0-3-4-sit-up")).rejects.toThrow("Cannot delete built-in exercises")
    })

    expect(toastError).toHaveBeenCalled()
  })

  it("blocks deletion when exercise is used in templates", async () => {
    await db.customExercises.put({
      id: "custom-1",
      name: "Custom",
      muscleGroup: "arms",
      isCustom: true,
      isWeighted: true,
      isTimeBased: false,
    })

    await db.workoutTemplates.put({
      id: "template-1",
      name: "Arms",
      exercises: [{ exerciseId: "custom-1", targetSets: 3 }],
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useDeleteExercise(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync("custom-1")).rejects.toThrow("Cannot delete: exercise is used in template \"Arms\"")
    })

    expect(await db.customExercises.get("custom-1")).toBeTruthy()
  })
})
