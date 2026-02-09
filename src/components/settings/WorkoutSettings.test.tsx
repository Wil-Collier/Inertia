import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WorkoutSettings } from "@/components/settings/WorkoutSettings"

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
        notificationsEnabled={false}
        onToggleNotifications={vi.fn()}
        canEnableNotifications={false}
        notificationPermission="denied"
      />
    )

    expect(screen.getByText("Notifications blocked. Please enable in browser settings.")).toBeTruthy()
  })
})
