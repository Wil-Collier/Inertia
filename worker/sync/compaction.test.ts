import { describe, expect, it, vi } from "vitest"
import { compactSyncEvents } from "./compaction"

describe("sync event compaction", () => {
  it("runs a bounded delete query and returns deleted row count", async () => {
    const run = vi.fn().mockResolvedValue({ meta: { changes: 7 } })
    const bind = vi.fn().mockReturnValue({ run })
    const prepare = vi.fn().mockReturnValue({ bind })

    const deleted = await compactSyncEvents(
      { prepare },
      { retentionDays: 14, deleteBatchSize: 100 }
    )

    expect(prepare).toHaveBeenCalled()
    expect(bind).toHaveBeenCalledWith(expect.any(Number), 100)
    expect(deleted).toBe(7)
  })
})
