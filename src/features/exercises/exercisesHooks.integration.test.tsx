import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"
import { useAddExercise, useDeleteExercise, useUpdateExercise } from "@/features/exercises/mutations"
import { exerciseDatabase } from "@/data/exerciseDatabase"

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
    const builtInExerciseId = exerciseDatabase[0]?.id
    if (!builtInExerciseId) throw new Error("expected built-in exercise fixture")

    await act(async () => {
      await expect(result.current.mutateAsync(builtInExerciseId)).rejects.toThrow("Cannot delete built-in exercises")
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

  it("deletes custom exercises and their personal records when not referenced", async () => {
    await db.customExercises.put({
      id: "custom-2",
      name: "Custom Curl",
      muscleGroup: "arms",
      isCustom: true,
      isWeighted: true,
      isTimeBased: false,
    })
    await db.personalRecords.put({
      exerciseId: "custom-2",
      weight: 80,
      reps: 8,
      date: "2026-02-01",
      workoutId: "w-1",
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useDeleteExercise(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync("custom-2")
    })

    expect(await db.customExercises.get("custom-2")).toBeUndefined()
    expect(await db.personalRecords.get("custom-2")).toBeUndefined()
  })

  it("updates custom exercise fields", async () => {
    await db.customExercises.put({
      id: "custom-3",
      name: "Old Name",
      muscleGroup: "back",
      isCustom: true,
      isWeighted: true,
      isTimeBased: false,
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useUpdateExercise(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: "custom-3",
        updates: { name: "Updated Name", description: "Updated description" },
      })
    })

    expect(await db.customExercises.get("custom-3")).toMatchObject({
      name: "Updated Name",
      description: "Updated description",
    })
  })
})
