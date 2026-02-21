import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DataManagement } from "@/features/settings/components/DataManagement"

describe("DataManagement", () => {
  afterEach(() => {
    cleanup()
  })

  it("opens export warning, supports cancel, then confirms export", async () => {
    const user = userEvent.setup()
    const onExport = vi.fn()

    render(
      <DataManagement
        onExport={onExport}
        onImport={vi.fn()}
        onClearAll={vi.fn()}
      />
    )

    await user.click(screen.getByRole("button", { name: "Export Data (JSON)" }))

    expect(screen.getByText("Export Data")).toBeTruthy()
    expect(screen.getByText("not encrypted", { exact: false })).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onExport).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Export Data (JSON)" }))
    await user.click(screen.getByRole("button", { name: "Export" }))

    expect(onExport).toHaveBeenCalledTimes(1)
  })

  it("forwards file import changes and clear-all action", async () => {
    const user = userEvent.setup()
    const onImport = vi.fn()
    const onClearAll = vi.fn()

    const { container } = render(
      <DataManagement
        onExport={vi.fn()}
        onImport={onImport}
        onClearAll={onClearAll}
      />
    )

    const fileInput = container.querySelector("input[type='file']")
    expect(fileInput).toBeTruthy()

    if (fileInput) {
      const file = new File([JSON.stringify({ hello: "world" })], "backup.json", {
        type: "application/json",
      })
      fireEvent.change(fileInput, { target: { files: [file] } })
    }

    expect(onImport).toHaveBeenCalledTimes(1)

    await user.click(screen.getAllByRole("button", { name: "Clear All Data" })[0])
    expect(onClearAll).toHaveBeenCalledTimes(1)
  })
})
