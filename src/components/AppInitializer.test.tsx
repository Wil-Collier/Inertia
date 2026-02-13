import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AppInitializer } from "@/components/AppInitializer"
import * as dbModule from "@/services/db"
import { achievementService } from "@/services/achievementService"
import { statsService } from "@/services/statsService"
import * as dexieHooksModule from "@/features/sync/dexieHooks"
import * as syncApiModule from "@/features/sync/api"
import { resetTestRuntime } from "@/test/helpers/resetTestRuntime"

vi.mock("@/features/sync/useSyncTriggers", () => ({
  useSyncTriggers: () => undefined,
}))

vi.mock("@/features/sync/useDebouncedPush", () => ({
  useDebouncedPush: () => undefined,
}))

let ensureInitializedSpy: ReturnType<typeof vi.spyOn>
let updateStreaksSpy: ReturnType<typeof vi.spyOn>
let recalculateAllSpy: ReturnType<typeof vi.spyOn>

describe("AppInitializer", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(async () => {
    vi.restoreAllMocks()
    await resetTestRuntime()

    vi.spyOn(dbModule, "isDatabaseHealthy").mockResolvedValue(true)
    vi.spyOn(dbModule, "recoverDatabase").mockResolvedValue()
    ensureInitializedSpy = vi.spyOn(achievementService, "ensureInitialized").mockResolvedValue()
    updateStreaksSpy = vi.spyOn(achievementService, "updateStreaks").mockResolvedValue()
    recalculateAllSpy = vi.spyOn(statsService, "recalculateAll").mockResolvedValue({
      totalWorkouts: 0,
      totalVolumeLbs: 0,
      lastUpdated: new Date(0).toISOString(),
    })
    vi.spyOn(dexieHooksModule, "registerSyncDexieHooks").mockImplementation(() => undefined)
    vi.spyOn(syncApiModule, "restoreSession").mockResolvedValue(false)
  })

  it("renders children after successful initialization", async () => {
    render(
      <AppInitializer>
        <div>ready-state</div>
      </AppInitializer>
    )

    await screen.findByText("ready-state")

    expect(dexieHooksModule.registerSyncDexieHooks).toHaveBeenCalledTimes(1)
    expect(syncApiModule.restoreSession).toHaveBeenCalledTimes(1)
    expect(ensureInitializedSpy).toHaveBeenCalled()
    expect(updateStreaksSpy).toHaveBeenCalledTimes(1)
    expect(recalculateAllSpy).toHaveBeenCalledTimes(1)
  })

  it("shows corruption prompt when health check reports unhealthy", async () => {
    vi.spyOn(dbModule, "isDatabaseHealthy").mockResolvedValue(false)

    render(
      <AppInitializer>
        <div>ready-state</div>
      </AppInitializer>
    )

    expect(await screen.findByText("Database Issue Detected")).toBeTruthy()
    expect(screen.queryByText("ready-state")).toBeNull()
  })

  it("shows critical error card when initialization throws unexpected error", async () => {
    vi.spyOn(dbModule, "isDatabaseHealthy").mockRejectedValue(new Error("fatal init error"))

    render(
      <AppInitializer>
        <div>ready-state</div>
      </AppInitializer>
    )

    expect(await screen.findByText("Critical Error")).toBeTruthy()
    expect(screen.getByText("fatal init error")).toBeTruthy()
  })

  it("invokes recovery flow from corruption prompt", async () => {
    const user = userEvent.setup()
    const recoverSpy = vi.spyOn(dbModule, "recoverDatabase").mockResolvedValue()

    vi.spyOn(dbModule, "isDatabaseHealthy").mockResolvedValue(false)

    render(
      <AppInitializer>
        <div>ready-state</div>
      </AppInitializer>
    )

    await user.click(await screen.findByRole("button", { name: "Reset Database" }))

    await waitFor(() => {
      expect(recoverSpy).toHaveBeenCalledTimes(1)
    })
  })

  it("shows critical error when recovery fails", async () => {
    const user = userEvent.setup()
    vi.spyOn(dbModule, "isDatabaseHealthy").mockResolvedValue(false)
    vi.spyOn(dbModule, "recoverDatabase").mockRejectedValueOnce(new Error("recover failed"))

    render(
      <AppInitializer>
        <div>ready-state</div>
      </AppInitializer>
    )

    await user.click(await screen.findByRole("button", { name: "Reset Database" }))

    expect(await screen.findByText("Critical Error")).toBeTruthy()
    expect(screen.getByText("recover failed")).toBeTruthy()
  })
})
