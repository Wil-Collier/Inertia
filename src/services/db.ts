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
  MealTemplate,
  UserSettings,
  WeightEntry,
  UnlockedAchievement,
  StreakData,
  ActiveWorkoutSession,
  UserStats
} from "@/lib/types"

/**
 * Current database schema version.
 * Keep this at 1 while the app is in early development.
 * Backups are only imported when schemaVersion matches exactly.
 */
export const CURRENT_SCHEMA_VERSION = 1

/** Metadata record for storing app-level key-value data */
export interface MetadataRecord {
  key: string
  value: string | number | boolean
}

export interface SyncPendingChangeRecord {
  collection: string
  id: string
  deleted: boolean
  baseVersion: number
  mutationId: string
  enqueuedAt: number
}

export interface SyncRecordVersionRecord {
  collection: string
  id: string
  version: number
}

// Extend Dexie to handle our DB
export class InertiaDatabase extends Dexie {
  // Tables - customExercises stores ONLY user-created exercises
  // Default exercises come from the static exerciseDatabase module
  customExercises!: Table<Exercise>
  workoutSessions!: Table<Workout>
  workoutTemplates!: Table<WorkoutTemplate>
  personalRecords!: Table<PersonalRecord>

  foods!: Table<FoodItem>
  nutritionLogs!: Table<DailyNutrition>
  mealTemplates!: Table<MealTemplate>

  settings!: Table<UserSettings & { id: string }>
  bodyWeight!: Table<WeightEntry>
  achievements!: Table<{ id: string; unlockedAchievements: UnlockedAchievement[]; streaks: StreakData }>
  restTimer!: Table<{ id: string; duration: number }>
  activeSession!: Table<ActiveWorkoutSession & { id: string }>
  metadata!: Table<MetadataRecord>
  userStats!: Table<UserStats & { id: string }>
  syncPendingChanges!: Table<SyncPendingChangeRecord, [string, string]>
  syncRecordVersions!: Table<SyncRecordVersionRecord, [string, string]>

  constructor() {
    super("InertiaDB")

    // Schema definition
    // Note: ++id means auto-incrementing integer key, but our types use string UUIDs.
    // If using UUIDs, we just use 'id'.
    // We add indexes for fields we want to query by.
    //
    // Hybrid approach: default exercises come from static JS bundle,
    // only custom (user-created) exercises are stored in IDB.
    this.version(1).stores({
      customExercises: "id, name, muscleGroup",
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
      userStats: "id",
      syncPendingChanges: "[collection+id], collection, enqueuedAt",
      syncRecordVersions: "[collection+id], collection, version",
    })

    // Initialize schema version in metadata on database ready
    this.on("ready", async () => {
      // We don't need to manually sync this anymore if we use Dexie version chain correctly,
      // but we'll keep it as a convenience for exports, updated automatically.
      await this.metadata.put({ key: "schemaVersion", value: this.verno })
    })
  }
}

export const db = new InertiaDatabase()

const REQUIRED_STORES = [
  "customExercises",
  "workoutSessions",
  "workoutTemplates",
  "personalRecords",
  "foods",
  "nutritionLogs",
  "mealTemplates",
  "settings",
  "bodyWeight",
  "achievements",
  "restTimer",
  "activeSession",
  "metadata",
  "userStats",
  "syncPendingChanges",
  "syncRecordVersions",
] as const

const REQUIRED_INDEX_CHECKS = [
  ["customExercises", ["name", "muscleGroup"]],
  ["workoutSessions", ["date", "templateId", "completedAt", "exerciseIds"]],
  ["workoutTemplates", ["name"]],
  ["personalRecords", ["date"]],
  ["foods", ["name", "brand", "isFavorite", "isCustom"]],
  ["mealTemplates", ["name"]],
  ["bodyWeight", ["date"]],
  ["syncPendingChanges", ["collection", "enqueuedAt"]],
  ["syncRecordVersions", ["collection", "version"]],
] as const satisfies ReadonlyArray<readonly [string, readonly string[]]>

async function getNativeSchemaIssues(): Promise<string[]> {
  // Ensure Dexie has opened (or will open) the database.
  if (!db.isOpen()) {
    await db.open()
  }

  const backend = db.backendDB()
  const issues: string[] = []

  for (const store of REQUIRED_STORES) {
    if (!backend.objectStoreNames.contains(store)) {
      issues.push(`Missing object store: ${store}`)
    }
  }

  const indexIssueLists = await Promise.all(
    REQUIRED_INDEX_CHECKS.map(async ([store, required]) => {
      if (!backend.objectStoreNames.contains(store)) return [`Missing object store: ${store}`]

      try {
        const tx = backend.transaction([store], "readonly")
        const os = tx.objectStore(store)
        const storeIssues: string[] = []

        for (const indexName of required) {
          if (!os.indexNames.contains(indexName)) {
            storeIssues.push(`Missing index: ${store}.${indexName}`)
          }
        }

        // Ensure the transaction completes to avoid Safari leaving it dangling.
        await new Promise<void>((resolve, reject) => {
          tx.addEventListener("complete", () => resolve())
          tx.addEventListener("abort", () => reject(tx.error))
          tx.addEventListener("error", () => reject(tx.error))
        })

        return storeIssues
      } catch (err) {
        return [`Failed to inspect schema for store ${store}: ${err instanceof Error ? err.message : String(err)}`]
      }
    })
  )

  issues.push(...indexIssueLists.flat())

  return issues
}

/**
 * Check if the database is healthy by performing a simple query.
 * Returns true if healthy, false if corrupted.
 */
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    const issues = await getNativeSchemaIssues()
    if (issues.length > 0) {
      console.warn("Database schema issues detected:", issues)
      return false
    }

    // Perform a non-cursor operation as a final sanity check.
    await db.metadata.get("schemaVersion")
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
    const request = indexedDB.deleteDatabase("InertiaDB")
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
