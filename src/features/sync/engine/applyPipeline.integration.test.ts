import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { applyPulledChanges, clearLocalSyncData } from "@/features/sync/engine/applyPipeline"
import { registerSyncDexieHooks } from "@/features/sync/dexieHooks"
import { db } from "@/services/db"
import { clearDatabase, flushAsyncTasks } from "@/test/helpers/dbTestUtils"
import {
  getLocalDataOwnerUserId,
  getRecordVersion,
  setLocalDataOwnerUserId,
  setRecordVersion,
} from "@/features/sync/changeTracker"

describe("applyPulledChanges integration", () => {
  beforeAll(() => {
    registerSyncDexieHooks()
  })

  beforeEach(async () => {
    await clearDatabase()
  })

  it("applies pulled nutrition + foods and rebuilds food usage counts", async () => {
    await applyPulledChanges([
      {
        collection: "foods",
        id: "food-1",
        data: {
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
        },
        version: 3,
        deleted: false,
      },
      {
        collection: "nutrition",
        id: "2026-02-07",
        data: {
          date: "2026-02-07",
          entries: [
            { id: "m1", foodId: "food-1", quantity: 1, mealType: "breakfast" },
            { id: "m2", foodId: "food-1", quantity: 2, mealType: "dinner" },
          ],
        },
        version: 4,
        deleted: false,
      },
    ])

    const food = await db.foods.get("food-1")
    expect(food?.usageCount).toBe(2)
    expect(await getRecordVersion("foods", "food-1")).toBe(3)
    expect(await getRecordVersion("nutrition", "2026-02-07")).toBe(4)
  })

  it("persists valid records and versions for every supported sync collection", async () => {
    await applyPulledChanges([
      {
        collection: "workouts",
        id: "w-1",
        data: {
          id: "w-1",
          name: "Push",
          date: "2026-02-10",
          weightUnit: "kg",
          exercises: [{ id: "we-1", exerciseId: "bench", sets: [] }],
        },
        version: 1,
        deleted: false,
      },
      {
        collection: "activeSession",
        id: "current",
        data: {
          startedAt: "2026-02-10T10:00:00.000Z",
          workout: {
            id: "aw-1",
            name: "Live Push",
            date: "2026-02-10",
            weightUnit: "kg",
            exercises: [{ id: "we-2", exerciseId: "row", sets: [] }],
          },
        },
        version: 2,
        deleted: false,
      },
      {
        collection: "templates",
        id: "tpl-1",
        data: {
          id: "tpl-1",
          name: "Template",
          exercises: [{ exerciseId: "bench", targetSets: 3 }],
        },
        version: 3,
        deleted: false,
      },
      {
        collection: "foods",
        id: "food-1",
        data: {
          id: "food-1",
          name: "Chicken",
          calories: 165,
          protein: 31,
          carbs: 0,
          fat: 3.6,
          fiber: 0,
          sugar: 0,
          servingSize: "100g",
          isCustom: true,
        },
        version: 4,
        deleted: false,
      },
      {
        collection: "nutrition",
        id: "2026-02-10",
        data: {
          date: "2026-02-10",
          entries: [{ id: "entry-1", foodId: "food-1", quantity: 1, mealType: "lunch" }],
        },
        version: 5,
        deleted: false,
      },
      {
        collection: "mealTemplates",
        id: "mt-1",
        data: {
          id: "mt-1",
          name: "Lunch",
          entries: [{ foodId: "food-1", quantity: 2, mealType: "lunch" }],
        },
        version: 6,
        deleted: false,
      },
      {
        collection: "weight",
        id: "bw-1",
        data: {
          id: "bw-1",
          date: "2026-02-10",
          weight: 180,
        },
        version: 7,
        deleted: false,
      },
      {
        collection: "settings",
        id: "settings",
        data: {
          theme: "system",
          restTimerDuration: 90,
          areNotificationsEnabled: false,
          unitPreferences: { weight: "kg", distance: "km" },
          nutritionGoals: { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 },
        },
        version: 8,
        deleted: false,
      },
      {
        collection: "exercises",
        id: "custom-1",
        data: {
          id: "custom-1",
          name: "Custom Fly",
          muscleGroup: "chest",
          isCustom: true,
          isWeighted: false,
          isTimeBased: false,
        },
        version: 9,
        deleted: false,
      },
    ])

    expect(await db.workoutSessions.get("w-1")).toBeTruthy()
    expect((await db.activeSession.get("current"))?.workout.id).toBe("aw-1")
    expect(await db.workoutTemplates.get("tpl-1")).toBeTruthy()
    expect(await db.foods.get("food-1")).toBeTruthy()
    expect(await db.nutritionLogs.get("2026-02-10")).toBeTruthy()
    expect(await db.mealTemplates.get("mt-1")).toBeTruthy()
    expect(await db.bodyWeight.get("bw-1")).toBeTruthy()
    expect(await db.settings.get("settings")).toBeTruthy()
    expect(await db.customExercises.get("custom-1")).toBeTruthy()

    expect(await getRecordVersion("workouts", "w-1")).toBe(1)
    expect(await getRecordVersion("activeSession", "current")).toBe(2)
    expect(await getRecordVersion("templates", "tpl-1")).toBe(3)
    expect(await getRecordVersion("foods", "food-1")).toBe(4)
    expect(await getRecordVersion("nutrition", "2026-02-10")).toBe(5)
    expect(await getRecordVersion("mealTemplates", "mt-1")).toBe(6)
    expect(await getRecordVersion("weight", "bw-1")).toBe(7)
    expect(await getRecordVersion("settings", "settings")).toBe(8)
    expect(await getRecordVersion("exercises", "custom-1")).toBe(9)
  })

  it("rebuilds workout exerciseIds from pulled workout payload", async () => {
    await applyPulledChanges([
      {
        collection: "workouts",
        id: "w1",
        data: {
          id: "w1",
          name: "Pull Day",
          date: "2026-02-07",
          weightUnit: "kg",
          exercises: [
            { id: "we1", exerciseId: "bench", sets: [] },
            { id: "we2", exerciseId: "row", sets: [] },
          ],
        },
        version: 10,
        deleted: false,
      },
    ])

    const workout = await db.workoutSessions.get("w1")
    expect(workout?.exerciseIds).toEqual(["bench", "row"])
    expect(await getRecordVersion("workouts", "w1")).toBe(10)
  })

  it("skips invalid records and persists valid ones in multi-change batches", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const affected = await applyPulledChanges([
      {
        collection: "foods",
        id: "food-valid",
        data: {
          id: "food-valid",
          name: "Valid Food",
          calories: 100,
          protein: 10,
          carbs: 10,
          fat: 2,
          fiber: 1,
          sugar: 1,
          servingSize: "100g",
          isCustom: true,
        },
        version: 11,
        deleted: false,
      },
      {
        collection: "workouts",
        id: "w-invalid",
        data: {
          foo: "bar",
        },
        version: 12,
        deleted: false,
      },
    ])

    // Valid food should be persisted
    expect(await db.foods.get("food-valid")).toBeDefined()
    expect(await getRecordVersion("foods", "food-valid")).toBe(11)

    // Invalid workout should be skipped but its version still recorded
    // so the cursor advances past it
    expect(await db.workoutSessions.get("w-invalid")).toBeUndefined()
    expect(await getRecordVersion("workouts", "w-invalid")).toBe(12)

    // Both collections affected
    expect(affected).toEqual(new Set(["foods", "workouts"]))

    // Warning logged for the invalid record
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("workouts:w-invalid")
    )
    consoleSpy.mockRestore()
  })

  it("deletes local records and preserves tombstone version for later rebases", async () => {
    await db.workoutSessions.put({
      id: "w-delete",
      name: "Delete Me",
      date: "2026-02-06",
      weightUnit: "kg",
      exercises: [],
    })
    await setRecordVersion("workouts", "w-delete", 12)

    await applyPulledChanges([
      {
        collection: "workouts",
        id: "w-delete",
        data: null,
        version: 13,
        deleted: true,
      },
    ])

    expect(await db.workoutSessions.get("w-delete")).toBeUndefined()
    expect(await getRecordVersion("workouts", "w-delete")).toBe(13)
  })

  it("uses tombstone version when a deterministic id is recreated locally", async () => {
    await applyPulledChanges([
      {
        collection: "nutrition",
        id: "2026-02-06",
        data: null,
        version: 9,
        deleted: true,
      },
    ])

    await db.transaction("rw", [db.nutritionLogs, db.syncPendingChanges, db.syncRecordVersions], async () => {
      await db.nutritionLogs.put({ date: "2026-02-06", entries: [] })
    })
    await flushAsyncTasks()

    const pending = await db.syncPendingChanges.get(["nutrition", "2026-02-06"])
    expect(pending?.baseVersion).toBe(9)
  })

  it("canonicalizes settings to singleton id even when server sends a different record id", async () => {
    await applyPulledChanges([
      {
        collection: "settings",
        id: "server-settings-1",
        data: {
          theme: "system",
          restTimerDuration: 120,
          areNotificationsEnabled: true,
          unitPreferences: { weight: "lbs", distance: "mi" },
          nutritionGoals: { calories: 2500, protein: 180, carbs: 300, fat: 80, fiber: 35, sugar: 60 },
        },
        version: 21,
        deleted: false,
      },
    ])

    expect(await db.settings.get("settings")).toMatchObject({
      restTimerDuration: 120,
      unitPreferences: { weight: "lbs", distance: "mi" },
    })
    expect(await db.settings.get("server-settings-1")).toBeUndefined()
    expect(await getRecordVersion("settings", "settings")).toBe(21)
    expect(await getRecordVersion("settings", "server-settings-1")).toBe(0)
  })

  it("clears synced local tables and sync record versions", async () => {
    await db.workoutSessions.put({
      id: "w-clear",
      name: "Clear",
      date: "2026-02-10",
      weightUnit: "kg",
      exercises: [],
    })
    await db.activeSession.put({
      id: "current",
      startedAt: "2026-02-10T10:00:00.000Z",
      workout: {
        id: "aw-clear",
        name: "Active",
        date: "2026-02-10",
        weightUnit: "kg",
        exercises: [],
      },
    })
    await db.workoutTemplates.put({ id: "tpl-clear", name: "Template", exercises: [] })
    await db.personalRecords.put({
      exerciseId: "ex-clear",
      weight: 100,
      weightUnit: "kg",
      reps: 5,
      date: "2026-02-10",
      workoutId: "w-clear",
    })
    await db.foods.put({
      id: "food-clear",
      name: "Food",
      calories: 100,
      protein: 10,
      carbs: 10,
      fat: 2,
      fiber: 1,
      sugar: 1,
      servingSize: "100g",
      isCustom: true,
    })
    await db.nutritionLogs.put({ date: "2026-02-10", entries: [] })
    await db.mealTemplates.put({ id: "mt-clear", name: "Meal", entries: [] })
    await db.bodyWeight.put({ id: "bw-clear", date: "2026-02-10", weight: 180 })
    await db.settings.put({
      id: "settings",
      theme: "system",
      restTimerDuration: 90,
      areNotificationsEnabled: false,
      unitPreferences: { weight: "kg", distance: "km" },
      nutritionGoals: { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 },
    })
    await db.customExercises.put({
      id: "ex-clear",
      name: "Custom",
      muscleGroup: "back",
      isCustom: true,
      isWeighted: true,
      isTimeBased: false,
    })
    await db.userStats.put({
      id: "stats",
      totalWorkouts: 1,
      totalVolumeLbs: 1000,
      lastUpdated: "2026-02-10T10:00:00.000Z",
    })
    await db.achievements.put({
      id: "achievements",
      unlockedAchievements: [{ id: "first-workout", unlockedAt: "2026-02-10T10:00:00.000Z" }],
      streaks: {
        currentWorkoutStreak: 1,
        longestWorkoutStreak: 1,
        lastWorkoutDate: "2026-02-10",
        currentNutritionStreak: 0,
        longestNutritionStreak: 0,
        lastNutritionDate: null,
      },
    })

    await setRecordVersion("workouts", "w-clear", 1)
    await setRecordVersion("foods", "food-clear", 1)
    await setLocalDataOwnerUserId("user-1")

    await clearLocalSyncData()

    expect(await db.workoutSessions.count()).toBe(0)
    expect(await db.activeSession.count()).toBe(0)
    expect(await db.workoutTemplates.count()).toBe(0)
    expect(await db.personalRecords.count()).toBe(0)
    expect(await db.foods.count()).toBe(0)
    expect(await db.nutritionLogs.count()).toBe(0)
    expect(await db.mealTemplates.count()).toBe(0)
    expect(await db.bodyWeight.count()).toBe(0)
    expect(await db.customExercises.count()).toBe(0)
    expect(await db.userStats.count()).toBe(0)
    expect(await db.achievements.count()).toBe(0)
    expect(await db.settings.get("settings")).toBeUndefined()
    expect(await db.syncRecordVersions.count()).toBe(0)
    expect(await getLocalDataOwnerUserId()).toBeNull()
  })
})
