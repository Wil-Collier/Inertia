import { CURRENT_SCHEMA_VERSION } from "@/services/db"

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
 *
 * Example for future v1 -> v2 migration:
 *   1: (data) => {
 *     const workouts = findTable(data, "workoutSessions")
 *     workouts?.rows.forEach(row => {
 *       row.newField = "default"
 *     })
 *     return data
 *   }
 */
const backupMigrations: Record<number, MigrationFn> = {
  // Initial version, no migrations yet
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

    console.log(`Migrating backup data from v${version} to v${version + 1}`)
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
