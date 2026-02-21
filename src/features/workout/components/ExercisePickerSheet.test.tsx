import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/services/db"
import { ExercisePickerSheet } from "@/features/workout/components/ExercisePickerSheet"
import type { Exercise } from "@/lib/types"
import { createTestQueryClient } from "@/test/helpers/queryHookTestUtils"
import { resetEphemeralTestRuntime } from "@/test/helpers/resetTestRuntime"

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

async function resetExercisePickerTables() {
  await db.transaction("rw", [db.customExercises, db.syncPendingChanges, db.syncRecordVersions], async () => {
    await db.customExercises.clear()
    await db.syncPendingChanges.clear()
    await db.syncRecordVersions.clear()
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
    resetEphemeralTestRuntime()
    await resetExercisePickerTables()
    await seedCustomExercises()
  })

  it("prevents selecting already added exercises and selects available ones", async () => {
    const onSelect = vi.fn()
    const onOpenChange = vi.fn()

    renderExercisePickerSheet({
      onSelect,
      onOpenChange,
      addedExerciseIds: ["bench-press"],
    })

    fireEvent.click(await screen.findByRole("button", { name: "Custom" }))

    const benchButton = await screen.findByRole("button", { name: "Bench Press" })
    expect(benchButton instanceof HTMLButtonElement).toBe(true)
    if (!(benchButton instanceof HTMLButtonElement)) {
      throw new Error("Expected Bench Press to be a button element")
    }
    expect(benchButton.disabled).toBe(true)

    fireEvent.click(await screen.findByRole("button", { name: "Back Squat" }))

    expect(onSelect).toHaveBeenCalledWith("back-squat")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("applies search/filter controls and shows empty states", async () => {
    renderExercisePickerSheet()

    fireEvent.click(await screen.findByRole("button", { name: "Custom" }))
    expect(await screen.findByText("Custom Plank Hold")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Legs" }))
    expect(await screen.findByText("Back Squat")).toBeTruthy()
    expect(screen.queryByText("Custom Plank Hold")).toBeNull()

    fireEvent.change(screen.getByPlaceholderText("Search exercises..."), { target: { value: "zzz" } })
    await waitFor(() => {
      expect(screen.getByText("No exercises found")).toBeTruthy()
    }, { timeout: 2000 })
    expect(screen.getByText("Try a different search term or filter")).toBeTruthy()
  })

  it("resets search state immediately when the sheet closes", async () => {
    const onOpenChange = vi.fn()

    renderExercisePickerSheet({ onOpenChange })

    const searchInput = screen.getByPlaceholderText("Search exercises...")
    fireEvent.change(searchInput, { target: { value: "bench" } })

    expect(searchInput instanceof HTMLInputElement).toBe(true)
    if (!(searchInput instanceof HTMLInputElement)) {
      throw new Error("Expected search input element")
    }
    expect(searchInput.value).toBe("bench")

    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(searchInput.value).toBe("")
  })

  it("supports create and edit dialog flows", async () => {
    const onSelect = vi.fn()
    const onOpenChange = vi.fn()

    renderExercisePickerSheet({ onSelect, onOpenChange })

    fireEvent.click(await screen.findByRole("button", { name: "Custom" }))
    fireEvent.click(await screen.findByRole("button", { name: "New" }))
    expect(await screen.findByText("Create Custom Exercise")).toBeTruthy()

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Exercise" } })
    fireEvent.click(screen.getByRole("button", { name: "Create Exercise" }))

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

    fireEvent.click(await screen.findByRole("button", { name: "Edit Custom Plank Hold" }))
    expect(await screen.findByText("Edit Exercise")).toBeTruthy()

    const nameInput = screen.getByLabelText("Name")
    fireEvent.change(nameInput, { target: { value: "Custom Plank Hold Updated" } })
    fireEvent.click(screen.getByRole("button", { name: "Update Exercise" }))

    await waitFor(() => {
      expect(screen.queryByText("Edit Exercise")).toBeNull()
    }, { timeout: 3000 })

    const updatedExercise = await db.customExercises.get("custom-plank")
    expect(updatedExercise?.name).toBe("Custom Plank Hold Updated")
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("clears search query when clear button is pressed", async () => {
    renderExercisePickerSheet()

    const searchInput = screen.getByPlaceholderText("Search exercises...")
    fireEvent.change(searchInput, { target: { value: "bench" } })
    fireEvent.click(screen.getByLabelText("Clear search"))

    expect(searchInput instanceof HTMLInputElement).toBe(true)
    if (!(searchInput instanceof HTMLInputElement)) {
      throw new Error("Expected search input element")
    }
    expect(searchInput.value).toBe("")
  })
})
