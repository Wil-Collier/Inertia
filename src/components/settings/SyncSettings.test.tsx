import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SyncSettings } from "@/components/settings/SyncSettings"
import type { InitialSyncState, SyncStatus } from "@/features/sync/types"
import type { PushConflict } from "@/features/sync/schemas"

const toastErrorMock = vi.fn()

type SyncHookState = {
  auth: {
    isAuthenticated: boolean
    email: string | null
  }
  sync: {
    status: SyncStatus
    lastSyncedAtMs: number | null
    lastError: string | null
    pendingCount: number
    conflicts: PushConflict[]
    initialSyncState: InitialSyncState | null
  }
  signInWithGoogle: (idToken: string) => Promise<void>
  signOut: () => Promise<void>
  resolveInitialSync: (strategy: "merge" | "use-cloud" | "use-local") => Promise<void>
  syncNow: () => Promise<void>
  syncEnabled: boolean
}

let syncHookState: SyncHookState

vi.mock("@/features/sync/hooks", () => ({
  useSync: () => syncHookState,
}))

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}))

interface GoogleLoginProps {
  onSuccess: (response: { credential?: string }) => void
  onError?: () => void
}

vi.mock("@react-oauth/google", () => ({
  GoogleLogin: ({ onSuccess, onError }: GoogleLoginProps) => (
    <button
      type="button"
      onClick={() => onSuccess({ credential: "test-google-token" })}
      onContextMenu={(event) => {
        event.preventDefault()
        onError?.()
      }}
    >
      Google Login
    </button>
  ),
}))

interface SyncConflictDialogProps {
  open: boolean
  onResolve: (strategy: "merge" | "use-cloud" | "use-local") => void
}

vi.mock("@/components/settings/SyncConflictDialog", () => ({
  SyncConflictDialog: ({ open, onResolve }: SyncConflictDialogProps) => (
    <div data-testid="sync-conflict-dialog" data-open={open ? "true" : "false"}>
      <button type="button" onClick={() => onResolve("merge")}>
        Resolve Merge
      </button>
    </div>
  ),
}))

describe("SyncSettings", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()

    syncHookState = {
      auth: {
        isAuthenticated: false,
        email: null,
      },
      sync: {
        status: "idle",
        lastSyncedAtMs: null,
        lastError: null,
        pendingCount: 0,
        conflicts: [],
        initialSyncState: null,
      },
      signInWithGoogle: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
      resolveInitialSync: vi.fn().mockResolvedValue(undefined),
      syncNow: vi.fn().mockResolvedValue(undefined),
      syncEnabled: true,
    }

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    })
  })

  it("renders unauthenticated sync state", () => {
    render(<SyncSettings />)

    expect(screen.getByText("Cloud Sync")).toBeTruthy()
    expect(
      screen.getByText("Sync your workouts and nutrition across devices. Only approved Google accounts can sign in.")
    ).toBeTruthy()
  })

  it("renders authenticated sync controls and handles actions", async () => {
    const user = userEvent.setup()
    const syncNow = vi.fn().mockResolvedValue(undefined)
    const signOut = vi.fn().mockResolvedValue(undefined)

    syncHookState = {
      ...syncHookState,
      auth: {
        isAuthenticated: true,
        email: "athlete@example.com",
      },
      sync: {
        ...syncHookState.sync,
        pendingCount: 3,
      },
      syncNow,
      signOut,
    }

    render(<SyncSettings />)

    expect(screen.getByText("Signed in as")).toBeTruthy()
    expect(screen.getByText("athlete@example.com")).toBeTruthy()
    expect(screen.getByText("Pending changes: 3")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Sync Now" }))
    await user.click(screen.getByRole("button", { name: "Sign Out" }))

    expect(syncNow).toHaveBeenCalledTimes(1)
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it("shows offline banner and sync errors", () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    })

    syncHookState = {
      ...syncHookState,
      sync: {
        ...syncHookState.sync,
        status: "error",
        lastError: "sync failed",
      },
    }

    render(<SyncSettings />)

    expect(screen.getByText("sync failed")).toBeTruthy()
    expect(screen.getByText("Offline mode. Sync will resume when you reconnect.")).toBeTruthy()
  })

  it("toasts when sync status transitions into error", () => {
    const { rerender } = render(<SyncSettings />)

    syncHookState = {
      ...syncHookState,
      sync: {
        ...syncHookState.sync,
        status: "error",
        lastError: "sync failed",
      },
    }
    rerender(<SyncSettings />)

    expect(toastErrorMock).toHaveBeenCalledWith("sync failed")
  })
})
