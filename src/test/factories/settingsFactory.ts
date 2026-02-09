import type { NutritionGoals, UserSettings } from "@/lib/types"

const DEFAULT_GOALS: NutritionGoals = {
  calories: 2000,
  protein: 150,
  carbs: 250,
  fat: 65,
  fiber: 30,
  sugar: 50,
}

export function createSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    theme: overrides.theme ?? "system",
    unitPreferences: overrides.unitPreferences ?? {
      weight: "kg",
      distance: "km",
    },
    restTimerDuration: overrides.restTimerDuration ?? 90,
    nutritionGoals: overrides.nutritionGoals ?? DEFAULT_GOALS,
    areNotificationsEnabled: overrides.areNotificationsEnabled ?? false,
    updatedAt: overrides.updatedAt,
  }
}

export function createZeroCalorieGoalSettings(
  overrides: Partial<UserSettings> = {}
): UserSettings {
  return createSettings({
    ...overrides,
    nutritionGoals: {
      ...(overrides.nutritionGoals ?? DEFAULT_GOALS),
      calories: 0,
    },
  })
}
