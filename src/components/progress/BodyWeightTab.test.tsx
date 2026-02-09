import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { BodyWeightTab } from "@/components/progress/BodyWeightTab"
import type { WeightEntry } from "@/lib/types"

const toastErrorMock = vi.fn()
const toastSuccessMock = vi.fn()
const getTodayMock = vi.fn()
const { rechartsPassThrough } = vi.hoisted(() => ({
  rechartsPassThrough: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}))

vi.mock("@/lib/dateUtils", () => ({
  getToday: () => getTodayMock(),
}))

vi.mock("recharts", () => {
  return {
    LineChart: rechartsPassThrough,
    Line: rechartsPassThrough,
    XAxis: rechartsPassThrough,
    YAxis: rechartsPassThrough,
    CartesianGrid: rechartsPassThrough,
    Tooltip: rechartsPassThrough,
    ResponsiveContainer: rechartsPassThrough,
  }
})

function createEntry(partial: Partial<WeightEntry>): WeightEntry {
  return {
    id: partial.id ?? crypto.randomUUID(),
    date: partial.date ?? "2026-02-09",
    weight: partial.weight ?? 180,
    note: partial.note,
  }
}

describe("BodyWeightTab", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    getTodayMock.mockReturnValue("2026-02-09")
  })

  it("validates weight input before logging", async () => {
    const user = userEvent.setup()
    const addWeightEntry = vi.fn().mockResolvedValue(undefined)
    const setNewWeight = vi.fn()

    render(
      <BodyWeightTab
        newWeight="-2"
        setNewWeight={setNewWeight}
        addWeightEntry={addWeightEntry}
        deleteWeightEntry={vi.fn().mockResolvedValue(undefined)}
        preferredUnit="lbs"
        weightEntries={[]}
      />
    )

    await user.click(screen.getAllByRole("button", { name: "Log" })[0])

    expect(addWeightEntry).not.toHaveBeenCalled()
    expect(toastErrorMock).toHaveBeenCalledWith("Please enter a valid weight")
  })

  it("logs valid weight and clears local input state", async () => {
    const user = userEvent.setup()
    const addWeightEntry = vi.fn().mockResolvedValue(createEntry({ weight: 182.4 }))
    const setNewWeight = vi.fn()

    render(
      <BodyWeightTab
        newWeight="182.4"
        setNewWeight={setNewWeight}
        addWeightEntry={addWeightEntry}
        deleteWeightEntry={vi.fn().mockResolvedValue(undefined)}
        preferredUnit="lbs"
        weightEntries={[]}
      />
    )

    await user.click(screen.getAllByRole("button", { name: "Log" })[0])

    await waitFor(() => {
      expect(addWeightEntry).toHaveBeenCalledWith(182.4, "2026-02-09")
    })
    expect(setNewWeight).toHaveBeenCalledWith("")
    expect(toastSuccessMock).toHaveBeenCalledWith("Weight logged!")
  })

  it("opens delete confirmation and deletes selected entry", async () => {
    const user = userEvent.setup()
    const deleteWeightEntry = vi.fn().mockResolvedValue(undefined)
    const entries = [createEntry({ id: "entry-1", date: "2026-02-09", weight: 182.4 })]

    render(
      <BodyWeightTab
        newWeight=""
        setNewWeight={vi.fn()}
        addWeightEntry={vi.fn().mockResolvedValue(undefined)}
        deleteWeightEntry={deleteWeightEntry}
        preferredUnit="lbs"
        weightEntries={entries}
      />
    )

    await user.click(screen.getByRole("button", { name: /Delete weight entry/ }))
    await user.click(screen.getByRole("button", { name: "Delete" }))

    await waitFor(() => {
      expect(deleteWeightEntry).toHaveBeenCalledWith("entry-1")
    })
    expect(toastSuccessMock).toHaveBeenCalledWith("Entry deleted")
  })
})
