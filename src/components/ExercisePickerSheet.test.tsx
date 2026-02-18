import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/services/db"
import { ExercisePickerSheet } from "@/components/ExercisePickerSheet"
import type { Exercise } from "@/lib/types"
import { createTestQueryClient } from "@/test/helpers/queryHookTestUtils"
import { resetTestRuntime } from "@/test/helpers/resetTestRuntime"

const TEST_EXERCISES: Exercise[] = [
  {
    id: "bench-press",
    name: "Bench Press",
    muscleGroup: "chest",
    isCustom: true,
    isWeighted: true,
    isTimeBased: false,
  },
  {
    id: "back-squat",
    name: "Back Squat",
    muscleGroup: "legs",
    isCustom: true,
    isWeighted: true,
    isTimeBased: false,
  },
  {
    id: "custom-plank",
    name: "Custom Plank Hold",
    muscleGroup: "core",
    isCustom: true,
    isWeighted: false,
    isTimeBased: true,
  },
]

async function seedCustomExercises(exercises: Exercise[] = TEST_EXERCISES) {
  await db.transaction("rw", [db.customExercises, db.syncPendingChanges, db.syncRecordVersions], async () => {
    await db.customExercises.bulkPut(exercises)
  })
}

function renderExercisePickerSheet(options?: {
  onSelect?: (exerciseId: string) => void
  onOpenChange?: (isOpen: boolean) => void
  addedExerciseIds?: string[]
}) {
  const queryClient = createTestQueryClient()
  const onSelect = options?.onSelect ?? vi.fn()
  const onOpenChange = options?.onOpenChange ?? vi.fn()

  const result = render(
    <QueryClientProvider client={queryClient}>
      <ExercisePickerSheet
        isOpen={true}
        onOpenChange={onOpenChange}
        onSelect={onSelect}
        addedExerciseIds={options?.addedExerciseIds}
      />
    </QueryClientProvider>
  )

  return {
    ...result,
    queryClient,
    onSelect,
    onOpenChange,
  }
}

describe("ExercisePickerSheet", () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  beforeEach(async () => {
    vi.useRealTimers()
    vi.clearAllMocks()
    await resetTestRuntime()
    await seedCustomExercises()
  })

  it("prevents selecting already added exercises and selects available ones", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onOpenChange = vi.fn()

    renderExercisePickerSheet({
      onSelect,
      onOpenChange,
      addedExerciseIds: ["bench-press"],
    })

    await user.click(await screen.findByRole("button", { name: "Custom" }))

    const benchButton = await screen.findByRole("button", { name: "Bench Press" })
    expect(benchButton instanceof HTMLButtonElement).toBe(true)
    if (!(benchButton instanceof HTMLButtonElement)) {
      throw new Error("Expected Bench Press to be a button element")
    }
    expect(benchButton.disabled).toBe(true)

    await user.click(await screen.findByRole("button", { name: "Back Squat" }))

    expect(onSelect).toHaveBeenCalledWith("back-squat")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  }, 20000)

  it("applies search/filter controls and shows empty states", async () => {
    renderExercisePickerSheet()

    fireEvent.click(await screen.findByRole("button", { name: "Custom" }))
    expect(await screen.findByText("Custom Plank Hold")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Legs" }))
    expect(await screen.findByText("Back Squat")).toBeTruthy()
    expect(screen.queryByText("Custom Plank Hold")).toBeNull()

    fireEvent.change(screen.getByPlaceholderText("Search exercises..."), { target: { value: "zzz" } })

    expect(await screen.findByText("No exercises found", {}, { timeout: 15000 })).toBeTruthy()
    expect(screen.getByText("Try a different search term or filter")).toBeTruthy()
  }, 20000)

  it("resets search state immediately when the sheet closes", async () => {
    const onOpenChange = vi.fn()

    renderExercisePickerSheet({ onOpenChange })

    const searchInput = await screen.findByPlaceholderText("Search exercises...")
    fireEvent.change(searchInput, { target: { value: "bench" } })

    expect(searchInput instanceof HTMLInputElement).toBe(true)
    if (!(searchInput instanceof HTMLInputElement)) {
      throw new Error("Expected search input element")
    }
    expect(searchInput.value).toBe("bench")

    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() => {
      expect(searchInput.value).toBe("")
    })
  }, 25000)

  it("supports create and edit dialog flows", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onOpenChange = vi.fn()

    renderExercisePickerSheet({ onSelect, onOpenChange })

    await user.click(await screen.findByRole("button", { name: "Custom" }))
    await user.click(await screen.findByRole("button", { name: "New" }))
    expect(await screen.findByText("Create Custom Exercise")).toBeTruthy()

    await user.type(screen.getByLabelText("Name"), "New Exercise")
    await user.click(screen.getByRole("button", { name: "Create Exercise" }))

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onOpenChange).toHaveBeenCalledWith(false)
    }, { timeout: 3000 })

    const selectedExerciseId = onSelect.mock.calls[0]?.[0]
    expect(typeof selectedExerciseId).toBe("string")
    if (typeof selectedExerciseId !== "string") {
      throw new Error("Expected selected exercise id to be a string")
    }

    const createdExercise = await db.customExercises.get(selectedExerciseId)
    expect(createdExercise).toBeTruthy()
    expect(createdExercise?.name).toBe("New Exercise")

    onSelect.mockClear()

    await user.click(await screen.findByRole("button", { name: "Edit Custom Plank Hold" }))
    expect(await screen.findByText("Edit Exercise")).toBeTruthy()

    const nameInput = screen.getByLabelText("Name")
    await user.clear(nameInput)
    await user.type(nameInput, "Custom Plank Hold Updated")
    await user.click(screen.getByRole("button", { name: "Update Exercise" }))

    await waitFor(() => {
      expect(screen.queryByText("Edit Exercise")).toBeNull()
    }, { timeout: 3000 })

    const updatedExercise = await db.customExercises.get("custom-plank")
    expect(updatedExercise?.name).toBe("Custom Plank Hold Updated")
    expect(onSelect).not.toHaveBeenCalled()
  }, 25000)

  it("clears search query when clear button is pressed", async () => {
    renderExercisePickerSheet()

    const searchInput = await screen.findByPlaceholderText("Search exercises...")
    fireEvent.change(searchInput, { target: { value: "bench" } })
    fireEvent.click(screen.getByLabelText("Clear search"))

    expect(searchInput instanceof HTMLInputElement).toBe(true)
    if (!(searchInput instanceof HTMLInputElement)) {
      throw new Error("Expected search input element")
    }
    await waitFor(() => {
      expect(searchInput.value).toBe("")
    })
  }, 10000)
})
