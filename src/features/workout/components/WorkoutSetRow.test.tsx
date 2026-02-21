import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { WorkoutSetRow } from "@/features/workout/components/WorkoutSetRow"
import type { Exercise, WorkoutSet } from "@/lib/types"

interface ScrollPickerProps {
  value: number
  options: number[]
  onChange: (value: number) => void
  unit?: string
}

interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
}

interface SheetContentProps {
  children?: ReactNode
}

interface SheetHeaderProps {
  children?: ReactNode
}

interface SheetTitleProps {
  children?: ReactNode
}

vi.mock("@/components/ui/scroll-picker", () => ({
  ScrollPicker: ({ value, options, onChange, unit }: ScrollPickerProps) => {
    const next = options.find((option) => option !== value) ?? value
    return (
      <button type="button" onClick={() => onChange(next)}>
        Pick {unit ?? "value"}
      </button>
    )
  },
}))

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: SheetProps) => <div>{open ? children : null}</div>,
  SheetContent: ({ children }: SheetContentProps) => <div>{children}</div>,
  SheetHeader: ({ children }: SheetHeaderProps) => <div>{children}</div>,
  SheetTitle: ({ children }: SheetTitleProps) => <h2>{children}</h2>,
}))

const WEIGHTED_EXERCISE: Exercise = {
  id: "bench-press",
  name: "Bench Press",
  muscleGroup: "chest",
  isCustom: false,
  isWeighted: true,
  isTimeBased: false,
}

function createSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: "set-1",
    reps: 8,
    weight: 185,
    isCompleted: false,
    ...overrides,
  }
}

describe("WorkoutSetRow", () => {
  const onUpdateSet = vi.fn()
  const onRemoveSet = vi.fn()
  const onToggleSetComplete = vi.fn()
  const onStartCountdown = vi.fn()
  const onPauseCountdown = vi.fn()
  const onResumeCountdown = vi.fn()
  const onStartRestTimer = vi.fn()

  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("completes an incomplete set and starts rest timer", async () => {
    const user = userEvent.setup()

    render(
      <WorkoutSetRow
        set={createSet()}
        index={0}
        exercise={WEIGHTED_EXERCISE}
        workoutExerciseId="workout-exercise-1"
        weightUnitLabel="lbs"
        isActiveCountdown={false}
        canComplete={true}
        isTimeBased={false}
        onUpdateSet={onUpdateSet}
        onRemoveSet={onRemoveSet}
        onToggleSetComplete={onToggleSetComplete}
        onStartCountdown={onStartCountdown}
        onPauseCountdown={onPauseCountdown}
        onResumeCountdown={onResumeCountdown}
        onStartRestTimer={onStartRestTimer}
        showRemoveButton={true}
      />
    )

    await user.click(screen.getByRole("button", { name: "Complete set 1" }))
    expect(onToggleSetComplete).toHaveBeenCalledWith("workout-exercise-1", "set-1")
    expect(onStartRestTimer).toHaveBeenCalledTimes(1)
  })

  it("toggles completed set without starting rest timer again", async () => {
    const user = userEvent.setup()

    render(
      <WorkoutSetRow
        set={createSet({ isCompleted: true })}
        index={0}
        exercise={WEIGHTED_EXERCISE}
        workoutExerciseId="workout-exercise-1"
        weightUnitLabel="lbs"
        isActiveCountdown={false}
        canComplete={true}
        isTimeBased={false}
        onUpdateSet={onUpdateSet}
        onRemoveSet={onRemoveSet}
        onToggleSetComplete={onToggleSetComplete}
        onStartCountdown={onStartCountdown}
        onPauseCountdown={onPauseCountdown}
        onResumeCountdown={onResumeCountdown}
        onStartRestTimer={onStartRestTimer}
        showRemoveButton={true}
      />
    )

    await user.click(screen.getByRole("button", { name: "Mark set 1 incomplete" }))
    expect(onToggleSetComplete).toHaveBeenCalledWith("workout-exercise-1", "set-1")
    expect(onStartRestTimer).not.toHaveBeenCalled()
  })

  it("starts and controls countdown timers for time-based sets", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <WorkoutSetRow
        set={createSet({ reps: 45 })}
        index={0}
        workoutExerciseId="workout-exercise-1"
        weightUnitLabel="lbs"
        isActiveCountdown={false}
        canComplete={true}
        isTimeBased={true}
        onUpdateSet={onUpdateSet}
        onRemoveSet={onRemoveSet}
        onToggleSetComplete={onToggleSetComplete}
        onStartCountdown={onStartCountdown}
        onPauseCountdown={onPauseCountdown}
        onResumeCountdown={onResumeCountdown}
        onStartRestTimer={onStartRestTimer}
        showRemoveButton={true}
      />
    )

    await user.click(screen.getByRole("button", { name: "Start set 1 timer" }))
    expect(onStartCountdown).toHaveBeenCalledWith("set-1", "workout-exercise-1", 45)

    rerender(
      <WorkoutSetRow
        set={createSet({ reps: 45 })}
        index={0}
        workoutExerciseId="workout-exercise-1"
        weightUnitLabel="lbs"
        isActiveCountdown={true}
        countdownIsRunning={true}
        countdownFormattedTime="0:45"
        canComplete={true}
        isTimeBased={true}
        onUpdateSet={onUpdateSet}
        onRemoveSet={onRemoveSet}
        onToggleSetComplete={onToggleSetComplete}
        onStartCountdown={onStartCountdown}
        onPauseCountdown={onPauseCountdown}
        onResumeCountdown={onResumeCountdown}
        onStartRestTimer={onStartRestTimer}
        showRemoveButton={true}
      />
    )

    await user.click(screen.getByRole("button", { name: "Pause set 1 timer" }))
    expect(onPauseCountdown).toHaveBeenCalledTimes(1)

    rerender(
      <WorkoutSetRow
        set={createSet({ reps: 45 })}
        index={0}
        workoutExerciseId="workout-exercise-1"
        weightUnitLabel="lbs"
        isActiveCountdown={true}
        countdownIsRunning={false}
        countdownFormattedTime="0:30"
        canComplete={true}
        isTimeBased={true}
        onUpdateSet={onUpdateSet}
        onRemoveSet={onRemoveSet}
        onToggleSetComplete={onToggleSetComplete}
        onStartCountdown={onStartCountdown}
        onPauseCountdown={onPauseCountdown}
        onResumeCountdown={onResumeCountdown}
        onStartRestTimer={onStartRestTimer}
        showRemoveButton={true}
      />
    )

    await user.click(screen.getByRole("button", { name: "Resume set 1 timer" }))
    expect(onResumeCountdown).toHaveBeenCalledTimes(1)
  })

  it("removes set only when removable", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <WorkoutSetRow
        set={createSet()}
        index={0}
        exercise={WEIGHTED_EXERCISE}
        workoutExerciseId="workout-exercise-1"
        weightUnitLabel="lbs"
        isActiveCountdown={false}
        canComplete={true}
        isTimeBased={false}
        onUpdateSet={onUpdateSet}
        onRemoveSet={onRemoveSet}
        onToggleSetComplete={onToggleSetComplete}
        onStartCountdown={onStartCountdown}
        onPauseCountdown={onPauseCountdown}
        onResumeCountdown={onResumeCountdown}
        onStartRestTimer={onStartRestTimer}
        showRemoveButton={true}
      />
    )

    await user.click(screen.getByRole("button", { name: "Remove set 1" }))
    expect(onRemoveSet).toHaveBeenCalledWith("workout-exercise-1", "set-1")

    rerender(
      <WorkoutSetRow
        set={createSet({ isCompleted: true })}
        index={0}
        exercise={WEIGHTED_EXERCISE}
        workoutExerciseId="workout-exercise-1"
        weightUnitLabel="lbs"
        isActiveCountdown={false}
        canComplete={true}
        isTimeBased={false}
        onUpdateSet={onUpdateSet}
        onRemoveSet={onRemoveSet}
        onToggleSetComplete={onToggleSetComplete}
        onStartCountdown={onStartCountdown}
        onPauseCountdown={onPauseCountdown}
        onResumeCountdown={onResumeCountdown}
        onStartRestTimer={onStartRestTimer}
        showRemoveButton={true}
      />
    )

    expect(screen.queryByRole("button", { name: "Remove set 1" })).toBeNull()
  })

  it("updates weight and reps via picker controls", async () => {
    const user = userEvent.setup()

    render(
      <WorkoutSetRow
        set={createSet({ weight: 190, reps: 10 })}
        index={0}
        exercise={WEIGHTED_EXERCISE}
        workoutExerciseId="workout-exercise-1"
        weightUnitLabel="lbs"
        isActiveCountdown={false}
        canComplete={true}
        isTimeBased={false}
        onUpdateSet={onUpdateSet}
        onRemoveSet={onRemoveSet}
        onToggleSetComplete={onToggleSetComplete}
        onStartCountdown={onStartCountdown}
        onPauseCountdown={onPauseCountdown}
        onResumeCountdown={onResumeCountdown}
        onStartRestTimer={onStartRestTimer}
        showRemoveButton={true}
      />
    )

    await user.click(screen.getByRole("button", { name: "Set 1 weight" }))
    await user.click(screen.getByRole("button", { name: "Pick lbs" }))
    expect(onUpdateSet).toHaveBeenCalledWith("workout-exercise-1", "set-1", { weight: 0 })

    await user.click(screen.getByRole("button", { name: "Confirm" }))
    await user.click(screen.getByRole("button", { name: "Set 1 reps" }))
    await user.click(screen.getByRole("button", { name: "Pick reps" }))
    expect(onUpdateSet).toHaveBeenCalledWith("workout-exercise-1", "set-1", { reps: 1 })
  })
})
