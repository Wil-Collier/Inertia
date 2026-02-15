import { beforeEach, describe, expect, it, vi } from "vitest"
import { SyncApiError } from "@/features/sync/api"
import { useAuthStore, useSyncStore } from "@/features/sync/store"
import { clearDatabase } from "@/test/helpers/dbTestUtils"

const ensureInitialSyncMock = vi.fn()
const resolveInitialSyncStrategyMock = vi.fn()
const pushPendingChangesInternalMock = vi.fn()
const pullAndProcessChangesMock = vi.fn()
const applyPulledChangesChunkMock = vi.fn()
const finalizeAppliedPullChangesMock = vi.fn()
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
  pullAndProcessChanges: (...args: unknown[]) => pullAndProcessChangesMock(...args),
}))

vi.mock("@/features/sync/engine/applyPipeline", () => ({
  applyPulledChangesChunk: (...args: unknown[]) => applyPulledChangesChunkMock(...args),
  finalizeAppliedPullChanges: (...args: unknown[]) => finalizeAppliedPullChangesMock(...args),
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
    pullAndProcessChangesMock.mockReset().mockImplementation(async (_tokenSource, options?: { onPage?: (page: unknown) => Promise<void> }) => {
      if (options?.onPage) {
        await options.onPage({
          changes: [],
          cursor: null,
          serverTimestampMs: 100,
          affectedCollections: new Set(),
          hasMore: false,
        })
      }
      return {
        cursor: null,
        serverTimestampMs: 100,
        affectedCollections: new Set(),
        hasMore: false,
        pagesProcessed: 1,
      }
    })
    applyPulledChangesChunkMock.mockReset().mockResolvedValue(new Set())
    finalizeAppliedPullChangesMock.mockReset().mockResolvedValue(undefined)
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
      lastAutoMergeSummary: null,
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
    pullAndProcessChangesMock.mockImplementation(async (_tokenSource, options?: { onPage?: (page: unknown) => Promise<void> }) => {
      if (options?.onPage) {
        await options.onPage({
          changes: [{ collection: "foods", id: "food-1", data: { id: "food-1" }, version: 1, deleted: false }],
          cursor: { version: 1 },
          serverTimestampMs: 222,
          affectedCollections: new Set(["foods"]),
          hasMore: false,
        })
      }
      return {
        cursor: { version: 1 },
        serverTimestampMs: 222,
        affectedCollections: new Set(["foods"]),
        hasMore: false,
        pagesProcessed: 1,
      }
    })
    applyPulledChangesChunkMock.mockResolvedValue(new Set(["foods"]))

    const { syncNow } = await loadOrchestrator()
    await syncNow()

    const ensureInitialSyncTokenSource = ensureInitialSyncMock.mock.calls[0]?.[0]
    expect(typeof ensureInitialSyncTokenSource).toBe("function")
    expect(ensureInitialSyncMock).toHaveBeenCalledWith(expect.any(Function), "user-1")
    expect(pushPendingChangesInternalMock).toHaveBeenCalledWith(expect.any(Function), true)
    expect(applyPulledChangesChunkMock).toHaveBeenCalled()
    expect(finalizeAppliedPullChangesMock).toHaveBeenCalledWith(new Set(["foods"]))
    expect(setPullCursorMock).toHaveBeenCalledWith({ version: 1 })
    expect(useSyncStore.getState().status).toBe("success")
  })

  it("uses the latest auth token throughout a single sync session", async () => {
    setOnline(true)

    ensureInitialSyncMock.mockImplementationOnce(async (tokenSource: () => string) => {
      expect(tokenSource()).toBe("token")
      useAuthStore.setState({
        accessToken: "rotated-token",
        userId: "user-1",
        email: "u@example.com",
        expiresAtMs: Date.now() + 60_000,
        isAuthenticated: true,
      })
      return true
    })

    pushPendingChangesInternalMock.mockImplementationOnce(async (tokenSource: () => string) => {
      expect(tokenSource()).toBe("rotated-token")
    })

    pullAndProcessChangesMock.mockImplementationOnce(async (tokenSource: () => string, options?: { onPage?: (page: unknown) => Promise<void> }) => {
      expect(tokenSource()).toBe("rotated-token")
      if (options?.onPage) {
        await options.onPage({
          changes: [],
          cursor: { version: 3 },
          serverTimestampMs: 300,
          affectedCollections: new Set(),
          hasMore: false,
        })
      }
      return {
        cursor: { version: 3 },
        serverTimestampMs: 300,
        affectedCollections: new Set(),
        hasMore: false,
        pagesProcessed: 1,
      }
    })

    const { syncNow } = await loadOrchestrator()
    await syncNow()

    expect(pushPendingChangesInternalMock).toHaveBeenCalledTimes(1)
    expect(pullAndProcessChangesMock).toHaveBeenCalledTimes(1)
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

  it("retries transient SyncApiError responses (503)", async () => {
    vi.useFakeTimers()
    setOnline(true)
    ensureInitialSyncMock
      .mockRejectedValueOnce(new SyncApiError("temporarily unavailable", "SERVER_ERROR", 503))
      .mockRejectedValueOnce(new SyncApiError("temporarily unavailable", "SERVER_ERROR", 503))
      .mockResolvedValue(true)

    const { syncNow } = await loadOrchestrator()
    const syncPromise = syncNow()

    await vi.advanceTimersByTimeAsync(1_000)
    await vi.advanceTimersByTimeAsync(5_000)
    await syncPromise

    expect(ensureInitialSyncMock).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })

  it("does not retry non-retryable SyncApiError responses (400)", async () => {
    vi.useFakeTimers()
    setOnline(true)
    ensureInitialSyncMock.mockRejectedValue(new SyncApiError("invalid request", "INVALID_REQUEST", 400))

    const { syncNow } = await loadOrchestrator()
    const syncPromise = syncNow()
    await vi.advanceTimersByTimeAsync(30_000)
    await syncPromise

    expect(ensureInitialSyncMock).toHaveBeenCalledTimes(1)
    expect(handleSyncErrorMock).toHaveBeenCalledTimes(1)
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
    try {
      await new Promise((resolve) => setTimeout(resolve, 0))
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(pushPendingChangesInternalMock).toHaveBeenCalledTimes(1)
    } finally {
      resolveSync?.()
      await Promise.allSettled([first, second])
    }
  })

  it("delegates explicit initial-sync strategy resolution", async () => {
    setOnline(true)
    const { resolveInitialSync } = await loadOrchestrator()

    await resolveInitialSync("merge")

    expect(resolveInitialSyncStrategyMock).toHaveBeenCalledWith(expect.any(Function), "user-1", "merge")
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
    expect(useSyncStore.getState().status).toBe("offline")
  })

  it("routes pushPendingChanges failures through the error handler", async () => {
    vi.useFakeTimers()
    setOnline(true)
    pushPendingChangesInternalMock.mockRejectedValue(new Error("push failed"))
    handleSyncErrorMock.mockImplementation((error: unknown) => {
      const message = error instanceof Error ? error.message : "Sync failed"
      const store = useSyncStore.getState()
      store.setLastError(message)
      store.setStatus("error")
    })

    const { pushPendingChanges } = await loadOrchestrator()
    const syncPromise = pushPendingChanges()

    await vi.advanceTimersByTimeAsync(1_000)
    await vi.advanceTimersByTimeAsync(5_000)
    await vi.advanceTimersByTimeAsync(15_000)
    await syncPromise

    expect(handleSyncErrorMock).toHaveBeenCalledTimes(1)
    expect(useSyncStore.getState().status).toBe("error")
    expect(useSyncStore.getState().lastError).toBe("push failed")
    vi.useRealTimers()
  })

  it("pushPendingChanges pulls after pushing", async () => {
    setOnline(true)

    const { pushPendingChanges } = await loadOrchestrator()
    await pushPendingChanges()

    expect(pushPendingChangesInternalMock).toHaveBeenCalledWith(expect.any(Function), true)
    expect(pullAndProcessChangesMock).toHaveBeenCalledWith(expect.any(Function), expect.any(Object))
    expect(finalizeAppliedPullChangesMock).toHaveBeenCalled()
    expect(useSyncStore.getState().status).toBe("success")
  })
})
