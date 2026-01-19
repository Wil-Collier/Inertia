import { exportDatabase, importDatabase, db, CURRENT_SCHEMA_VERSION } from "@/services/db"
import { migrateBackupData, backupNeedsMigration, type DexieExportData } from "@/services/backupMigrations"
import { z } from "zod"

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
      "Invalid backup file format. This doesn't look like a Training App backup. " +
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
    const dexieData = JSON.parse(await blob.text()) as DexieExportData

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
    a.download = `training-app-backup-${new Date().toISOString().split("T")[0]}.json`
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
      console.log(
        `Backup is from schema v${backup.schemaVersion}, ` +
          `current is v${CURRENT_SCHEMA_VERSION}. Running migrations...`
      )
      dataToImport = migrateBackupData(backup.data, backup.schemaVersion)
    }

    // Convert migrated data back to blob for Dexie import
    const importBlob = new Blob([JSON.stringify(dataToImport)], {
      type: "application/json",
    })

    await importDatabase(importBlob)

    // Caller should reload to reinitialize stores with imported data.
    return { success: true, message: "Data imported successfully", shouldReload: true }
  } catch (error) {
    console.error("Import error:", error)
    const message = error instanceof Error ? error.message : "Failed to import backup file"
    return { success: false, message }
  }
}

/**
 * Clear all data from the database and localStorage.
 */
export async function clearAllData(): Promise<void> {
  try {
    // Close any active connections first
    db.close()

    // Delete the database
    await db.delete()

    // Reopen the database to ensure schema is recreated
    // This is critical for Safari which may not complete deletion properly
    await db.open()

    // Clear localStorage (old data)
    localStorage.clear()

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
