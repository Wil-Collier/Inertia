import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetSyncState } from "@/features/sync/reset"
import { useAuthStore, useSyncStore } from "@/features/sync/store"

const clearSyncMetadataMock = vi.fn()

vi.mock("@/features/sync/changeTracker", () => ({
  clearSyncMetadata: (...args: unknown[]) => clearSyncMetadataMock(...args),
}))

describe("resetSyncState", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearSyncMetadataMock.mockResolvedValue(undefined)
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
    expect(clearSyncMetadataMock).toHaveBeenCalledTimes(1)
  })
})
