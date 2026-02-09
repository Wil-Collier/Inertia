import { beforeEach, describe, expect, it } from "vitest"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { useAuthStore, useSyncStore } from "@/features/sync/store"

// These tests verify edge case behaviors for the sync system.
// They use real Zustand stores but test the store state management directly.

describe("sync store state management", () => {
    beforeEach(async () => {
        await clearDatabase()

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

    describe("status transitions", () => {
        it("setStatus updates the sync status", () => {
            useSyncStore.getState().setStatus("syncing")
            expect(useSyncStore.getState().status).toBe("syncing")

            useSyncStore.getState().setStatus("success")
            expect(useSyncStore.getState().status).toBe("success")

            useSyncStore.getState().setStatus("error")
            expect(useSyncStore.getState().status).toBe("error")

            useSyncStore.getState().setStatus("offline")
            expect(useSyncStore.getState().status).toBe("offline")

            useSyncStore.getState().setStatus("idle")
            expect(useSyncStore.getState().status).toBe("idle")
        })

        it("setConflicts stores and retrieves conflicts correctly", () => {
            const conflicts = [
                { collection: "foods" as const, id: "f1", serverVersion: 2, clientBaseVersion: 1, reason: "VERSION_MISMATCH" },
                { collection: "workouts" as const, id: "w1", serverVersion: 5, clientBaseVersion: 3, reason: "VERSION_MISMATCH" },
            ]

            useSyncStore.getState().setConflicts(conflicts)
            expect(useSyncStore.getState().conflicts).toEqual(conflicts)
        })

        it("clearing conflicts sets empty array", () => {
            useSyncStore.getState().setConflicts([
                { collection: "foods" as const, id: "f1", serverVersion: 2, clientBaseVersion: 1, reason: "VERSION_MISMATCH" },
            ])

            useSyncStore.getState().setConflicts([])
            expect(useSyncStore.getState().conflicts).toEqual([])
        })

        it("setLastError stores error messages", () => {
            useSyncStore.getState().setLastError("Network timeout")
            expect(useSyncStore.getState().lastError).toBe("Network timeout")

            useSyncStore.getState().setLastError(null)
            expect(useSyncStore.getState().lastError).toBeNull()
        })

        it("setLastSyncedAtMs stores timestamp", () => {
            const timestamp = Date.now()
            useSyncStore.getState().setLastSyncedAtMs(timestamp)
            expect(useSyncStore.getState().lastSyncedAtMs).toBe(timestamp)
        })

        it("setPendingCount updates pending count", () => {
            useSyncStore.getState().setPendingCount(5)
            expect(useSyncStore.getState().pendingCount).toBe(5)

            useSyncStore.getState().setPendingCount(0)
            expect(useSyncStore.getState().pendingCount).toBe(0)
        })
    })

    describe("auth store state", () => {
        it("clearAuth resets all auth state", () => {
            useAuthStore.getState().clearAuth()

            const state = useAuthStore.getState()
            expect(state.accessToken).toBeNull()
            expect(state.userId).toBeNull()
            expect(state.email).toBeNull()
            expect(state.expiresAtMs).toBeNull()
            expect(state.isAuthenticated).toBe(false)
        })

        it("setAuth updates all auth fields", () => {
            const expiresAt = Date.now() + 60_000
            useAuthStore.getState().setAuth({
                accessToken: "new-token",
                userId: "new-user",
                email: "new@example.com",
                expiresAtMs: expiresAt,
            })

            const state = useAuthStore.getState()
            expect(state.accessToken).toBe("new-token")
            expect(state.userId).toBe("new-user")
            expect(state.email).toBe("new@example.com")
            expect(state.expiresAtMs).toBe(expiresAt)
            expect(state.isAuthenticated).toBe(true)
        })
    })
})

describe("lastSyncedAtMs persistence", () => {
    beforeEach(async () => {
        await clearDatabase()
    })

    it("reads and writes lastSyncedAtMs consistently with JSON serialization", async () => {
        const { setLastSyncedAtMs, getLastSyncedAtMs } = await import("@/features/sync/changeTracker")

        const timestamp = 1707456000000
        await setLastSyncedAtMs(timestamp)
        const retrieved = await getLastSyncedAtMs()

        expect(retrieved).toBe(timestamp)
    })

    it("returns null when lastSyncedAtMs has not been set", async () => {
        const { getLastSyncedAtMs } = await import("@/features/sync/changeTracker")

        const retrieved = await getLastSyncedAtMs()
        expect(retrieved).toBeNull()
    })

    it("overwrites existing timestamp with new value", async () => {
        const { setLastSyncedAtMs, getLastSyncedAtMs } = await import("@/features/sync/changeTracker")

        await setLastSyncedAtMs(1000)
        await setLastSyncedAtMs(2000)
        const retrieved = await getLastSyncedAtMs()

        expect(retrieved).toBe(2000)
    })
})

describe("pull cursor persistence", () => {
    beforeEach(async () => {
        await clearDatabase()
    })

    it("reads and writes pull cursor correctly", async () => {
        const { setPullCursor, getPullCursor } = await import("@/features/sync/changeTracker")

        await setPullCursor({ version: 42 })
        const retrieved = await getPullCursor()

        expect(retrieved).toEqual({ version: 42 })
    })

    it("returns null when no cursor has been set", async () => {
        const { getPullCursor } = await import("@/features/sync/changeTracker")

        const retrieved = await getPullCursor()
        expect(retrieved).toBeNull()
    })

    it("can clear cursor by setting null", async () => {
        const { setPullCursor, getPullCursor } = await import("@/features/sync/changeTracker")

        await setPullCursor({ version: 10 })
        await setPullCursor(null)
        const retrieved = await getPullCursor()

        expect(retrieved).toBeNull()
    })
})

describe("local data owner tracking", () => {
    beforeEach(async () => {
        await clearDatabase()
    })

    it("tracks the user who owns local data", async () => {
        const { setLocalDataOwnerUserId, getLocalDataOwnerUserId } = await import("@/features/sync/changeTracker")

        await setLocalDataOwnerUserId("user-123")
        const retrieved = await getLocalDataOwnerUserId()

        expect(retrieved).toBe("user-123")
    })

    it("returns null when no owner has been set", async () => {
        const { getLocalDataOwnerUserId } = await import("@/features/sync/changeTracker")

        const retrieved = await getLocalDataOwnerUserId()
        expect(retrieved).toBeNull()
    })
})
