/**
 * Database service using Dexie.js (IndexedDB wrapper).
 *
 * @module db
 *
 * ## Dexie Version
 *
 * This app uses Dexie v4.x with dexie-export-import for backup/restore functionality.
 *
 * @see https://dexie.org/docs/Dexie/Dexie
 * @see https://github.com/dexie/Dexie.js/tree/master/addons/dexie-export-import
 */
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
  ActiveWorkoutSession,
  UserStats
} from "@/lib/types"
import { KG_TO_LBS } from "@/lib/constants"

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
  userStats!: Table<UserStats & { id: string }>

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

    // Version 2: Add userStats table for incremental stats tracking
    this.version(2).stores({
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
      metadata: "key",
      userStats: "id"
    }).upgrade(async (tx) => {
      // Calculate initial stats from existing workouts using .each() to avoid loading all into memory
      let totalVolumeLbs = 0
      let totalWorkouts = 0

      await tx.table<Workout>("workoutSessions").each((workout) => {
        totalWorkouts++
        const rawVolume = workout.exercises.reduce((exTotal, ex) => {
          return (
            exTotal +
            ex.sets
              .filter((s) => s.isCompleted)
              .reduce((setTotal, set) => setTotal + set.weight * set.reps, 0)
          )
        }, 0)
        const conversionFactor = workout.weightUnit === "kg" ? KG_TO_LBS : 1
        totalVolumeLbs += rawVolume * conversionFactor
      })

      await tx.table<UserStats & { id: string }>("userStats").put({
        id: "stats",
        totalWorkouts,
        totalVolumeLbs,
        lastUpdated: new Date().toISOString(),
      })
    })

    // Initialize schema version in metadata on database ready
    this.on("ready", async () => {
      // We don't need to manually sync this anymore if we use Dexie version chain correctly,
      // but we'll keep it as a convenience for exports, updated automatically.
      await this.metadata.put({ key: "schemaVersion", value: this.verno })
    })

    // Seed default exercises when database is first created
    this.on("populate", async () => {
      const { loadDefaultExercises } = await import("@/data/exerciseLoader")
      const defaultExercises = await loadDefaultExercises()
      await this.exercises.bulkAdd(defaultExercises)
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
/**
 * Attempt to recover from a corrupted database state.
 * This deletes the database and recreates it fresh.
 * @throws Error if database deletion or reopening fails
 */
export async function recoverDatabase(): Promise<void> {
  if (import.meta.env.DEV) {
    console.log("Attempting database recovery...")
  }

  try {
    db.close()
  } catch {
    // Ignore close errors
  }

  // Use the native IndexedDB API to ensure complete deletion
  // This must succeed before we can proceed
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("TrainingAppDB")
    request.addEventListener("success", () => resolve())
    request.addEventListener("error", () => reject(request.error))
    request.addEventListener("blocked", () => {
      reject(new Error("Database deletion blocked. Please close all other tabs of this app and try again."))
    })
  })

  try {
    await db.open()
    if (import.meta.env.DEV) {
      console.log("Database recovery successful")
    }
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

/**
 * Import database from a backup file.
 *
 * Safety: Creates a backup of the current database before import.
 * If import fails, the backup is used to restore the previous state.
 *
 * @param file - The backup file blob to import
 * @throws Error if import fails and restoration also fails
 */
export async function importDatabase(file: Blob) {
  // Create backup of current data before destructive operation
  let backupBlob: Blob | null = null
  try {
    backupBlob = await db.export()
  } catch (backupError) {
    // If we can't backup, it's likely an empty or corrupt DB - proceed anyway
    if (import.meta.env.DEV) {
      console.log("Could not create backup before import (DB may be empty):", backupError)
    }
  }

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
    throw openError
  }

  try {
    await db.import(file, {
      clearTablesBeforeImport: true
    })
  } catch (importError) {
    console.error("Failed to import data:", importError)

    // Attempt to restore from backup
    if (backupBlob) {
      try {
        await db.delete()
        await db.open()
        await db.import(backupBlob, { clearTablesBeforeImport: true })
        console.error("Restored previous data after failed import")
      } catch (restoreError) {
        console.error("Failed to restore backup after import failure:", restoreError)
        // At this point we've lost data - include both errors for debugging
        const combinedError = new Error(
          "Import failed and backup restoration also failed. Database may be corrupted."
        )
        // Attach both the original import error and the restore error
        combinedError.cause = { importError, restoreError }
        throw combinedError
      }
    }

    throw importError
  }
}
