import { describe, expect, it, vi } from "vitest"
import { pullAllChanges } from "@/features/sync/engine/pullPipeline"

const pullChangesMock = vi.fn()

vi.mock("@/features/sync/api", () => ({
  pullChanges: (...args: unknown[]) => pullChangesMock(...args),
}))

describe("pullPipeline", () => {
  it("pulls all pages and returns affected collections", async () => {
    pullChangesMock
      .mockResolvedValueOnce({
        changes: [
          { collection: "foods", id: "f1", data: { id: "f1" }, version: 1, deleted: false },
          { collection: "nutrition", id: "n1", data: { date: "2026-02-07", entries: [] }, version: 2, deleted: false },
        ],
        nextCursor: { version: 2 },
        hasMore: true,
        serverTimestampMs: 1000,
      })
      .mockResolvedValueOnce({
        changes: [{ collection: "foods", id: "f2", data: { id: "f2" }, version: 3, deleted: false }],
        nextCursor: { version: 3 },
        hasMore: false,
        serverTimestampMs: 2000,
      })

    const result = await pullAllChanges("token", { cursor: { version: 0 } })

    expect(result.changes).toHaveLength(3)
    expect(result.cursor).toEqual({ version: 3 })
    expect(result.serverTimestampMs).toBe(2000)
    expect(Array.from(result.affectedCollections).toSorted()).toEqual(["foods", "nutrition"])
    expect(pullChangesMock).toHaveBeenCalledTimes(2)
  })

  it("returns original cursor when no changes are returned", async () => {
    pullChangesMock.mockResolvedValueOnce({
      changes: [],
      nextCursor: null,
      hasMore: false,
      serverTimestampMs: 1234,
    })

    const result = await pullAllChanges("token", { cursor: { version: 5 } })

    expect(result.changes).toEqual([])
    expect(result.cursor).toEqual({ version: 5 })
  })
})
