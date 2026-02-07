import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AppInitializer } from "@/components/AppInitializer"

const isDatabaseHealthyMock = vi.fn()
const recoverDatabaseMock = vi.fn()
const ensureInitializedMock = vi.fn()
const updateStreaksMock = vi.fn()
const recalculateAllMock = vi.fn()
const registerSyncDexieHooksMock = vi.fn()

vi.mock("@/services/db", () => ({
  isDatabaseHealthy: (...args: unknown[]) => isDatabaseHealthyMock(...args),
  recoverDatabase: (...args: unknown[]) => recoverDatabaseMock(...args),
}))

vi.mock("@/services/achievementService", () => ({
  achievementService: {
    ensureInitialized: (...args: unknown[]) => ensureInitializedMock(...args),
    updateStreaks: (...args: unknown[]) => updateStreaksMock(...args),
  },
}))

vi.mock("@/services/statsService", () => ({
  statsService: {
    recalculateAll: (...args: unknown[]) => recalculateAllMock(...args),
  },
}))

vi.mock("@/features/sync/dexieHooks", () => ({
  registerSyncDexieHooks: (...args: unknown[]) => registerSyncDexieHooksMock(...args),
}))

vi.mock("@/features/sync/useSyncTriggers", () => ({
  useSyncTriggers: () => undefined,
}))

vi.mock("@/features/sync/useDebouncedPush", () => ({
  useDebouncedPush: () => undefined,
}))

vi.mock("@/features/sync/syncEngine", () => ({
  SYNC_ENABLED: true,
}))

describe("AppInitializer", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    isDatabaseHealthyMock.mockReset().mockResolvedValue(true)
    recoverDatabaseMock.mockReset().mockResolvedValue(undefined)
    ensureInitializedMock.mockReset().mockResolvedValue(undefined)
    updateStreaksMock.mockReset().mockResolvedValue(undefined)
    recalculateAllMock.mockReset().mockResolvedValue(undefined)
    registerSyncDexieHooksMock.mockReset()
  })

  it("renders children after successful initialization", async () => {
    render(
      <AppInitializer>
        <div>ready-state</div>
      </AppInitializer>
    )

    await screen.findByText("ready-state")

    expect(registerSyncDexieHooksMock).toHaveBeenCalled()
    expect(ensureInitializedMock).toHaveBeenCalled()
    expect(updateStreaksMock).toHaveBeenCalled()
    expect(recalculateAllMock).toHaveBeenCalled()
  })

  it("shows corruption prompt when health check reports unhealthy", async () => {
    isDatabaseHealthyMock.mockResolvedValue(false)

    render(
      <AppInitializer>
        <div>ready-state</div>
      </AppInitializer>
    )

    expect(await screen.findByText("Database Issue Detected")).toBeTruthy()
    expect(screen.queryByText("ready-state")).toBeNull()
  })

  it("shows critical error card when initialization throws unexpected error", async () => {
    isDatabaseHealthyMock.mockRejectedValue(new Error("fatal init error"))

    render(
      <AppInitializer>
        <div>ready-state</div>
      </AppInitializer>
    )

    expect(await screen.findByText("Critical Error")).toBeTruthy()
    expect(screen.getByText("fatal init error")).toBeTruthy()
  })

  it("invokes recovery flow from corruption prompt", async () => {
    isDatabaseHealthyMock.mockResolvedValue(false)
    const user = userEvent.setup()

    render(
      <AppInitializer>
        <div>ready-state</div>
      </AppInitializer>
    )

    await screen.findByText("Database Issue Detected")
    const buttons = screen.getAllByRole("button", { name: "Reset Database" })
    await user.click(buttons[0])

    await waitFor(() => {
      expect(recoverDatabaseMock).toHaveBeenCalled()
    })
  })
})
