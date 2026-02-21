import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { BodyWeightTab } from "@/features/progress/components/BodyWeightTab"
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
  formatDate: (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  },
  parseDbDate: (dateStr: string) => {
    const [yStr, mStr, dStr] = dateStr.split("-")
    return new Date(Number(yStr), Number(mStr) - 1, Number(dStr))
  },
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
        // lbs → lbs: no conversion needed
        parseWeight={(v: number) => v}
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
        // lbs → lbs: identity (parseWeight converts display unit → lbs)
        parseWeight={(v: number) => v}
        weightEntries={[]}
      />
    )

    await user.click(screen.getAllByRole("button", { name: "Log" })[0])

    await waitFor(() => {
      // parseWeight is identity for lbs, so value is passed through unchanged
      expect(addWeightEntry).toHaveBeenCalledWith(182.4, "2026-02-09")
    })
    expect(setNewWeight).toHaveBeenCalledWith("")
    // Success toast is fired by the mutation's onSuccess, not the component directly
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
        parseWeight={(v: number) => v}
        weightEntries={entries}
      />
    )

    await user.click(screen.getByRole("button", { name: /Delete weight entry/ }))
    await user.click(screen.getByRole("button", { name: "Delete" }))

    await waitFor(() => {
      expect(deleteWeightEntry).toHaveBeenCalledWith("entry-1")
    })
    // Success toast is fired by the mutation's onSuccess, not the component directly
  })
})
