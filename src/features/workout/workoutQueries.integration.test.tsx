import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"
import { db } from "@/services/db"
import {
  useExerciseHistory,
  usePersonalRecords,
  useProgressStats,
  useTemplate,
  useWorkout,
  useWorkoutStats,
  useWorkoutDates,
  useWorkouts,
  useWorkoutsByExercise,
} from "@/features/workout/queries"
import { getToday } from "@/lib/dateUtils"

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

  it("keeps workout detail query idle when id is empty", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    const { result } = renderHook(() => useWorkout(""), { wrapper })

    expect(result.current.fetchStatus).toBe("idle")
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBeNull()
  })

  it("returns workouts with newest-first ordering and limit", async () => {
    await db.workoutSessions.bulkPut([
      {
        id: "w-old",
        name: "Old",
        date: "2026-02-01",
        weightUnit: "kg",
        exercises: [],
      },
      {
        id: "w-mid",
        name: "Mid",
        date: "2026-02-02",
        weightUnit: "kg",
        exercises: [],
      },
      {
        id: "w-new",
        name: "New",
        date: "2026-02-03",
        weightUnit: "kg",
        exercises: [],
      },
    ])

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    const { result } = renderHook(() => useWorkouts(2), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.map((workout) => workout.id)).toEqual(["w-new", "w-mid"])
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

  it("surfaces an error when requested template does not exist", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    const { result } = renderHook(() => useTemplate("missing-template"), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    if (!(result.current.error instanceof Error)) {
      throw new TypeError("Expected Error")
    }
    expect(result.current.error.message).toBe("Template missing-template not found")
  })

  it("keeps template detail query idle when id is empty", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    const { result } = renderHook(() => useTemplate(""), { wrapper })

    expect(result.current.fetchStatus).toBe("idle")
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBeNull()
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

  it("returns personal records as a map keyed by exercise id", async () => {
    await db.personalRecords.bulkPut([
      { exerciseId: "bench", weight: 225, reps: 5, date: "2026-02-01", workoutId: "w1" },
      { exerciseId: "row", weight: 185, reps: 8, date: "2026-02-02", workoutId: "w2" },
    ])

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => usePersonalRecords(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toMatchObject({
      bench: { exerciseId: "bench", weight: 225, reps: 5 },
      row: { exerciseId: "row", weight: 185, reps: 8 },
    })
  })

  it("builds progress stats from persisted stats, recent workouts and PR count", async () => {
    await db.userStats.put({
      id: "stats",
      totalWorkouts: 9,
      totalVolumeLbs: 12345,
      lastUpdated: "2026-02-10T00:00:00.000Z",
    })

    await db.workoutSessions.bulkPut([
      {
        id: "w-recent",
        name: "Recent",
        date: getToday(),
        weightUnit: "kg",
        exercises: [],
      },
      {
        id: "w-old",
        name: "Old",
        date: "2000-01-01",
        weightUnit: "kg",
        exercises: [],
      },
    ])

    await db.personalRecords.bulkPut([
      { exerciseId: "bench", weight: 225, reps: 5, date: "2026-02-01", workoutId: "w1" },
      { exerciseId: "row", weight: 185, reps: 8, date: "2026-02-02", workoutId: "w2" },
    ])

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useProgressStats(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toMatchObject({
      totalWorkouts: 9,
      totalVolume: 12345,
      last30Days: 1,
      prsCount: 2,
    })
  })

  it("returns workout stats scoped to the requested date range", async () => {
    await db.workoutSessions.bulkPut([
      { id: "w-before", name: "Before", date: "2026-01-30", weightUnit: "kg", exercises: [] },
      { id: "w-in-1", name: "Inside 1", date: "2026-02-02", weightUnit: "kg", exercises: [] },
      { id: "w-in-2", name: "Inside 2", date: "2026-02-05", weightUnit: "kg", exercises: [] },
      { id: "w-after", name: "After", date: "2026-02-10", weightUnit: "kg", exercises: [] },
    ])

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useWorkoutStats("2026-02-01", "2026-02-06"), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.workouts.map((workout) => workout.id).toSorted()).toEqual(["w-in-1", "w-in-2"])
  })

  it("keeps workout stats query idle when either bound is missing", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useWorkoutStats("", "2026-02-06"), { wrapper })

    expect(result.current.fetchStatus).toBe("idle")
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBeNull()
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
