import Dexie, { type Table } from "dexie"
import "dexie-export-import"
import type { 
  Exercise, 
  Workout, 
  WorkoutTemplate, 
  PersonalRecord, 
  FoodItem, 
  DailyNutrition, 
  MealEntry,
  UserSettings, 
  WeightEntry,
  UnlockedAchievement,
  StreakData,
  ActiveWorkoutSession
} from "@/lib/types"

// Extend Dexie to handle our DB
export class TrainingAppDatabase extends Dexie {
  // Tables
  exercises!: Table<Exercise>
  workoutSessions!: Table<Workout>
  workoutTemplates!: Table<WorkoutTemplate>
  personalRecords!: Table<PersonalRecord>
  
  foods!: Table<FoodItem>
  nutritionLogs!: Table<DailyNutrition>
  mealTemplates!: Table<{ id: string; name: string; entries: Omit<MealEntry, "id">[] }>
  
  settings!: Table<UserSettings & { id: string }>
  bodyWeight!: Table<WeightEntry>
  achievements!: Table<{ id: string; unlockedAchievements: UnlockedAchievement[]; streaks: StreakData }>
  restTimer!: Table<{ id: string; duration: number }>
  activeSession!: Table<ActiveWorkoutSession & { id: string }>

  constructor() {
    super("TrainingAppDB")
    
    // Schema definition
    // Note: ++id means auto-incrementing integer key, but our types use string UUIDs.
    // If using UUIDs, we just use 'id'.
    // We add indexes for fields we want to query by.
    this.version(1).stores({
      exercises: "id, name, muscleGroup, category",
      workoutSessions: "id, date, templateId, completedAt",
      workoutTemplates: "id, name",
      personalRecords: "exerciseId, date", // exerciseId is primary key (one PR per exercise)
      
      foods: "id, name, brand",
      nutritionLogs: "date", // Primary key is date string (YYYY-MM-DD)
      mealTemplates: "id, name",
      
      settings: "id", // Singleton, usually id="settings"
      bodyWeight: "id, date",
      achievements: "id", // Singleton
      restTimer: "id", // Singleton
      activeSession: "id" // Singleton, usually id="current"
    })
  }
}

export const db = new TrainingAppDatabase()

// Export helpers
export async function exportDatabase() {
  const blob = await db.export()
  return blob
}

export async function importDatabase(file: Blob) {
  try {
    await db.delete()
  } catch (deleteError) {
    console.error("Failed to delete database before import:", deleteError)
    throw deleteError
  }

  try {
    await db.open()
  } catch (openError) {
    console.error("Failed to reopen database after delete:", openError)
    // Try to recover by creating a fresh instance
    throw openError
  }

  try {
    await db.import(file, {
      clearTablesBeforeImport: true
    })
  } catch (importError) {
    console.error("Failed to import data:", importError)
    throw importError
  }
}
