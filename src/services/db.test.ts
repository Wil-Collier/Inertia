import { afterEach, describe, expect, it, vi } from "vitest"
import { db, importDatabase, isDatabaseHealthy, recoverDatabase } from "@/services/db"

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
  "activeSession",
  "metadata",
  "userStats",
  "syncPendingChanges",
  "syncRecordVersions",
] as const

const REQUIRED_INDEXES_BY_STORE: Record<string, string[]> = {
  customExercises: ["name", "muscleGroup"],
  workoutSessions: ["date", "templateId", "completedAt", "exerciseIds"],
  workoutTemplates: ["name"],
  personalRecords: ["date"],
  foods: ["name", "brand", "isFavorite", "isCustom"],
  mealTemplates: ["name"],
  bodyWeight: ["date"],
  syncPendingChanges: ["collection", "enqueuedAt"],
  syncRecordVersions: ["collection", "version"],
}

const STORE_KEY_PATHS: Record<string, string | string[]> = {
  customExercises: "id",
  workoutSessions: "id",
  workoutTemplates: "id",
  personalRecords: "exerciseId",
  foods: "id",
  nutritionLogs: "date",
  mealTemplates: "id",
  settings: "id",
  bodyWeight: "id",
  achievements: "id",
  activeSession: "id",
  metadata: "key",
  userStats: "id",
  syncPendingChanges: ["collection", "id"],
  syncRecordVersions: ["collection", "id"],
}

const createdProbeDbNames: string[] = []

function deleteDatabaseByName(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.addEventListener("success", () => resolve())
    request.addEventListener("error", () => reject(request.error ?? new Error("delete failed")))
    request.addEventListener("blocked", () => reject(new Error("delete blocked")))
  })
}

async function createSchemaProbeDatabase(options?: {
  missingStore?: string
  missingIndex?: { store: string; index: string }
}): Promise<IDBDatabase> {
  const name = `db-probe-${crypto.randomUUID()}`
  createdProbeDbNames.push(name)

  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1)

    request.addEventListener("upgradeneeded", () => {
      const probeDb = request.result

      for (const storeName of REQUIRED_STORES) {
        if (options?.missingStore === storeName) continue

        const objectStore = probeDb.createObjectStore(storeName, {
          keyPath: STORE_KEY_PATHS[storeName],
        })

        const requiredIndexes = REQUIRED_INDEXES_BY_STORE[storeName] ?? []
        for (const indexName of requiredIndexes) {
          if (options?.missingIndex && options.missingIndex.store === storeName && options.missingIndex.index === indexName) {
            continue
          }

          objectStore.createIndex(indexName, indexName, {
            multiEntry: indexName === "exerciseIds",
          })
        }
      }
    })

    request.addEventListener("success", () => {
      resolve(request.result)
    })
    request.addEventListener("error", () => {
      reject(request.error ?? new Error("failed to open schema probe database"))
    })
  })
}

afterEach(async () => {
  vi.restoreAllMocks()

  const names = createdProbeDbNames.splice(0)
  await Promise.all(names.map(async (name) => await deleteDatabaseByName(name)))
})

describe("db service resilience", () => {
  it("reports healthy when schema and probes pass", async () => {
    await expect(isDatabaseHealthy()).resolves.toBe(true)
  })

  it("reports unhealthy when required index is missing", async () => {
    const backend = await createSchemaProbeDatabase({
      missingIndex: { store: "foods", index: "brand" },
    })

    vi.spyOn(db, "isOpen").mockReturnValue(true)
    vi.spyOn(db, "backendDB").mockImplementation(() => backend)
    vi.spyOn(db.metadata, "get").mockResolvedValue({ key: "schemaVersion", value: 1 })

    await expect(isDatabaseHealthy()).resolves.toBe(false)

    backend.close()
  })

  it("reports unhealthy when required store is missing", async () => {
    const backend = await createSchemaProbeDatabase({
      missingStore: "syncRecordVersions",
    })

    vi.spyOn(db, "isOpen").mockReturnValue(true)
    vi.spyOn(db, "backendDB").mockImplementation(() => backend)
    vi.spyOn(db.metadata, "get").mockResolvedValue({ key: "schemaVersion", value: 1 })

    await expect(isDatabaseHealthy()).resolves.toBe(false)

    backend.close()
  })

  it("reports unhealthy when schema inspection throws", async () => {
    vi.spyOn(db, "isOpen").mockReturnValue(true)
    vi.spyOn(db, "backendDB").mockImplementation(() => {
      throw new Error("schema probe failed")
    })

    await expect(isDatabaseHealthy()).resolves.toBe(false)
  })

  it("surfaces deletion failures during recovery", async () => {
    vi.spyOn(db, "close").mockImplementation(() => undefined)

    vi.spyOn(indexedDB, "deleteDatabase").mockImplementation(() => {
      throw new Error("delete failed")
    })

    await expect(recoverDatabase()).rejects.toThrow("delete failed")
  })

  it("surfaces actionable blocked errors during recovery", async () => {
    vi.spyOn(db, "close").mockImplementation(() => undefined)

    vi.spyOn(indexedDB, "deleteDatabase").mockImplementation(() => {
      throw new Error("Database deletion blocked. Please close all other tabs of this app and try again.")
    })

    await expect(recoverDatabase()).rejects.toThrow(
      "Database deletion blocked. Please close all other tabs of this app and try again."
    )
  })

  it("restores backup after import failure and rethrows original import error", async () => {
    const backupBlob = new Blob(["backup"])
    const targetBlob = new Blob(["target"])
    const importError = new Error("primary import failed")

    vi.spyOn(db, "export").mockResolvedValue(backupBlob)
    const deleteSpy = vi.spyOn(db, "delete").mockResolvedValue(undefined)
    const openSpy = vi.spyOn(db, "open").mockResolvedValue(db)
    const importSpy = vi
      .spyOn(db, "import")
      .mockRejectedValueOnce(importError)
      .mockResolvedValueOnce(undefined)

    await expect(importDatabase(targetBlob)).rejects.toThrow("primary import failed")

    expect(deleteSpy).toHaveBeenCalledTimes(2)
    expect(openSpy).toHaveBeenCalledTimes(2)
    expect(importSpy).toHaveBeenCalledTimes(2)

    expect(importSpy.mock.calls[0]?.[0]).toBe(targetBlob)
    expect(importSpy.mock.calls[0]?.[1]).toEqual({ clearTablesBeforeImport: true })
    expect(importSpy.mock.calls[1]?.[0]).toBe(backupBlob)
    expect(importSpy.mock.calls[1]?.[1]).toEqual({ clearTablesBeforeImport: true })
  })

  it("throws combined failure when import and restore both fail", async () => {
    const backupBlob = new Blob(["backup"])
    const targetBlob = new Blob(["target"])
    const importError = new Error("primary import failed")
    const restoreError = new Error("restore failed")

    vi.spyOn(db, "export").mockResolvedValue(backupBlob)
    vi.spyOn(db, "delete").mockResolvedValue(undefined)
    vi.spyOn(db, "open").mockResolvedValue(db)
    vi.spyOn(db, "import").mockRejectedValueOnce(importError).mockRejectedValueOnce(restoreError)

    await expect(importDatabase(targetBlob)).rejects.toMatchObject({
      message: "Import failed and backup restoration also failed. Database may be corrupted.",
      cause: { importError, restoreError },
    })
  })
})
