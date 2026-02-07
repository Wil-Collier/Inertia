import { afterEach, describe, expect, it, vi } from "vitest"
import { db, importDatabase, isDatabaseHealthy, recoverDatabase } from "@/services/db"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("db service resilience", () => {
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
})
