import { beforeEach, describe, expect, it } from "vitest"
import { clearDatabase } from "@/test/helpers/dbTestUtils"

describe("lastSyncedAtMs persistence", () => {
    beforeEach(async () => {
        await clearDatabase()
    })

    it("reads and writes lastSyncedAtMs consistently with JSON serialization", async () => {
        const { setLastSyncedAtMs, getLastSyncedAtMs } = await import("@/features/sync/tracking/changeTracker")

        const timestamp = 1707456000000
        await setLastSyncedAtMs(timestamp)
        const retrieved = await getLastSyncedAtMs()

        expect(retrieved).toBe(timestamp)
    })

    it("returns null when lastSyncedAtMs has not been set", async () => {
        const { getLastSyncedAtMs } = await import("@/features/sync/tracking/changeTracker")

        const retrieved = await getLastSyncedAtMs()
        expect(retrieved).toBeNull()
    })

    it("overwrites existing timestamp with new value", async () => {
        const { setLastSyncedAtMs, getLastSyncedAtMs } = await import("@/features/sync/tracking/changeTracker")

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
        const { setPullCursor, getPullCursor } = await import("@/features/sync/tracking/changeTracker")

        await setPullCursor({ version: 42 })
        const retrieved = await getPullCursor()

        expect(retrieved).toEqual({ version: 42 })
    })

    it("returns null when no cursor has been set", async () => {
        const { getPullCursor } = await import("@/features/sync/tracking/changeTracker")

        const retrieved = await getPullCursor()
        expect(retrieved).toBeNull()
    })

    it("can clear cursor by setting null", async () => {
        const { setPullCursor, getPullCursor } = await import("@/features/sync/tracking/changeTracker")

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
        const { setLocalDataOwnerUserId, getLocalDataOwnerUserId } = await import("@/features/sync/tracking/changeTracker")

        await setLocalDataOwnerUserId("user-123")
        const retrieved = await getLocalDataOwnerUserId()

        expect(retrieved).toBe("user-123")
    })

    it("returns null when no owner has been set", async () => {
        const { getLocalDataOwnerUserId } = await import("@/features/sync/tracking/changeTracker")

        const retrieved = await getLocalDataOwnerUserId()
        expect(retrieved).toBeNull()
    })
})
