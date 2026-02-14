import { describe, expect, it } from "vitest"
import { INITIAL_SYNC_POLICY, shouldAcknowledgePushConflict } from "@/features/sync/conflictPolicy"

describe("sync conflict policy", () => {
  it("acknowledges push conflicts that are explicitly defined by policy", () => {
    expect(
      shouldAcknowledgePushConflict({
        collection: "foods",
        id: "food-1",
        serverVersion: 2,
        clientBaseVersion: 1,
        reason: "VERSION_MISMATCH",
      })
    ).toBe(true)
  })

  it("acknowledges pending changes even for unknown conflict reasons", () => {
    expect(
      shouldAcknowledgePushConflict({
        collection: "foods",
        id: "food-1",
        serverVersion: 2,
        clientBaseVersion: 1,
        reason: "SOMETHING_NEW",
      })
    ).toBe(true)
  })

  it("defines explicit data ownership behavior for every initial sync strategy", () => {
    expect(INITIAL_SYNC_POLICY.merge).toEqual({
      localBehavior: "keep",
      cloudBehavior: "keep",
      conflictBehavior: "manual-resolution",
    })
    expect(INITIAL_SYNC_POLICY["use-cloud"]).toEqual({
      localBehavior: "replace",
      cloudBehavior: "keep",
      conflictBehavior: "overwrite-local",
    })
    expect(INITIAL_SYNC_POLICY["use-local"]).toEqual({
      localBehavior: "keep",
      cloudBehavior: "replace",
      conflictBehavior: "overwrite-cloud",
    })
  })
})
