import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { cleanup, screen, waitFor } from "@testing-library/react"
import { SettingsPage } from "@/pages/SettingsPage"
import { createSettings } from "@/test/factories/settingsFactory"
import { renderAppRoute } from "@/test/helpers/renderAppRoute"
import { resetTestRuntime } from "@/test/helpers/resetTestRuntime"
import { seedTestState } from "@/test/helpers/seedTestState"
import { db } from "@/services/db"

const settingsTestState = vi.hoisted(() => ({
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
}))

vi.mock("sonner", () => ({
    toast: {
        success: (...args: unknown[]) => settingsTestState.toastSuccess(...args),
        error: (...args: unknown[]) => settingsTestState.toastError(...args),
        info: vi.fn(),
    },
}))

// Mock notification APIs since jsdom doesn't support them
vi.mock("@/services/notifications", () => ({
    isNotificationSupported: () => true,
    getNotificationPermission: () => "default",
    requestNotificationPermission: vi.fn().mockResolvedValue("granted"),
    showRestTimerNotification: vi.fn(),
    canShowNotifications: () => false,
}))

// Mock Google OAuth - external third-party dependency that requires browser-only GoogleOAuthProvider
vi.mock("@react-oauth/google", () => ({
    GoogleLogin: () => <div data-testid="google-login">Sign in with Google</div>,
    GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useGoogleOAuth: () => ({ clientId: "mock-client-id" }),
}))

// Mock window.matchMedia since jsdom doesn't support it.
// Required because SettingsPage uses useTheme which calls window.matchMedia.
// This must be set before any component renders (not just in beforeEach).
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

// SettingsPage returns null while settings load, but the renderAppRoute helper's
// RouteComponent type expects () => ReactElement. Wrapping avoids an unsafe type assertion.
function SettingsPageWrapper() {
    return <SettingsPage />
}

async function renderSettingsRoute() {
    return await renderAppRoute({
        initialPath: "/settings",
        routes: [{ path: "/settings", component: SettingsPageWrapper }],
    })
}

describe("SettingsPage", () => {
    afterEach(() => {
        cleanup()
    })

    beforeEach(async () => {
        vi.clearAllMocks()
        await resetTestRuntime()
        await seedTestState({
            settings: createSettings(),
        })
    })

    it("persists rest timer duration changes to database", async () => {
        const user = userEvent.setup()
        await renderSettingsRoute()

        // Label and Input are not linked via htmlFor/id, so use findByText + sibling input
        await screen.findByText("Rest Timer Duration (seconds)")
        const restTimerInput = screen.getByDisplayValue("90")
        await user.clear(restTimerInput)
        await user.type(restTimerInput, "120")

        await waitFor(async () => {
            const settings = await db.settings.get("settings")
            expect(settings?.restTimerDuration).toBe(120)
        })
    })

    it("persists weight unit changes to database", async () => {
        const user = userEvent.setup()
        await renderSettingsRoute()

        // Unit buttons are <Button> elements (role="button"), not radio buttons.
        // Factory default is "kg", so Kilograms button is active.
        const lbsButton = await screen.findByRole("button", { name: /Pounds/i })
        const kgButton = screen.getByRole("button", { name: /Kilograms/i })

        // Default is kg, switch to lbs
        await user.click(lbsButton)

        await waitFor(async () => {
            const settings = await db.settings.get("settings")
            expect(settings?.unitPreferences.weight).toBe("lbs")
        })

        // Switch back to kg
        await user.click(kgButton)

        await waitFor(async () => {
            const settings = await db.settings.get("settings")
            expect(settings?.unitPreferences.weight).toBe("kg")
        })
    })

    it("persists nutrition goal changes to database", async () => {
        const user = userEvent.setup()
        await renderSettingsRoute()

        // Label text is "Calories (Cal)", and labels are not linked via htmlFor/id.
        // Use getByDisplayValue to find the calories input (default value is 2000).
        await screen.findByText("Calories (Cal)")
        const caloriesInput = screen.getByDisplayValue("2000")
        await user.clear(caloriesInput)
        await user.type(caloriesInput, "2500")

        await waitFor(async () => {
            const settings = await db.settings.get("settings")
            expect(settings?.nutritionGoals.calories).toBe(2500)
        })
    })

    it("cancels clear data dialog without deleting data", async () => {
        const user = userEvent.setup()
        await renderSettingsRoute()

        await user.click(await screen.findByRole("button", { name: /Clear All Data/i }))
        await screen.findByText("Clear All Data?")
        await user.click(screen.getByRole("button", { name: "Cancel" }))

        // Dialog should close
        await waitFor(() => {
            expect(screen.queryByText("Clear All Data?")).toBeNull()
        })

        // Data should still exist
        const settings = await db.settings.get("settings")
        expect(settings).toBeTruthy()
    })
})
