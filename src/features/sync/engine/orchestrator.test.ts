import { beforeEach, describe, expect, it, vi } from "vitest"
import { useAuthStore, useSyncStore } from "@/features/sync/store"
import { clearDatabase } from "@/test/helpers/dbTestUtils"

const ensureInitialSyncMock = vi.fn()
const resolveInitialSyncStrategyMock = vi.fn()
const pushPendingChangesInternalMock = vi.fn()
const pullAllChangesMock = vi.fn()
const applyPulledChangesMock = vi.fn()
const setPullCursorMock = vi.fn()
const setLastSyncedAtMsMock = vi.fn()
const setLocalDataOwnerUserIdMock = vi.fn()
const handleSyncErrorMock = vi.fn()

vi.mock("@/features/sync/engine/initialSyncCoordinator", () => ({
  ensureInitialSync: (...args: unknown[]) => ensureInitialSyncMock(...args),
  resolveInitialSyncStrategy: (...args: unknown[]) => resolveInitialSyncStrategyMock(...args),
}))

vi.mock("@/features/sync/engine/pushPipeline", () => ({
  pushPendingChangesInternal: (...args: unknown[]) => pushPendingChangesInternalMock(...args),
}))

vi.mock("@/features/sync/engine/pullPipeline", () => ({
  pullAllChanges: (...args: unknown[]) => pullAllChangesMock(...args),
}))

vi.mock("@/features/sync/engine/applyPipeline", () => ({
  applyPulledChanges: (...args: unknown[]) => applyPulledChangesMock(...args),
}))

vi.mock("@/features/sync/changeTracker", () => ({
  setPullCursor: (...args: unknown[]) => setPullCursorMock(...args),
  setLastSyncedAtMs: (...args: unknown[]) => setLastSyncedAtMsMock(...args),
  setLocalDataOwnerUserId: (...args: unknown[]) => setLocalDataOwnerUserIdMock(...args),
}))

vi.mock("@/features/sync/engine/errors", () => ({
  handleSyncError: (...args: unknown[]) => handleSyncErrorMock(...args),
}))

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    value,
    configurable: true,
  })
}

async function loadOrchestrator() {
  const module = await import("@/features/sync/engine/orchestrator")
  return module
}

describe("sync orchestrator", () => {
  beforeEach(async () => {
    await clearDatabase()
    ensureInitialSyncMock.mockReset().mockResolvedValue(true)
    resolveInitialSyncStrategyMock.mockReset().mockResolvedValue(undefined)
    pushPendingChangesInternalMock.mockReset().mockResolvedValue(undefined)
    pullAllChangesMock.mockReset().mockResolvedValue({
      changes: [],
      cursor: null,
      serverTimestampMs: 100,
      affectedCollections: new Set(),
    })
    applyPulledChangesMock.mockReset().mockResolvedValue(new Set())
    setPullCursorMock.mockReset().mockResolvedValue(undefined)
    setLastSyncedAtMsMock.mockReset().mockResolvedValue(undefined)
    setLocalDataOwnerUserIdMock.mockReset().mockResolvedValue(undefined)
    handleSyncErrorMock.mockReset()

    useAuthStore.setState({
      accessToken: "token",
      userId: "user-1",
      email: "u@example.com",
      expiresAtMs: Date.now() + 60_000,
      isAuthenticated: true,
    })

    useSyncStore.setState({
      status: "idle",
      lastSyncedAtMs: null,
      lastError: null,
      pendingCount: 0,
      conflicts: [],
      initialSyncState: null,
    })
  })

  it("sets offline status and aborts sync when network is offline", async () => {
    setOnline(false)
    const { syncNow } = await loadOrchestrator()

    await syncNow()

    expect(useSyncStore.getState().status).toBe("offline")
    expect(ensureInitialSyncMock).not.toHaveBeenCalled()
  })

  it("runs full sync flow and marks success", async () => {
    setOnline(true)
    pullAllChangesMock.mockResolvedValue({
      changes: [{ collection: "foods", id: "food-1", data: { id: "food-1" }, version: 1, deleted: false }],
      cursor: { version: 1 },
      serverTimestampMs: 222,
      affectedCollections: new Set(["foods"]),
    })

    const { syncNow } = await loadOrchestrator()
    await syncNow()

    expect(ensureInitialSyncMock).toHaveBeenCalledWith("token", "user-1")
    expect(pushPendingChangesInternalMock).toHaveBeenCalledWith("token", true)
    expect(applyPulledChangesMock).toHaveBeenCalled()
    expect(setPullCursorMock).toHaveBeenCalledWith({ version: 1 })
    expect(useSyncStore.getState().status).toBe("success")
  })

  it("retries transient failures with backoff and eventually succeeds", async () => {
    vi.useFakeTimers()
    setOnline(true)
    ensureInitialSyncMock
      .mockRejectedValueOnce(new Error("transient-1"))
      .mockRejectedValueOnce(new Error("transient-2"))
      .mockResolvedValue(true)

    const { syncNow } = await loadOrchestrator()
    const syncPromise = syncNow()

    await vi.advanceTimersByTimeAsync(1_000)
    await vi.advanceTimersByTimeAsync(5_000)
    await syncPromise

    expect(ensureInitialSyncMock).toHaveBeenCalledTimes(3)
    expect(handleSyncErrorMock).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it("prevents concurrent sync runs with in-flight guard", async () => {
    setOnline(true)
    let resolveSync: (() => void) | undefined
    pushPendingChangesInternalMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSync = () => resolve()
        })
    )

    const { syncNow } = await loadOrchestrator()

    const first = syncNow()
    const second = syncNow()
    await Promise.resolve()

    expect(pushPendingChangesInternalMock).toHaveBeenCalledTimes(1)

    resolveSync?.()

    await Promise.all([first, second])
  })

  it("delegates explicit initial-sync strategy resolution", async () => {
    setOnline(true)
    const { resolveInitialSync } = await loadOrchestrator()

    await resolveInitialSync("merge")

    expect(resolveInitialSyncStrategyMock).toHaveBeenCalledWith("token", "user-1", "merge")
    expect(useSyncStore.getState().status).toBe("success")
  })

  it("short-circuits resolveInitialSync when auth state is incomplete", async () => {
    useAuthStore.setState({
      accessToken: null,
      userId: null,
      email: null,
      expiresAtMs: null,
      isAuthenticated: false,
    })

    const { resolveInitialSync } = await loadOrchestrator()
    await resolveInitialSync("merge")

    expect(resolveInitialSyncStrategyMock).not.toHaveBeenCalled()
  })

  it("does not push pending changes while offline", async () => {
    setOnline(false)
    const { pushPendingChanges } = await loadOrchestrator()

    await pushPendingChanges()

    expect(pushPendingChangesInternalMock).not.toHaveBeenCalled()
    expect(useSyncStore.getState().status).toBe("idle")
  })

  it("routes pushPendingChanges failures through the error handler", async () => {
    setOnline(true)
    pushPendingChangesInternalMock.mockRejectedValue(new Error("push failed"))
    handleSyncErrorMock.mockImplementation((error: unknown) => {
      const message = error instanceof Error ? error.message : "Sync failed"
      const store = useSyncStore.getState()
      store.setLastError(message)
      store.setStatus("error")
    })

    const { pushPendingChanges } = await loadOrchestrator()
    await pushPendingChanges()

    expect(handleSyncErrorMock).toHaveBeenCalledTimes(1)
    expect(useSyncStore.getState().status).toBe("error")
    expect(useSyncStore.getState().lastError).toBe("push failed")
  })
})
