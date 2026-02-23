import { describe, expect, it } from "vitest"
import { fromCloudRecord, toCloudRecord } from "@/features/sync/tracking/projection"

describe("sync projection", () => {
  it("removes local-only fields when projecting workouts to cloud", () => {
    const projected = toCloudRecord("workouts", {
      id: "w1",
      name: "Workout",
      date: "2026-02-07",
      exerciseIds: ["e1"],
      exercises: [],
      weightUnit: "kg",
    })

    expect(projected).toEqual({
      id: "w1",
      name: "Workout",
      date: "2026-02-07",
      exercises: [],
      weightUnit: "kg",
    })
  })

  it("removes local-only IDs from settings and active session payloads", () => {
    expect(
      toCloudRecord("settings", {
        id: "settings",
        theme: "dark",
        restTimerDuration: 90,
        progressiveOverloadEnabled: true,
        areNotificationsEnabled: false,
        unitPreferences: { weight: "kg", distance: "km" },
        nutritionGoals: { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 },
      })
    ).toMatchObject({ theme: "dark" })

    expect(
      toCloudRecord("activeSession", {
        id: "current",
        workout: { id: "w1" },
      })
    ).toEqual({ workout: { id: "w1" } })
  })

  it("removes usageCount when projecting foods", () => {
    const projected = toCloudRecord("foods", {
      id: "food-1",
      name: "Rice",
      calories: 130,
      isCustom: true,
      usageCount: 99,
    })

    expect(projected).toEqual({
      id: "food-1",
      name: "Rice",
      calories: 130,
      isCustom: true,
    })
  })

  it("rebuilds exerciseIds from pulled workout payload", () => {
    const local = fromCloudRecord("workouts", {
      id: "w1",
      name: "Workout",
      date: "2026-02-07",
      weightUnit: "lbs",
      exercises: [
        { exerciseId: "bench", sets: [] },
        { exerciseId: "squat", sets: [] },
        { bad: true },
      ],
    })

    expect(local.exerciseIds).toEqual(["bench", "squat"])
  })
})
