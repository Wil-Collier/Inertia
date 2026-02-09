import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { db } from "@/services/db"
import { registerSyncDexieHooks } from "@/features/sync/dexieHooks"
import { clearDatabase, flushAsyncTasks } from "@/test/helpers/dbTestUtils"
import { setRecordVersion } from "@/features/sync/changeTracker"

describe("sync Dexie hooks integration", () => {
  beforeAll(() => {
    registerSyncDexieHooks()
  })

  beforeEach(async () => {
    await clearDatabase()
  })

  it("tracks creates with updatedAt and pending queue metadata", async () => {
    await db.transaction("rw", [db.foods, db.syncPendingChanges, db.syncRecordVersions], async () => {
      await db.foods.put({
        id: "food-1",
        name: "Rice",
        calories: 130,
        protein: 2.4,
        carbs: 28,
        fat: 0.3,
        fiber: 0.4,
        sugar: 0.1,
        servingSize: "100g",
        isCustom: true,
      })
    })

    await flushAsyncTasks()

    const food = await db.foods.get("food-1")
    const pending = await db.syncPendingChanges.get(["foods", "food-1"])

    expect(typeof food?.updatedAt).toBe("number")
    expect(pending).toMatchObject({
      collection: "foods",
      id: "food-1",
      deleted: false,
      baseVersion: 0,
    })
  })

  it("enqueues creates after commit when writes omit sync tracking tables", async () => {
    await db.foods.put({
      id: "food-outside",
      name: "Bread",
      calories: 120,
      protein: 4,
      carbs: 23,
      fat: 1,
      fiber: 2,
      sugar: 2,
      servingSize: "1 slice",
      isCustom: true,
    })

    await flushAsyncTasks()

    expect(await db.syncPendingChanges.get(["foods", "food-outside"])).toMatchObject({
      collection: "foods",
      id: "food-outside",
      deleted: false,
      baseVersion: 0,
    })
  })

  it("uses record versions as baseVersion for updates", async () => {
    await db.transaction("rw", [db.foods, db.syncPendingChanges, db.syncRecordVersions], async () => {
      await db.foods.put({
        id: "food-1",
        name: "Rice",
        calories: 130,
        protein: 2.4,
        carbs: 28,
        fat: 0.3,
        fiber: 0.4,
        sugar: 0.1,
        servingSize: "100g",
        isCustom: true,
      })
    })

    await setRecordVersion("foods", "food-1", 7)
    await db.syncPendingChanges.clear()

    await db.transaction("rw", [db.foods, db.syncPendingChanges, db.syncRecordVersions], async () => {
      await db.foods.update("food-1", { name: "Rice (updated)" })
    })

    await flushAsyncTasks()

    const pending = await db.syncPendingChanges.get(["foods", "food-1"])
    expect(pending?.baseVersion).toBe(7)
    expect(pending?.deleted).toBe(false)
  })

  it("ignores updates that only change food usageCount", async () => {
    await db.transaction("rw", [db.foods, db.syncPendingChanges, db.syncRecordVersions], async () => {
      await db.foods.put({
        id: "food-1",
        name: "Rice",
        calories: 130,
        protein: 2.4,
        carbs: 28,
        fat: 0.3,
        fiber: 0.4,
        sugar: 0.1,
        servingSize: "100g",
        isCustom: true,
        usageCount: 1,
      })
    })

    await db.syncPendingChanges.clear()

    await db.transaction("rw", [db.foods, db.syncPendingChanges, db.syncRecordVersions], async () => {
      await db.foods.update("food-1", { usageCount: 2 })
    })

    await flushAsyncTasks()
    expect(await db.syncPendingChanges.get(["foods", "food-1"])).toBeUndefined()
  })

  it("ignores updates that only change derived workout exerciseIds", async () => {
    await db.transaction("rw", [db.workoutSessions, db.syncPendingChanges, db.syncRecordVersions], async () => {
      await db.workoutSessions.put({
        id: "w1",
        name: "Workout",
        date: "2026-02-07",
        weightUnit: "kg",
        exercises: [],
        exerciseIds: ["bench"],
      })
    })

    await flushAsyncTasks()
    await db.syncPendingChanges.clear()
    expect(await db.syncPendingChanges.get(["workouts", "w1"])).toBeUndefined()

    await db.transaction("rw", [db.workoutSessions, db.syncPendingChanges, db.syncRecordVersions], async () => {
      await db.workoutSessions.update("w1", { exerciseIds: ["bench", "squat"] })
    })

    await flushAsyncTasks()
    expect(await db.syncPendingChanges.get(["workouts", "w1"])).toBeUndefined()
  })

  it("tracks workout updates when exercises change materially", async () => {
    await db.transaction("rw", [db.workoutSessions, db.syncPendingChanges, db.syncRecordVersions], async () => {
      await db.workoutSessions.put({
        id: "w2",
        name: "Workout",
        date: "2026-02-08",
        weightUnit: "kg",
        exercises: [{ id: "we1", exerciseId: "bench", sets: [{ id: "set1", reps: 5, weight: 100, isCompleted: false }] }],
        exerciseIds: ["bench"],
      })
    })

    await flushAsyncTasks()
    await db.syncPendingChanges.clear()

    await db.transaction("rw", [db.workoutSessions, db.syncPendingChanges, db.syncRecordVersions], async () => {
      await db.workoutSessions.update("w2", {
        exercises: [{ id: "we1", exerciseId: "bench", sets: [{ id: "set1", reps: 6, weight: 100, isCompleted: false }] }],
      })
    })

    await flushAsyncTasks()
    expect(await db.syncPendingChanges.get(["workouts", "w2"])).toMatchObject({
      collection: "workouts",
      id: "w2",
      deleted: false,
    })
  })

  it("tracks deletes as tombstones", async () => {
    await db.transaction("rw", [db.customExercises, db.syncPendingChanges, db.syncRecordVersions], async () => {
      await db.customExercises.put({
        id: "ex-1",
        name: "Custom",
        muscleGroup: "arms",
        isCustom: true,
        isWeighted: true,
        isTimeBased: false,
      })
    })

    await db.syncPendingChanges.clear()

    await db.transaction("rw", [db.customExercises, db.syncPendingChanges, db.syncRecordVersions], async () => {
      await db.customExercises.delete("ex-1")
    })

    await flushAsyncTasks()

    expect(await db.syncPendingChanges.get(["exercises", "ex-1"])).toMatchObject({
      collection: "exercises",
      id: "ex-1",
      deleted: true,
    })
  })
})
