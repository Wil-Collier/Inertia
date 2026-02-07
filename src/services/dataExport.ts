import { exportDatabase, importDatabase, CURRENT_SCHEMA_VERSION, recoverDatabase } from "@/services/db"
import { resetSyncState } from "@/features/sync/reset"
import { withSyncHooksSuppressed } from "@/features/sync/dexieHooks"
import { migrateBackupData, backupNeedsMigration, type DexieExportData } from "@/services/backupMigrations"
import { z } from "zod"

const APP_LOCAL_STORAGE_KEYS = [
  "inertia-sync-auth",
  "inertia-sync-store",
  "kinetic-device-id",
] as const

/**
 * Schema for the raw Dexie export format.
 */
const DexieExportSchema = z.object({
  formatName: z.literal("dexie"),
  formatVersion: z.number(),
  data: z.object({
    databaseName: z.literal("TrainingAppDB"),
    databaseVersion: z.number(),
    tables: z.array(z.object({
      name: z.string(),
      schema: z.string(),
      rowCount: z.number(),
    })),
    data: z.array(z.any())
  })
})

/**
 * Schema for wrapped export format with version metadata.
 * This is the format we export and expect for imports.
 */
const WrappedExportSchema = z.object({
  exportVersion: z.number(),
  schemaVersion: z.number(),
  exportedAt: z.string(),
  appVersion: z.string().optional(),
  data: DexieExportSchema
})

export type WrappedExport = z.infer<typeof WrappedExportSchema>

/**
 * Validate a backup file and return parsed content.
 * Only accepts the new wrapped format.
 */
async function parseAndValidateBackup(file: File): Promise<WrappedExport> {
  const text = await file.text()

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error("Failed to parse backup file. Please ensure it's a valid JSON file.")
  }

  const result = WrappedExportSchema.safeParse(json)
  if (!result.success) {
    console.error("Backup validation failed:", result.error)
    throw new Error(
      "Invalid backup file format. This doesn't look like an Inertia backup. " +
      "Make sure you're using a backup created with the current version of the app."
    )
  }

  return result.data
}

/**
 * Export database with version metadata.
 * Creates a wrapped export that includes schema version for future migration compatibility.
 */
export async function downloadExport(): Promise<void> {
  try {
    const blob = await exportDatabase()
    const dexieData: DexieExportData = DexieExportSchema.parse(JSON.parse(await blob.text()))

    const wrappedExport: WrappedExport = {
      exportVersion: 1,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: "1.0.0",
      data: dexieData
    }

    const wrappedBlob = new Blob([JSON.stringify(wrappedExport, null, 2)], {
      type: "application/json"
    })

    const url = URL.createObjectURL(wrappedBlob)
    const a = document.createElement("a")
    a.href = url
    a.download = `inertia-backup-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error("Export failed:", error)
    throw new Error("Failed to export data. Please try again.", { cause: error })
  }
}

/**
 * Import data from a backup file.
 * Handles schema migrations for older backups automatically.
 */
export async function importData(file: File): Promise<{ success: boolean; message: string; shouldReload?: boolean }> {
  try {
    const backup = await parseAndValidateBackup(file)

    let dataToImport = backup.data

    // Check if backup needs migration
    if (backupNeedsMigration(backup.schemaVersion)) {
      if (import.meta.env.DEV) {
        console.log(
          `Backup is from schema v${backup.schemaVersion}, ` +
            `current is v${CURRENT_SCHEMA_VERSION}. Running migrations...`
        )
      }
      dataToImport = migrateBackupData(backup.data, backup.schemaVersion)
    }

    // Convert migrated data back to blob for Dexie import
    const importBlob = new Blob([JSON.stringify(dataToImport)], {
      type: "application/json",
    })

    await withSyncHooksSuppressed(async () => {
      await importDatabase(importBlob)
    })

    await resetSyncState()

    // Caller should reload to reinitialize stores with imported data.
    return { success: true, message: "Data imported successfully", shouldReload: true }
  } catch (error) {
    console.error("Import error:", error)
    const message = error instanceof Error ? error.message : "Failed to import backup file"
    return { success: false, message }
  }
}

/**
 * Clear all data from the database and app-owned localStorage keys.
 */
export async function clearAllData(): Promise<void> {
  try {
    // Use the native deletion path (more reliable on Safari/iOS).
    await recoverDatabase()

    // Clear only app-owned keys so we don't wipe unrelated origin data.
    APP_LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))

    // Small delay to ensure Safari has fully committed the database state
    // Safari has known issues with IndexedDB operations not completing before page unload
    await new Promise(resolve => setTimeout(resolve, 100))

    // Reload page to re-init empty DB and stores
    window.location.reload()
  } catch (error) {
    console.error("Clear data failed:", error)
    throw error
  }
}
