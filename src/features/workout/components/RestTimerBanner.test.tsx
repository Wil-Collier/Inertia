import { act, cleanup, fireEvent, render as rtlRender, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RestTimerBanner } from "@/features/workout/components/RestTimerBanner"
import { useRestTimerStore } from "@/features/workout/restTimerStore"
import { resetTestRuntime } from "@/test/helpers/resetTestRuntime"
import { seedTestState } from "@/test/helpers/seedTestState"
import { createSettings } from "@/test/factories/settingsFactory"

// Only mock true external boundaries - browser APIs not available in jsdom
// Per AGENTS.md: "Mock only true external boundaries... Browser/hardware APIs not available in jsdom"
vi.mock("@/services/notifications", () => ({
  showRestTimerNotification: vi.fn(),
  canShowNotifications: () => false,
}))

vi.mock("@/lib/audio", () => ({
  playDingSound: vi.fn(),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  })
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient()
  return rtlRender(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe("RestTimerBanner", () => {
  beforeEach(async () => {
    // Use real timers during async Dexie setup
    vi.useRealTimers()
    useRestTimerStore.getState().reset()
    await resetTestRuntime()
    await seedTestState({
      settings: createSettings({ areNotificationsEnabled: false }),
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    useRestTimerStore.getState().reset()
  })

  it("adds 30 seconds to remaining time instead of the original duration", async () => {
    // Switch to fake timers after async setup is complete
    vi.useFakeTimers()

    renderWithProviders(<RestTimerBanner defaultDuration={60} />)

    act(() => {
      useRestTimerStore.getState().start(60)
    })

    await act(async () => {
      vi.advanceTimersByTime(20_000)
    })

    expect(screen.queryByText("00:40")).not.toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "+30s" }))

    expect(screen.queryByText("01:10")).not.toBeNull()
  })

  it("toggles pause and resume while keeping paused time stable", async () => {
    // Switch to fake timers after async setup is complete
    vi.useFakeTimers()

    renderWithProviders(<RestTimerBanner defaultDuration={60} />)

    act(() => {
      useRestTimerStore.getState().start(60)
    })

    fireEvent.click(screen.getByRole("button", { name: "Pause" }))
    expect(screen.queryByRole("button", { name: "Resume" })).not.toBeNull()

    const pausedTimerText = screen.getByText(/\d\d:\d\d/).textContent
    await act(async () => {
      vi.advanceTimersByTime(5_000)
    })
    expect(screen.getByText(/\d\d:\d\d/).textContent).toBe(pausedTimerText)

    fireEvent.click(screen.getByRole("button", { name: "Resume" }))
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(1_200)
    })
    expect(screen.getByText(/\d\d:\d\d/).textContent).not.toBe(pausedTimerText)
  })
})
