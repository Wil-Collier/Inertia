// Exercise Types
export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "legs"
  | "core"
  | "cardio"

export interface Exercise {
  id: string
  name: string
  muscleGroup: MuscleGroup
  isCustom: boolean
  isWeighted: boolean
  isTimeBased: boolean
}

// Workout Types
export interface WorkoutSet {
  id: string
  reps: number
  weight: number
  completed: boolean
}

export interface WorkoutExercise {
  id: string
  exerciseId: string
  sets: WorkoutSet[]
  notes?: string
  lastPerformanceDate?: string // ISO date of last workout with this exercise
}

// Progressive overload - last performance data
export interface LastPerformance {
  sets: { weight: number; reps: number }[]
  date: string // ISO date string
  workoutId: string
}

export interface Workout {
  id: string
  date: string // ISO date string
  name: string
  exercises: WorkoutExercise[]
  exerciseIds?: string[] // For faster indexing/querying
  duration?: number // minutes
  completedAt?: string // ISO timestamp when completed
}

// Workout Templates
export interface TemplateExercise {
  exerciseId: string
  targetSets: number
  targetReps?: number
  targetWeight?: number
}

export interface WorkoutTemplate {
  id: string
  name: string
  exercises: TemplateExercise[]
}

// Nutrition Types
export interface FoodItem {
  id: string
  name: string
  brand?: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  servingSize: string
  servingGrams?: number
  barcode?: string
  isCustom: boolean
  isFavorite?: boolean
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack"

export interface MealEntry {
  id: string
  foodId: string
  quantity: number // multiplier of serving size
  mealType: MealType
}

export interface DailyNutrition {
  date: string // YYYY-MM-DD
  entries: MealEntry[]
}

// Goals & Settings
export interface NutritionGoals {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
}

export type ThemeMode = "light" | "dark" | "system"

export interface UserSettings {
  theme: ThemeMode
  nutritionGoals: NutritionGoals
  restTimerDuration: number // seconds
  weightUnit: WeightUnit // lbs or kg for workout weights (legacy, use unitPreferences)
  unitPreferences: UnitPreferences // comprehensive unit preferences
  notificationsEnabled: boolean // whether to show rest timer notifications
}

// Personal Records
export interface PersonalRecord {
  exerciseId: string // Primary key - one PR per exercise
  weight: number
  reps: number
  date: string
  workoutId: string
}

// Active Workout Session
export interface ActiveWorkoutSession {
  workout: Workout
  startedAt: string
  templateId?: string
}

// Body Weight Tracking
export type WeightUnit = "lbs" | "kg"
export type DistanceUnit = "mi" | "km"

// Unit System Preferences
export interface UnitPreferences {
  weight: WeightUnit
  distance: DistanceUnit
}

export interface WeightEntry {
  id: string
  date: string // YYYY-MM-DD
  weight: number
  note?: string
}

// Achievements & Streaks
export interface UnlockedAchievement {
  id: string
  unlockedAt: string // ISO date string
}

export interface StreakData {
  currentWorkoutStreak: number
  longestWorkoutStreak: number
  lastWorkoutDate: string | null
  currentNutritionStreak: number
  longestNutritionStreak: number
  lastNutritionDate: string | null
}
