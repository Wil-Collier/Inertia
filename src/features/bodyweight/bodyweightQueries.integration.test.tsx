import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"
import { useBodyWeightHistory, useLatestBodyWeight } from "@/features/bodyweight/queries"

describe("bodyweight queries integration", () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  it("returns newest-first bodyweight history with applied limit", async () => {
    await db.bodyWeight.bulkPut([
      { id: "w1", date: "2026-02-05", weight: 182 },
      { id: "w2", date: "2026-02-06", weight: 181.5 },
      { id: "w3", date: "2026-02-07", weight: 181 },
    ])

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useBodyWeightHistory(2), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.map((entry) => entry.id)).toEqual(["w3", "w2"])
  })

  it("returns latest bodyweight entry", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    await db.bodyWeight.bulkPut([
      { id: "w1", date: "2026-02-05", weight: 182 },
      { id: "w3", date: "2026-02-07", weight: 181 },
    ])

    const latestHook = renderHook(() => useLatestBodyWeight(), { wrapper })
    await waitFor(() => {
      expect(latestHook.result.current.isSuccess).toBe(true)
    })
    expect(latestHook.result.current.data?.id).toBe("w3")
  })
})
