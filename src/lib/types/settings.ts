import type { NutritionGoals } from "./nutrition"

export type ThemeMode = "light" | "dark" | "system"

export type WeightUnit = "lbs" | "kg"
export type DistanceUnit = "mi" | "km"

export interface UnitPreferences {
  weight: WeightUnit
  distance: DistanceUnit
}

export interface UserSettings {
  theme: ThemeMode
  nutritionGoals: NutritionGoals
  restTimerDuration: number
  unitPreferences: UnitPreferences
  areNotificationsEnabled: boolean
}
