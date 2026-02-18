import { beforeEach, describe, expect, it, vi } from "vitest"

const exportDatabaseMock = vi.fn()
const importDatabaseMock = vi.fn()
const recoverDatabaseMock = vi.fn()
const resetSyncStateMock = vi.fn()

/**
 * @/services/db is mocked here because dataExport.ts uses `exportDatabase` and `importDatabase`
 * from dexie-export-import, which performs real IndexedDB bulk serialisation/deserialisation.
 * The dexie-export-import library does not work reliably with fake-indexeddb in a jsdom
 * environment (missing Blob/stream APIs). Stubbing `exportDatabase`/`importDatabase` lets us
 * test dataExport's orchestration logic (wrapping, validation, sync reset, localStorage cleanup,
 * page reload) without needing the full Dexie serialisation pipeline.
 */
vi.mock("@/services/db", () => ({
  exportDatabase: (...args: unknown[]) => exportDatabaseMock(...args),
  importDatabase: (...args: unknown[]) => importDatabaseMock(...args),
  recoverDatabase: (...args: unknown[]) => recoverDatabaseMock(...args),
  CURRENT_SCHEMA_VERSION: 1,
}))

vi.mock("@/features/sync/reset", () => ({
  resetSyncState: (...args: unknown[]) => resetSyncStateMock(...args),
}))

vi.mock("@/features/sync/dexieHooks", () => ({
  withSyncHooksSuppressed: async <T>(fn: () => Promise<T>) => await fn(),
}))

import { clearAllData, downloadExport, importData } from "@/services/dataExport"

function createBackupFile(contents: string, name: string = "backup.json"): File {
  const file = new File([contents], name, { type: "application/json" })
  if (typeof file.text !== "function") {
    Object.defineProperty(file, "text", {
      configurable: true,
      value: async () => contents,
    })
  }
  return file
}

describe("dataExport service", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    exportDatabaseMock.mockReset()
    importDatabaseMock.mockReset().mockResolvedValue(undefined)
    recoverDatabaseMock.mockReset().mockResolvedValue(undefined)
    resetSyncStateMock.mockReset().mockResolvedValue(undefined)
    localStorage.clear()
  })

  it("returns failure for invalid backup JSON", async () => {
    const file = createBackupFile("{not-json", "bad.json")

    const result = await importData(file)

    expect(result.success).toBe(false)
    expect(result.message).toContain("Failed to parse backup file")
  })

  it("imports wrapped backups and resets sync state", async () => {
    const wrapped = {
      exportVersion: 1,
      schemaVersion: 1,
      exportedAt: "2026-02-08T00:00:00.000Z",
      data: {
        formatName: "dexie",
        formatVersion: 1,
        data: {
          databaseName: "InertiaDB",
          databaseVersion: 1,
          tables: [],
          data: [],
        },
      },
    }

    const file = createBackupFile(JSON.stringify(wrapped))

    const result = await importData(file)

    expect(result).toEqual({ success: true, message: "Data imported successfully", shouldReload: true })
    expect(importDatabaseMock).toHaveBeenCalledTimes(1)
    expect(resetSyncStateMock).toHaveBeenCalled()
  })

  it("rejects backups with unsupported schema versions", async () => {
    const wrapped = {
      exportVersion: 1,
      schemaVersion: 99,
      exportedAt: "2026-02-08T00:00:00.000Z",
      data: {
        formatName: "dexie",
        formatVersion: 1,
        data: {
          databaseName: "InertiaDB",
          databaseVersion: 1,
          tables: [],
          data: [],
        },
      },
    }

    const result = await importData(createBackupFile(JSON.stringify(wrapped)))

    expect(result.success).toBe(false)
    expect(result.message).toContain("is not supported")
    expect(importDatabaseMock).not.toHaveBeenCalled()
  })

  it("returns a validation error for non-Inertia JSON backups", async () => {
    const file = createBackupFile(JSON.stringify({ random: "shape" }), "invalid.json")
    const result = await importData(file)

    expect(result.success).toBe(false)
    expect(result.message).toContain("Invalid backup file format")
  })

  it("returns failure when import persistence throws", async () => {
    importDatabaseMock.mockRejectedValueOnce(new Error("import failed"))

    const wrapped = {
      exportVersion: 1,
      schemaVersion: 1,
      exportedAt: "2026-02-08T00:00:00.000Z",
      data: {
        formatName: "dexie",
        formatVersion: 1,
        data: {
          databaseName: "InertiaDB",
          databaseVersion: 1,
          tables: [],
          data: [],
        },
      },
    }

    const result = await importData(createBackupFile(JSON.stringify(wrapped)))

    expect(result).toEqual({ success: false, message: "import failed" })
  })

  it("downloads wrapped export metadata", async () => {
    const rawDexie = {
      formatName: "dexie",
      formatVersion: 1,
      data: {
        databaseName: "InertiaDB",
        databaseVersion: 1,
        tables: [],
        data: [],
      },
    }

    const exportBlob = new Blob([JSON.stringify(rawDexie)], { type: "application/json" })
    if (typeof exportBlob.text !== "function") {
      Object.defineProperty(exportBlob, "text", {
        configurable: true,
        value: async () => JSON.stringify(rawDexie),
      })
    }
    exportDatabaseMock.mockResolvedValue(exportBlob)

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    const createObjectURLSpy = vi.fn(() => "blob:test")
    const revokeSpy = vi.fn()
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURLSpy, configurable: true })
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeSpy, configurable: true })

    await downloadExport()

    expect(createObjectURLSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeSpy).toHaveBeenCalledWith("blob:test")
  })

  it("throws a user-facing error when export fails", async () => {
    exportDatabaseMock.mockRejectedValueOnce(new Error("export failed"))

    await expect(downloadExport()).rejects.toThrow("Failed to export data. Please try again.")
  })

  it("clears app-owned localStorage keys during full data clear", async () => {
    localStorage.setItem("inertia-sync-auth", "1")
    localStorage.setItem("inertia-sync-store", "2")
    localStorage.setItem("kinetic-device-id", "3")
    localStorage.setItem("unrelated", "keep")

    const reloadSpy = vi.fn()
    vi.stubGlobal("location", { reload: reloadSpy })
    vi.useFakeTimers()

    const promise = clearAllData()
    await vi.runAllTimersAsync()
    await promise

    expect(recoverDatabaseMock).toHaveBeenCalled()
    expect(localStorage.getItem("inertia-sync-auth")).toBeNull()
    expect(localStorage.getItem("inertia-sync-store")).toBeNull()
    expect(localStorage.getItem("kinetic-device-id")).toBeNull()
    expect(localStorage.getItem("unrelated")).toBe("keep")
    expect(reloadSpy).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it("rethrows recover failures during full clear and does not reload", async () => {
    const reloadSpy = vi.fn()
    recoverDatabaseMock.mockRejectedValueOnce(new Error("recover failed"))
    vi.stubGlobal("location", { reload: reloadSpy })

    await expect(clearAllData()).rejects.toThrow("recover failed")
    expect(reloadSpy).not.toHaveBeenCalled()
  })
})
