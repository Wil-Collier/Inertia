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

/**
 * Current database schema version.
 * Increment this when making schema changes and add corresponding
 * migration logic in both:
 * 1. The version().upgrade() chain below (for live DB upgrades)
 * 2. backupMigrations.ts (for importing old backups)
 */
export const CURRENT_SCHEMA_VERSION = 2

/** Metadata record for storing app-level key-value data */
export interface MetadataRecord {
  key: string
  value: string | number | boolean
}

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
  metadata!: Table<MetadataRecord>

  constructor() {
    super("TrainingAppDB")

    // Schema definition
    // Note: ++id means auto-incrementing integer key, but our types use string UUIDs.
    // If using UUIDs, we just use 'id'.
    // We add indexes for fields we want to query by.
    this.version(1).stores({
      exercises: "id, name, muscleGroup, category",
      workoutSessions: "id, date, templateId, completedAt, *exerciseIds",
      workoutTemplates: "id, name",
      personalRecords: "exerciseId, date",

      foods: "id, name, brand, isFavorite, isCustom",
      nutritionLogs: "date",
      mealTemplates: "id, name",

      settings: "id",
      bodyWeight: "id, date",
      achievements: "id",
      restTimer: "id",
      activeSession: "id",
      metadata: "key"
    })

    // Migration for v2: Add weightUnit to existing workouts
    this.version(2).stores({}).upgrade(async (tx) => {
      const settings = await tx.table("settings").get("settings")
      const currentUnit = settings?.unitPreferences?.weight || "kg"
      
      await tx.table("workoutSessions").toCollection().modify((workout) => {
        if (!workout.weightUnit) {
          workout.weightUnit = currentUnit
        }
      })
    })

    // Initialize schema version in metadata on database ready
    this.on("ready", async () => {
      // We don't need to manually sync this anymore if we use Dexie version chain correctly,
      // but we'll keep it as a convenience for exports, updated automatically.
      await this.metadata.put({ key: "schemaVersion", value: this.verno })
    })
  }
}

export const db = new TrainingAppDatabase()

/**
 * Check if the database is healthy by performing a simple query.
 * Returns true if healthy, false if corrupted.
 */
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    // Try a simple operation that would fail on a corrupted database
    await db.settings.count()
    return true
  } catch (error) {
    console.error("Database health check failed:", error)
    return false
  }
}

/**
 * Attempt to recover from a corrupted database state.
 * This deletes the database and recreates it fresh.
 */
export async function recoverDatabase(): Promise<void> {
  console.log("Attempting database recovery...")

  try {
    db.close()
  } catch {
    // Ignore close errors
  }

  try {
    // Use the native IndexedDB API to ensure complete deletion
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("TrainingAppDB")
      request.addEventListener("success", () => resolve())
      request.addEventListener("error", () => reject(request.error))
      request.addEventListener("blocked", () => {
        console.warn("Database deletion blocked. Please close all other tabs of this app.")
        // Reject the promise if blocked, prompting caller (or UI) to ask user to close tabs
        reject(new Error("Database deletion blocked. Please close all other tabs."))
      })
    })
  } catch (error) {
    console.error("Failed to delete database via IndexedDB API:", error)
  }

  try {
    await db.open()
    console.log("Database recovery successful")
  } catch (error) {
    console.error("Failed to reopen database after recovery:", error)
    throw error
  }
}

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
