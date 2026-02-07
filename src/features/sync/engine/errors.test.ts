import { beforeEach, describe, expect, it } from "vitest"
import { SyncApiError } from "@/features/sync/api"
import { handleSyncError } from "@/features/sync/engine/errors"
import { useAuthStore, useSyncStore } from "@/features/sync/store"

describe("sync error handling", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth()
    useSyncStore.setState({
      status: "idle",
      lastSyncedAtMs: null,
      lastError: null,
      pendingCount: 0,
      conflicts: [],
      initialSyncState: null,
    })
  })

  it("clears auth and sets session-expired error on 401 API responses", () => {
    useAuthStore.getState().setAuth({
      accessToken: "token",
      userId: "user-1",
      email: "user@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

    handleSyncError(new SyncApiError("Unauthorized", "UNAUTHORIZED", 401))

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useSyncStore.getState().lastError).toBe("Session expired. Please sign in again.")
    expect(useSyncStore.getState().status).toBe("error")
  })

  it("surfaces typed sync API errors to the user-facing sync state", () => {
    handleSyncError(new SyncApiError("Server unreachable", "SERVER_ERROR", 503))

    expect(useSyncStore.getState().lastError).toBe("Server unreachable")
    expect(useSyncStore.getState().status).toBe("error")
  })

  it("maps generic and unknown errors to stable fallback messages", () => {
    handleSyncError(new Error("Socket timeout"))
    expect(useSyncStore.getState().lastError).toBe("Socket timeout")

    handleSyncError("unexpected")
    expect(useSyncStore.getState().lastError).toBe("Sync failed")
    expect(useSyncStore.getState().status).toBe("error")
  })
})
