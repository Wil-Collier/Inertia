import { beforeEach, describe, expect, it } from "vitest"
import { resetSyncState } from "@/features/sync/recovery/reset"
import { useAuthStore, useSyncStore } from "@/features/sync/runtime/store"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"

describe("resetSyncState", () => {
  beforeEach(async () => {
    await clearDatabase()
    localStorage.clear()

    useAuthStore.getState().setAuth({
      accessToken: "token",
      userId: "user-1",
      email: "user@example.com",
      expiresAtMs: Date.now() + 60_000,
    })
    useSyncStore.setState({
      status: "syncing",
      lastSyncedAtMs: Date.now(),
      lastError: "oops",
      pendingCount: 2,
      conflicts: [{ collection: "foods", id: "f1", serverVersion: 2, clientBaseVersion: 1, reason: "VERSION_MISMATCH" }],
      initialSyncState: { localHasData: true, cloudHasData: true },
    })

    // Seed some sync metadata to confirm clearSyncMetadata runs
    await db.syncPendingChanges.put({ collection: "foods", id: "f1", deleted: false, baseVersion: 1, mutationId: "m1", enqueuedAt: Date.now() })
    await db.syncRecordVersions.put({ collection: "foods", id: "f1", version: 2 })
    await db.metadata.put({ key: "sync.pullCursor", value: JSON.stringify({ version: 5 }) })

    localStorage.setItem("kinetic-device-id", "device-1")
  })

  it("clears auth, sync status, device id, and sync metadata", async () => {
    await resetSyncState()

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useSyncStore.getState().status).toBe("idle")
    expect(useSyncStore.getState().lastError).toBeNull()
    expect(useSyncStore.getState().initialSyncState).toBeNull()
    expect(useSyncStore.getState().conflicts).toEqual([])
    expect(localStorage.getItem("kinetic-device-id")).toBeNull()

    // Real clearSyncMetadata should have emptied sync tables
    expect(await db.syncPendingChanges.count()).toBe(0)
    expect(await db.syncRecordVersions.count()).toBe(0)
    const cursor = await db.metadata.get("sync.pullCursor")
    expect(cursor).toBeUndefined()
  })
})
