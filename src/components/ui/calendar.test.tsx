import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Calendar } from "./calendar"

afterEach(cleanup)

describe("Calendar", () => {
  it("renders accessible month navigation and forwards a selected date", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <Calendar
        mode="single"
        month={new Date(2025, 6, 1)}
        selected={new Date(2025, 6, 15)}
        onSelect={onSelect}
      />
    )

    expect(screen.getByRole("button", { name: "Go to the Previous Month" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Go to the Next Month" })).toBeTruthy()

    await user.click(screen.getByText("16", { selector: "button" }))

    expect(onSelect).toHaveBeenCalledWith(new Date(2025, 6, 16), expect.anything(), expect.anything(), expect.anything())
  })

  it("moves DOM focus with keyboard date navigation", async () => {
    const user = userEvent.setup()

    render(
      <Calendar
        mode="single"
        month={new Date(2025, 6, 1)}
        selected={new Date(2025, 6, 15)}
        // oxlint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
    )

    const selectedDay = screen.getByRole("button", {
      name: "Tuesday, July 15th, 2025, selected",
    })
    expect(document.activeElement).toBe(selectedDay)

    await user.keyboard("{ArrowRight}")

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Wednesday, July 16th, 2025" })
    )
  })
})
