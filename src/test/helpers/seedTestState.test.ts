import { beforeEach, describe, expect, it } from "vitest"
import { db } from "@/services/db"
import { useAuthStore, useSyncStore } from "@/features/sync/store"
import { createActiveSessionSeed } from "@/test/factories/sessionFactory"
import {
  createDailyNutritionLog,
  createFoodItem,
  createMealTemplate,
} from "@/test/factories/nutritionFactory"
import { createSettings } from "@/test/factories/settingsFactory"
import { createWorkout, createWorkoutTemplate } from "@/test/factories/workoutFactory"
import { resetTestRuntime } from "@/test/helpers/resetTestRuntime"
import { seedTestState } from "@/test/helpers/seedTestState"

const workout = createWorkout({ id: "workout-1", date: "2026-02-09" })
const workoutTemplate = createWorkoutTemplate({ id: "template-1" })
const food = createFoodItem({ id: "food-1" })
const mealLog = createDailyNutritionLog({
  date: "2026-02-09",
  entries: [{ id: "entry-1", foodId: "food-1", quantity: 1, mealType: "breakfast", updatedAt: 1 }],
})
const mealTemplate = createMealTemplate({
  id: "meal-template-1",
  entries: [{ foodId: "food-1", quantity: 2, mealType: "lunch" }],
})

describe("seedTestState", () => {
  beforeEach(async () => {
    await resetTestRuntime()
  })

  it("writes provided records to tables and singletons", async () => {
    await seedTestState({
      settings: createSettings({ restTimerDuration: 120 }),
      activeSession: createActiveSessionSeed(),
      workouts: [workout],
      templates: [workoutTemplate],
      foods: [food],
      nutritionLogs: [mealLog],
      mealTemplates: [mealTemplate],
      achievements: {
        unlockedAchievements: [{ id: "first-workout", unlockedAt: "2026-02-09T00:00:00.000Z" }],
        streaks: {
          currentWorkoutStreak: 1,
          longestWorkoutStreak: 1,
          lastWorkoutDate: "2026-02-09",
          currentNutritionStreak: 1,
          longestNutritionStreak: 1,
          lastNutritionDate: "2026-02-09",
        },
      },
      authState: {
        accessToken: "token-1",
        userId: "user-1",
        email: "user@example.com",
        expiresAtMs: Date.now() + 1000,
        isAuthenticated: true,
      },
      syncState: {
        status: "success",
        pendingCount: 3,
      },
    })

    expect(await db.settings.get("settings")).toMatchObject({ restTimerDuration: 120 })
    expect(await db.activeSession.get("current")).toBeTruthy()
    expect(await db.workoutSessions.get("workout-1")).toBeTruthy()
    expect(await db.workoutTemplates.get("template-1")).toBeTruthy()
    expect(await db.foods.get("food-1")).toBeTruthy()
    expect(await db.nutritionLogs.get("2026-02-09")).toBeTruthy()
    expect(await db.mealTemplates.get("meal-template-1")).toBeTruthy()
    expect(await db.achievements.get("achievements")).toBeTruthy()

    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().accessToken).toBe("token-1")
    expect(useSyncStore.getState().status).toBe("success")
    expect(useSyncStore.getState().pendingCount).toBe(3)
  })
})
