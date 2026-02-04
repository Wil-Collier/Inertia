import type { NutritionGoals } from "./nutrition"
import type { Syncable } from "./syncable"

export type ThemeMode = "light" | "dark" | "system"

export type WeightUnit = "lbs" | "kg"
export type DistanceUnit = "mi" | "km"

export interface UnitPreferences {
  weight: WeightUnit
  distance: DistanceUnit
}

export interface UserSettings extends Syncable {
  theme: ThemeMode
  nutritionGoals: NutritionGoals
  restTimerDuration: number
  unitPreferences: UnitPreferences
  areNotificationsEnabled: boolean
}
