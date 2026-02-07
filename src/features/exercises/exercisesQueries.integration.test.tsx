import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"
import {
  useExercise,
  useExercisesByIds,
  useExercisesByMuscle,
} from "@/features/exercises/queries"
import { exerciseDatabase, getDefaultExercisesByMuscle } from "@/data/exerciseDatabase"

describe("exercise queries integration", () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  it("returns built-in exercise data without instructions", async () => {
    const builtIn = exerciseDatabase[0]
    if (!builtIn) throw new Error("expected built-in exercise")

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useExercise(builtIn.id), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.id).toBe(builtIn.id)
    expect("instructions" in (result.current.data ?? {})).toBe(false)
  })

  it("falls back to custom exercise when id is not a built-in", async () => {
    await db.customExercises.put({
      id: "custom-1",
      name: "Custom Press",
      muscleGroup: "shoulders",
      isCustom: true,
      isWeighted: true,
      isTimeBased: false,
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useExercise("custom-1"), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toMatchObject({
      id: "custom-1",
      name: "Custom Press",
      muscleGroup: "shoulders",
      isCustom: true,
    })
  })

  it("surfaces an error for unknown exercise ids", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useExercise("does-not-exist"), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    if (!(result.current.error instanceof Error)) {
      throw new TypeError("Expected Error")
    }
    expect(result.current.error.message).toBe("Exercise does-not-exist not found")
  })

  it("merges built-in and custom exercises for id lookups and omits unknown ids", async () => {
    const builtIn = exerciseDatabase[0]
    if (!builtIn) throw new Error("expected built-in exercise")

    await db.customExercises.put({
      id: "custom-lookup",
      name: "Lookup Row",
      muscleGroup: "back",
      isCustom: true,
      isWeighted: true,
      isTimeBased: false,
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(
      () => useExercisesByIds([builtIn.id, "custom-lookup", "missing-id"]),
      { wrapper }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    const map = result.current.data
    expect(map?.size).toBe(2)
    expect(map?.get(builtIn.id)?.id).toBe(builtIn.id)
    expect(map?.get("custom-lookup")?.name).toBe("Lookup Row")
    expect(map?.has("missing-id")).toBe(false)
  })

  it("returns empty results for invalid muscle filters", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useExercisesByMuscle("invalid-muscle"), { wrapper })

    expect(result.current.fetchStatus).toBe("idle")

    await act(async () => {
      const refetched = await result.current.refetch()
      expect(refetched.data).toEqual([])
    })
  })

  it("returns merged built-in and custom exercises for valid muscle filters", async () => {
    const defaultChest = getDefaultExercisesByMuscle("chest")[0]
    if (!defaultChest) throw new Error("expected default chest exercise")

    await db.customExercises.put({
      id: "custom-chest",
      name: "Custom Fly",
      muscleGroup: "chest",
      isCustom: true,
      isWeighted: false,
      isTimeBased: false,
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useExercisesByMuscle("chest"), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    const ids = result.current.data?.map((exercise) => exercise.id) ?? []
    expect(ids).toContain(defaultChest.id)
    expect(ids).toContain("custom-chest")
  })
})
