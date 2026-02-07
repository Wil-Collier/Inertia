import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useTheme } from "@/hooks/useTheme"

const mutateMock = vi.fn()
const useSettingsMock = vi.fn()
const useUpdateSettingsMock = vi.fn(() => ({ mutate: mutateMock }))

type Listener = (event: { matches: boolean }) => void
let mediaListener: Listener | null = null
let mediaMatches = false

vi.mock("@/features/settings/queries", () => ({
  useSettings: () => useSettingsMock(),
}))

vi.mock("@/features/settings/mutations", () => ({
  useUpdateSettings: () => useUpdateSettingsMock(),
}))

describe("useTheme", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.documentElement.className = ""

    mediaMatches = false
    mediaListener = null
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: mediaMatches,
        media: "(prefers-color-scheme: dark)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: (_event: string, listener: Listener) => {
          mediaListener = listener
        },
        removeEventListener: () => {
          mediaListener = null
        },
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it("defaults to system theme and follows OS dark preference", () => {
    mediaMatches = true
    useSettingsMock.mockReturnValue({ data: undefined })

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe("system")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("reacts to system theme changes while using system mode", () => {
    mediaMatches = false
    useSettingsMock.mockReturnValue({ data: { theme: "system" } })

    renderHook(() => useTheme())
    expect(document.documentElement.classList.contains("dark")).toBe(false)

    act(() => {
      mediaListener?.({ matches: true })
    })
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("applies explicit dark/light themes and updates settings through setTheme", () => {
    useSettingsMock.mockReturnValue({ data: { theme: "dark" } })
    const { result, rerender } = renderHook(() => useTheme())

    expect(document.documentElement.classList.contains("dark")).toBe(true)

    act(() => {
      result.current.setTheme("light")
    })
    expect(mutateMock).toHaveBeenCalledWith({ theme: "light" })

    useSettingsMock.mockReturnValue({ data: { theme: "light" } })
    rerender()
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })
})
