import { describe, expect, it } from "vitest"
import { backupNeedsMigration, findTable, migrateBackupData } from "@/services/backupMigrations"

const sampleExport = {
  formatName: "dexie" as const,
  formatVersion: 1,
  data: {
    databaseName: "TrainingAppDB" as const,
    databaseVersion: 1,
    tables: [{ name: "foods", schema: "id", rowCount: 1 }],
    data: [{ tableName: "foods", inbound: false, rows: [{ id: "food-1" }] }],
  },
}

describe("backupMigrations", () => {
  it("finds table data by table name", () => {
    const table = findTable(sampleExport, "foods")
    expect(table?.tableName).toBe("foods")
    expect(table?.rows).toHaveLength(1)
  })

  it("returns unchanged data when backup is already current", () => {
    const migrated = migrateBackupData(structuredClone(sampleExport), 1)
    expect(migrated).toEqual(sampleExport)
  })

  it("throws when migration path is missing", () => {
    expect(() => migrateBackupData(structuredClone(sampleExport), 0)).toThrow("No migration path")
  })

  it("reports migration need based on schema version", () => {
    expect(backupNeedsMigration(0)).toBe(true)
    expect(backupNeedsMigration(1)).toBe(false)
    expect(backupNeedsMigration(2)).toBe(false)
  })
})
