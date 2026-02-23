import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WorkoutSettings } from "@/features/settings/components/WorkoutSettings"

describe("WorkoutSettings", () => {
  afterEach(() => {
    cleanup()
  })

  it("updates rest timer duration and toggles notifications", async () => {
    const user = userEvent.setup()
    const onRestTimerChange = vi.fn()
    const onToggleNotifications = vi.fn()

    render(
      <WorkoutSettings
        restTimerDuration={90}
        onRestTimerChange={onRestTimerChange}
        progressiveOverloadEnabled={true}
        onProgressiveOverloadChange={vi.fn()}
        notificationsEnabled={false}
        onToggleNotifications={onToggleNotifications}
        canEnableNotifications={true}
        notificationPermission="granted"
      />
    )

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "75" } })

    expect(onRestTimerChange).toHaveBeenLastCalledWith(75)

    await user.click(screen.getByRole("button", { name: "Notifications Disabled" }))
    expect(onToggleNotifications).toHaveBeenCalledTimes(1)
  })

  it("shows denied-permission guidance when notifications are blocked", () => {
    render(
      <WorkoutSettings
        restTimerDuration={90}
        onRestTimerChange={vi.fn()}
        progressiveOverloadEnabled={false}
        onProgressiveOverloadChange={vi.fn()}
        notificationsEnabled={false}
        onToggleNotifications={vi.fn()}
        canEnableNotifications={false}
        notificationPermission="denied"
      />
    )

    expect(screen.queryByText("Notifications blocked. Please enable in browser settings.")).not.toBeNull()
  })

  it("toggles progressive overload setting", async () => {
    const user = userEvent.setup()
    const onProgressiveOverloadChange = vi.fn()

    render(
      <WorkoutSettings
        restTimerDuration={90}
        onRestTimerChange={vi.fn()}
        progressiveOverloadEnabled={true}
        onProgressiveOverloadChange={onProgressiveOverloadChange}
        notificationsEnabled={false}
        onToggleNotifications={vi.fn()}
        canEnableNotifications={true}
        notificationPermission="granted"
      />
    )

    await user.click(screen.getByRole("switch"))

    expect(onProgressiveOverloadChange).toHaveBeenCalled()
    expect(onProgressiveOverloadChange.mock.calls[0]?.[0]).toBe(false)
  })
})
