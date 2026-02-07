import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"
import { db } from "@/services/db"
import {
  useExerciseHistory,
  useWorkout,
  useWorkoutDates,
  useWorkoutsByExercise,
} from "@/features/workout/queries"

describe("workout query hooks integration", () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  it("returns an error when requested workout does not exist", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    const { result } = renderHook(() => useWorkout("missing-id"), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    if (!(result.current.error instanceof Error)) {
      throw new TypeError("Expected error object")
    }
    expect(result.current.error.message).toBe("Workout missing-id not found")
  })

  it("returns workouts by exercise sorted newest first", async () => {
    await db.workoutSessions.bulkPut([
      {
        id: "w-old",
        name: "Old",
        date: "2026-02-01",
        weightUnit: "kg",
        exerciseIds: ["bench"],
        exercises: [{ id: "e1", exerciseId: "bench", sets: [] }],
      },
      {
        id: "w-new",
        name: "New",
        date: "2026-02-10",
        weightUnit: "kg",
        exerciseIds: ["bench"],
        exercises: [{ id: "e2", exerciseId: "bench", sets: [] }],
      },
      {
        id: "w-other",
        name: "Other",
        date: "2026-02-11",
        weightUnit: "kg",
        exerciseIds: ["squat"],
        exercises: [{ id: "e3", exerciseId: "squat", sets: [] }],
      },
    ])

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    const { result } = renderHook(() => useWorkoutsByExercise("bench"), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.map((workout) => workout.id)).toEqual(["w-new", "w-old"])
  })

  it("deduplicates workout dates from index keys", async () => {
    await db.workoutSessions.bulkPut([
      {
        id: "w1",
        name: "A",
        date: "2026-02-08",
        weightUnit: "kg",
        exercises: [],
      },
      {
        id: "w2",
        name: "B",
        date: "2026-02-08",
        weightUnit: "kg",
        exercises: [],
      },
      {
        id: "w3",
        name: "C",
        date: "2026-02-09",
        weightUnit: "kg",
        exercises: [],
      },
    ])

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    const { result } = renderHook(() => useWorkoutDates(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(["2026-02-08", "2026-02-09"])
  })

  it("builds exercise history from completed sets only", async () => {
    await db.workoutSessions.bulkPut([
      {
        id: "w1",
        name: "Bench Session 1",
        date: "2026-02-01",
        weightUnit: "kg",
        exerciseIds: ["bench"],
        exercises: [
          {
            id: "ex1",
            exerciseId: "bench",
            sets: [
              { id: "s1", reps: 5, weight: 100, isCompleted: true },
              { id: "s2", reps: 5, weight: 105, isCompleted: true },
              { id: "s3", reps: 8, weight: 80, isCompleted: false },
            ],
          },
        ],
      },
      {
        id: "w2",
        name: "Bench Session 2",
        date: "2026-02-02",
        weightUnit: "kg",
        exerciseIds: ["bench"],
        exercises: [
          {
            id: "ex2",
            exerciseId: "bench",
            sets: [
              { id: "s4", reps: 3, weight: 110, isCompleted: true },
              { id: "s5", reps: 10, weight: 60, isCompleted: false },
            ],
          },
        ],
      },
      {
        id: "w3",
        name: "No completed sets",
        date: "2026-02-03",
        weightUnit: "kg",
        exerciseIds: ["bench"],
        exercises: [
          {
            id: "ex3",
            exerciseId: "bench",
            sets: [{ id: "s6", reps: 5, weight: 100, isCompleted: false }],
          },
        ],
      },
    ])

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    const { result } = renderHook(() => useExerciseHistory("bench"), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.map((row) => row.workoutId)).toEqual(["w1", "w2"])

    expect(result.current.data?.[0]).toMatchObject({
      workoutId: "w1",
      maxWeight: 105,
      totalReps: 10,
      totalVolume: 1025,
    })

    expect(result.current.data?.[1]).toMatchObject({
      workoutId: "w2",
      maxWeight: 110,
      totalReps: 3,
      totalVolume: 330,
    })
  })
})
