import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SyncSettings } from "@/components/settings/SyncSettings"
import { useAuthStore, useSyncStore } from "@/features/sync/store"
import * as syncApiModule from "@/features/sync/api"
import * as syncEngineModule from "@/features/sync/syncEngine"
import * as changeTrackerModule from "@/features/sync/changeTracker"
import { resetTestRuntime } from "@/test/helpers/resetTestRuntime"

const toastErrorMock = vi.fn()
const toastInfoMock = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    info: (...args: unknown[]) => toastInfoMock(...args),
  },
}))

interface GoogleLoginProps {
  onSuccess: (response: { credential?: string }) => void
  onError?: () => void
}

vi.mock("@react-oauth/google", () => ({
  GoogleLogin: ({ onSuccess, onError }: GoogleLoginProps) => (
    <div>
      <button
        type="button"
        onClick={() => onSuccess({ credential: "test-google-token" })}
      >
        Google Login
      </button>
      <button
        type="button"
        onClick={() => onSuccess({})}
      >
        Google Login Missing Credential
      </button>
      <button
        type="button"
        onContextMenu={(event) => {
          event.preventDefault()
          onError?.()
        }}
      >
        Google Login Error
      </button>
    </div>
  ),
}))

describe("SyncSettings", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(async () => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    await resetTestRuntime()

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    })

    useAuthStore.setState({
      accessToken: null,
      userId: null,
      email: null,
      expiresAtMs: null,
      isAuthenticated: false,
    })

    useSyncStore.setState({
      status: "idle",
      lastSyncedAtMs: null,
      lastError: null,
      pendingCount: 0,
      conflicts: [],
      initialSyncState: null,
    })

    vi.spyOn(syncApiModule, "loginWithGoogle").mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "athlete@example.com",
      expiresAtMs: Date.now() + 60 * 60 * 1000,
    })
    vi.spyOn(syncApiModule, "logoutSession").mockResolvedValue({ success: true })
    vi.spyOn(syncEngineModule, "syncNow").mockResolvedValue()
    vi.spyOn(syncEngineModule, "resolveInitialSync").mockResolvedValue()
    vi.spyOn(changeTrackerModule, "clearSyncMetadata").mockResolvedValue()
  })

  it("renders unauthenticated sync state", () => {
    render(<SyncSettings />)

    expect(screen.getByText("Cloud Sync")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Google Login" })).toBeTruthy()
    expect(
      screen.getByText(
        "Sync keeps workouts and nutrition aligned across devices. Food search works without sign-in."
      )
    ).toBeTruthy()
  })

  it("signs in with Google and triggers sync", async () => {
    const user = userEvent.setup()

    render(<SyncSettings />)
    await user.click(screen.getByRole("button", { name: "Google Login" }))

    await waitFor(() => {
      expect(syncApiModule.loginWithGoogle).toHaveBeenCalledWith("test-google-token")
      expect(syncEngineModule.syncNow).toHaveBeenCalledTimes(1)
    })

    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().email).toBe("athlete@example.com")
  })

  it("shows a toast when Google sign-in flow errors before credential delivery", () => {
    render(<SyncSettings />)
    fireEvent.contextMenu(screen.getByRole("button", { name: "Google Login Error" }))

    expect(toastErrorMock).toHaveBeenCalledWith("Google sign-in failed")
  })

  it("shows a toast when credential is missing", async () => {
    const user = userEvent.setup()

    render(<SyncSettings />)
    await user.click(screen.getByRole("button", { name: "Google Login Missing Credential" }))

    expect(toastErrorMock).toHaveBeenCalledWith("Google sign-in failed")
    expect(syncApiModule.loginWithGoogle).not.toHaveBeenCalled()
  })

  it("shows a toast when Google sign-in promise rejects", async () => {
    const user = userEvent.setup()
    vi.spyOn(syncApiModule, "loginWithGoogle").mockRejectedValueOnce(new Error("Sign-in blocked"))

    render(<SyncSettings />)
    await user.click(screen.getByRole("button", { name: "Google Login" }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Sign-in blocked")
    })
  })

  it("renders authenticated sync controls and handles actions", async () => {
    const user = userEvent.setup()

    useAuthStore.setState({
      accessToken: "token-1",
      userId: "user-1",
      email: "athlete@example.com",
      expiresAtMs: Date.now() + 60 * 60 * 1000,
      isAuthenticated: true,
    })

    useSyncStore.setState({
      status: "idle",
      lastSyncedAtMs: null,
      lastError: null,
      pendingCount: 3,
      conflicts: [],
      initialSyncState: null,
    })

    render(<SyncSettings />)

    expect(screen.getByText("Signed in as")).toBeTruthy()
    expect(screen.getByText("athlete@example.com")).toBeTruthy()
    expect(screen.getByText("Pending changes: 3")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Sync Now" }))
    await user.click(screen.getByRole("button", { name: "Sign Out" }))

    await waitFor(() => {
      expect(syncEngineModule.syncNow).toHaveBeenCalledTimes(1)
      expect(syncApiModule.logoutSession).toHaveBeenCalledTimes(1)
      expect(changeTrackerModule.clearSyncMetadata).toHaveBeenCalledTimes(1)
    })

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it("shows offline banner and sync errors", () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    })

    useSyncStore.setState({
      status: "error",
      lastSyncedAtMs: null,
      lastError: "sync failed",
      pendingCount: 0,
      conflicts: [],
      initialSyncState: null,
    })

    render(<SyncSettings />)

    expect(screen.getByText("sync failed")).toBeTruthy()
    expect(screen.getByText("Offline mode. Sync will resume when you reconnect.")).toBeTruthy()
  })

  it("routes initial sync conflict resolution strategy to sync hook", async () => {
    const user = userEvent.setup()

    useAuthStore.setState({
      accessToken: "token-1",
      userId: "user-1",
      email: "athlete@example.com",
      expiresAtMs: Date.now() + 60 * 60 * 1000,
      isAuthenticated: true,
    })

    useSyncStore.setState({
      status: "idle",
      lastSyncedAtMs: null,
      lastError: null,
      pendingCount: 0,
      conflicts: [],
      initialSyncState: {
        localHasData: true,
        cloudHasData: true,
      },
    })

    render(<SyncSettings />)

    await user.click(screen.getByRole("button", { name: "Merge Cloud + Local" }))

    await waitFor(() => {
      expect(syncEngineModule.resolveInitialSync).toHaveBeenCalledWith("merge")
    })
  })

  it("toasts when sync status transitions into error", async () => {
    render(<SyncSettings />)

    useSyncStore.setState({
      status: "error",
      lastSyncedAtMs: null,
      lastError: "sync failed",
      pendingCount: 0,
      conflicts: [],
      initialSyncState: null,
    })

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("sync failed")
    })
  })
})
