import { exportDatabase, importDatabase, db } from "@/services/db"
import { z } from "zod"

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

async function validateBackupFile(file: File): Promise<void> {
  const text = await file.text()
  try {
    const json = JSON.parse(text)
    const result = DexieExportSchema.safeParse(json)
    if (!result.success) {
      console.error("Backup validation failed:", result.error)
      throw new Error("Invalid backup file format. This doesn't look like a Training App backup.")
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("Invalid backup file format")) {
      throw err
    }
    throw new Error("Failed to parse backup file. Please ensure it's a valid JSON file.")
  }
}

export async function downloadExport(): Promise<void> {
  try {
    const blob = await exportDatabase()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `training-app-backup-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error("Export failed:", error)
    alert("Export failed")
  }
}

export async function importData(file: File): Promise<{ success: boolean; message: string }> {
  try {
    await validateBackupFile(file)
    await importDatabase(file)
    // Note: reload() is async and the page will refresh, so caller won't receive this return
    // But we return for completeness in case the reload is blocked
    window.location.reload()
    // This return is technically unreachable during normal operation
    return { success: true, message: "Data imported successfully" }
  } catch (error) {
    console.error("Import error:", error)
    const message = error instanceof Error ? error.message : "Failed to import backup file"
    return { success: false, message }
  }
}

export async function clearAllData(): Promise<void> {
  try {
    await db.delete()
    
    // Clear localStorage (old data)
    localStorage.clear()

    // Reload page to re-init empty DB and stores
    window.location.reload()
  } catch (error) {
    console.error("Clear data failed:", error)
    alert("Failed to clear data")
  }
}
