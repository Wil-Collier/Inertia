import { CURRENT_SCHEMA_VERSION } from "@/services/db"
import { KG_TO_LBS } from "@/lib/constants"
import type { Workout } from "@/lib/types"

/**
 * Structure of a Dexie export blob's data section.
 * Used for typing migration transformations.
 */
export interface DexieExportData {
  formatName: "dexie"
  formatVersion: number
  data: {
    databaseName: "TrainingAppDB"
    databaseVersion: number
    tables: Array<{
      name: string
      schema: string
      rowCount: number
    }>
    data: Array<{
      tableName: string
      inbound: boolean
      rows: Array<Record<string, unknown>>
    }>
  }
}

/**
 * Migration function type.
 * Takes export data at version N and returns data compatible with version N+1.
 */
type MigrationFn = (data: DexieExportData) => DexieExportData

/**
 * Registry of backup migrations.
 * Key is the source version, function transforms data to the next version.
 */
const backupMigrations: Record<number, MigrationFn> = {
  // v1 -> v2: Add userStats table with calculated stats from workouts
  1: (data) => {
    const workoutsTable = findTable(data, "workoutSessions")
    const workouts = (workoutsTable?.rows || []) as unknown as Workout[]

    // Calculate total volume in lbs from all workouts
    let totalVolumeLbs = 0
    for (const workout of workouts) {
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
    }

    // Add userStats table to schema
    data.data.tables.push({
      name: "userStats",
      schema: "id",
      rowCount: 1,
    })

    // Add userStats data
    data.data.data.push({
      tableName: "userStats",
      inbound: true,
      rows: [
        {
          id: "stats",
          totalWorkouts: workouts.length,
          totalVolumeLbs,
          lastUpdated: new Date().toISOString(),
        },
      ],
    })

    return data
  },
}

/**
 * Helper to find a table's data in the export.
 */
export function findTable(
  data: DexieExportData,
  tableName: string
): { tableName: string; inbound: boolean; rows: Array<Record<string, unknown>> } | undefined {
  return data.data.data.find((t) => t.tableName === tableName)
}

/**
 * Migrate backup data from an older schema version to the current version.
 * Runs migrations sequentially: v1 -> v2 -> v3 -> ... -> current
 *
 * @param data - The Dexie export data to migrate
 * @param fromVersion - The schema version the backup was created with
 * @returns Migrated data compatible with CURRENT_SCHEMA_VERSION
 * @throws Error if no migration path exists
 */
export function migrateBackupData(
  data: DexieExportData,
  fromVersion: number
): DexieExportData {
  if (fromVersion >= CURRENT_SCHEMA_VERSION) {
    return data
  }

  let currentData = data
  let version = fromVersion

  while (version < CURRENT_SCHEMA_VERSION) {
    const migrator = backupMigrations[version]
    if (!migrator) {
      throw new Error(
        `No migration path from schema version ${version} to ${version + 1}. ` +
          `This backup may be from an incompatible version of the app.`
      )
    }

    if (import.meta.env.DEV) {
      console.log(`Migrating backup data from v${version} to v${version + 1}`)
    }
    currentData = migrator(currentData)
    version++
  }

  // Update the database version in the export to match current
  currentData.data.databaseVersion = CURRENT_SCHEMA_VERSION

  return currentData
}

/**
 * Check if a backup needs migration.
 */
export function backupNeedsMigration(schemaVersion: number): boolean {
  return schemaVersion < CURRENT_SCHEMA_VERSION
}
