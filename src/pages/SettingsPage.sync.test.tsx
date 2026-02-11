import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { cleanup, screen, waitFor } from "@testing-library/react"
import { SettingsPage } from "@/pages/SettingsPage"
import { createSettings } from "@/test/factories/settingsFactory"
import { renderAppRoute } from "@/test/helpers/renderAppRoute"
import { resetTestRuntime } from "@/test/helpers/resetTestRuntime"
import { seedTestState } from "@/test/helpers/seedTestState"

// Mock dependencies
vi.mock("@/services/notifications", () => ({
    isNotificationSupported: () => true,
    getNotificationPermission: () => "default",
    requestNotificationPermission: vi.fn().mockResolvedValue("granted"),
}))

vi.mock("@react-oauth/google", () => ({
    GoogleLogin: () => <div data-testid="google-login">Sign in with Google</div>,
    GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useGoogleOAuth: () => ({ clientId: "mock-client-id" }),
}))

// Mock data export service
const mockClearAllData = vi.fn().mockResolvedValue(undefined)
vi.mock("@/services/dataExport", () => ({
    clearAllData: mockClearAllData,
    downloadExport: vi.fn(),
    importData: vi.fn(),
}))

// Mock useSync
const mockResetCloudData = vi.fn().mockResolvedValue({ success: true })
const mockUseSync = vi.fn()

vi.mock("@/features/sync/hooks", () => ({
    useSync: () => mockUseSync(),
}))

// Fix window.matchMedia
Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
        matches: false,
        media: "(prefers-color-scheme: dark)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
})

function SettingsPageWrapper() {
    return <SettingsPage />
}

async function renderSettingsRoute() {
    return await renderAppRoute({
        initialPath: "/settings",
        routes: [{ path: "/settings", component: SettingsPageWrapper }],
    })
}

describe("SettingsPage Cloud Deletion", () => {
    afterEach(() => {
        cleanup()
        vi.clearAllMocks()
    })

    beforeEach(async () => {
        await resetTestRuntime()
        await seedTestState({
            settings: createSettings(),
        })
    })

    it("calls resetCloudData when authenticated and user confirms deletion", async () => {
        // Mock authenticated state
        mockUseSync.mockReturnValue({
            auth: { isAuthenticated: true },
            sync: { status: "idle", lastError: null, conflicts: [] },
            resetCloudData: mockResetCloudData,
            syncEnabled: true,
        })

        const user = userEvent.setup()
        await renderSettingsRoute()

        // Open clear data dialog
        await user.click(await screen.findByRole("button", { name: /Clear All Data/i }))

        // Check for warning message
        expect(await screen.findByText(/This will permanently delete/)).toBeTruthy()
        expect(screen.getByText(/Since you are signed in/)).toBeTruthy()

        // Confirm deletion
        await user.click(screen.getByRole("button", { name: "Delete Everything" }))

        // Verify cloud reset was called
        await waitFor(() => {
            expect(mockResetCloudData).toHaveBeenCalled()
        })

        // Verify local clear was called
        await waitFor(() => {
            expect(mockClearAllData).toHaveBeenCalled()
        })
    })

    it("does NOT call resetCloudData when NOT authenticated", async () => {
        // Mock unauthenticated state
        mockUseSync.mockReturnValue({
            auth: { isAuthenticated: false },
            sync: { status: "idle", lastError: null, conflicts: [] },
            resetCloudData: mockResetCloudData,
            syncEnabled: true,
        })

        const user = userEvent.setup()
        await renderSettingsRoute()

        // Open clear data dialog
        await user.click(await screen.findByRole("button", { name: /Clear All Data/i }))

        // Check correct message is shown (no sign-in warning)
        expect(await screen.findByText(/This will permanently delete/)).toBeTruthy()
        expect(screen.queryByText(/Since you are signed in/)).toBeNull()

        // Confirm deletion
        await user.click(screen.getByRole("button", { name: "Delete Everything" }))

        // Verify cloud reset was NOT called
        await waitFor(() => {
            expect(mockClearAllData).toHaveBeenCalled()
        })
        expect(mockResetCloudData).not.toHaveBeenCalled()
    })

    it("aborts local deletion if cloud deletion fails", async () => {
        // Mock authenticated state with failing cloud reset
        mockResetCloudData.mockRejectedValue(new Error("Network error"))
        mockUseSync.mockReturnValue({
            auth: { isAuthenticated: true },
            sync: { status: "idle", lastError: null, conflicts: [] },
            resetCloudData: mockResetCloudData,
            syncEnabled: true,
        })

        const user = userEvent.setup()
        await renderSettingsRoute()

        // Open clear data dialog
        await user.click(await screen.findByRole("button", { name: /Clear All Data/i }))

        // Confirm deletion
        await user.click(screen.getByRole("button", { name: "Delete Everything" }))

        // Verify cloud reset was called
        await waitFor(() => {
            expect(mockResetCloudData).toHaveBeenCalled()
        })

        // Verify local clear was NOT called
        expect(mockClearAllData).not.toHaveBeenCalled()
    })
})
