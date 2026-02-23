import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { useTheme } from "@/hooks/useTheme"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"

type Listener = (event: { matches: boolean }) => void
let mediaListener: Listener | null = null
let mediaMatches = false

// matchMedia is a browser API not available in jsdom — must be stubbed.
function setupMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: mediaMatches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_event: string, listener: Listener) => {
        mediaListener = listener
      },
      removeEventListener: () => {
        mediaListener = null
      },
      dispatchEvent: () => false,
    }),
  })
}

describe("useTheme", () => {
  beforeEach(async () => {
    await clearDatabase()
    document.documentElement.className = ""
    mediaMatches = false
    mediaListener = null
    setupMatchMedia()
  })

  afterEach(() => {
    document.documentElement.className = ""
  })

  it("defaults to system theme and follows OS dark preference", async () => {
    mediaMatches = true
    setupMatchMedia()

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useTheme(), { wrapper })

    // No settings seeded — defaults to system
    await waitFor(() => {
      expect(result.current.theme).toBe("system")
    })
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("reacts to system theme changes while using system mode", async () => {
    mediaMatches = false
    setupMatchMedia()

    await db.settings.put({
      id: "settings",
      theme: "system",
      restTimerDuration: 90,
      progressiveOverloadEnabled: true,
      areNotificationsEnabled: false,
      unitPreferences: { weight: "kg", distance: "km" },
      nutritionGoals: { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 },
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    renderHook(() => useTheme(), { wrapper })

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false)
    })

    act(() => {
      mediaListener?.({ matches: true })
    })
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("applies explicit dark theme and persists new theme via setTheme", async () => {
    await db.settings.put({
      id: "settings",
      theme: "dark",
      restTimerDuration: 90,
      progressiveOverloadEnabled: true,
      areNotificationsEnabled: false,
      unitPreferences: { weight: "kg", distance: "km" },
      nutritionGoals: { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 },
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useTheme(), { wrapper })

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true)
    })

    await act(async () => {
      result.current.setTheme("light")
    })

    await waitFor(async () => {
      const saved = await db.settings.get("settings")
      expect(saved?.theme).toBe("light")
    })

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false)
    })
  })
})
