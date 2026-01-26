import { useState, useCallback, useMemo, useEffect } from "react"
import { toast } from "sonner"
import { useNavigate, Navigate } from "@tanstack/react-router"
import { Plus, Save, Loader2 } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { RestTimerBanner } from "@/components/workout/RestTimerBanner"
import { WorkoutProgressSummary } from "@/components/workout/WorkoutProgressSummary"
import { WorkoutExerciseCard } from "@/components/workout/WorkoutExerciseCard"
import { FinishWorkoutDialog } from "@/components/workout/FinishWorkoutDialog"
import { CancelWorkoutDialog } from "@/components/workout/CancelWorkoutDialog"
import { Button } from "@/components/ui/button"
import { ExercisePickerSheet } from "@/components/ExercisePickerSheet"
import { useActiveSession, useActiveSessionActions } from "@/features/workout/hooks/useActiveSession"
import { useTemplates } from "@/features/workout/queries"
import { useCreateTemplate } from "@/features/workout/mutations"
import { useExercisesByIds } from "@/features/exercises/queries"
import { useSettings } from "@/features/settings/queries"
import { useRestTimerControls } from "@/hooks/useRestTimer"
import { useCountdownTimer } from "@/hooks/useCountdownTimer"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { useWorkoutChanges } from "@/hooks/useWorkoutChanges"
import { playDingSound, unlockAudio } from "@/lib/audio"

/** Helper to convert undefined/NaN to 0 */
const toZeroIfInvalid = (n: number | undefined): number => (Number.isFinite(n) ? n! : 0)

export function ActiveWorkout() {
  const navigate = useNavigate()
  const { data: activeSession, isLoading } = useActiveSession()
  const {
    finishWorkout,
    cancelWorkout,
    addExercise,
    removeExercise,
    addSet,
    updateSet,
    removeSet,
    toggleSetComplete,
    updateExerciseNotes,
  } = useActiveSessionActions()

  const createTemplateMutation = useCreateTemplate()

  const { data: settings } = useSettings()
  const restTimerDuration = settings?.restTimerDuration ?? 90
  const weightUnit = useWeightUnit()
  const { data: templates = [] } = useTemplates()

  const [showExerciseSheet, setShowExerciseSheet] = useState(false)
  const [showFinishDialog, setShowFinishDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null)
  const [isFinishing, setIsFinishing] = useState(false)

  // Lightweight timer controls (doesn't cause 100ms re-renders)
  const timerControls = useRestTimerControls(restTimerDuration)

  // Handler for when countdown timer completes
  const handleCountdownComplete = useCallback(
    (setId: string, workoutExerciseId: string) => {
      void playDingSound()
      void toggleSetComplete({ workoutExerciseId, setId })
      timerControls.start() // Start rest timer after completing timed set
    },
    [toggleSetComplete, timerControls]
  )

  const countdown = useCountdownTimer({ onComplete: handleCountdownComplete })

  // Unlock audio on first user interaction for Safari/iOS
  const handleUserInteraction = useCallback(() => {
    void unlockAudio()
  }, [])

  const workout = activeSession?.workout
  const exerciseIds = useMemo(
    () => workout?.exercises.map((e) => e.exerciseId) ?? [],
    [workout?.exercises]
  )
  const { data: exercisesById = new Map() } = useExercisesByIds(exerciseIds)

  const completedSets = useMemo(() => {
    return (
      workout?.exercises.reduce(
        (sum, e) => sum + e.sets.filter((s) => s.isCompleted).length,
        0
      ) ?? 0
    )
  }, [workout?.exercises])

  const totalSets = useMemo(() => {
    return workout?.exercises.reduce((sum, e) => sum + e.sets.length, 0) ?? 0
  }, [workout?.exercises])

  // Detect if workout has unsaved changes
  const { hasChanges } = useWorkoutChanges({
    workout,
    templateId: activeSession?.templateId,
    templates,
    completedSets,
  })

  const handleFinish = useCallback(async () => {
    setIsFinishing(true)
    try {
      const completed = await finishWorkout()

      if (!completed) {
        toast.error("Failed to finish workout")
        return
      }

      if (saveAsTemplate && templateName.trim()) {
        await createTemplateMutation.mutateAsync({
          name: templateName.trim(),
          exercises: completed.exercises.map((e) => {
            const reps = e.sets.find((s) => (s.reps ?? 0) > 0)?.reps
            const weight = e.sets.find((s) => (s.weight ?? 0) > 0)?.weight

            return {
              exerciseId: e.exerciseId,
              targetSets: e.sets.length,
              targetReps: toZeroIfInvalid(reps),
              targetWeight: toZeroIfInvalid(weight),
            }
          }),
        })
        toast.success(`Workout saved & template "${templateName.trim()}" created!`)
      } else {
        toast.success("Workout saved!")
      }

      void navigate({ to: "/workout" })
    } catch (error) {
      console.error(error)
      toast.error("Failed to finish workout")
    } finally {
      setIsFinishing(false)
    }
  }, [finishWorkout, saveAsTemplate, templateName, createTemplateMutation, navigate])

  const handleCancel = useCallback(async () => {
    try {
      await cancelWorkout()
      void navigate({ to: "/workout" })
    } catch {
      toast.error("Failed to cancel workout")
    }
  }, [cancelWorkout, navigate])

  const handleToggleExpanded = useCallback((id: string) => {
    setExpandedExerciseId((prev) => (prev === id ? null : id))
  }, [])

  const handleAddExercise = useCallback(
    async (exerciseId: string) => {
      try {
        await addExercise(exerciseId)
      } catch {
        toast.error("Failed to add exercise")
      }
    },
    [addExercise]
  )

  // Stable callbacks for WorkoutExerciseCard to prevent re-renders
  const handleRemoveSet = useCallback(
    (workoutExerciseId: string, setId: string) => {
      void removeSet({ workoutExerciseId, setId })
    },
    [removeSet]
  )

  const handleUpdateSet = useCallback(
    (workoutExerciseId: string, setId: string, updates: Parameters<typeof updateSet>[0]["updates"]) => {
      void updateSet({ workoutExerciseId, setId, updates })
    },
    [updateSet]
  )

  const handleToggleSetComplete = useCallback(
    (workoutExerciseId: string, setId: string) => {
      void toggleSetComplete({ workoutExerciseId, setId })
    },
    [toggleSetComplete]
  )

  const handleAddSet = useCallback(
    (workoutExerciseId: string) => {
      void addSet(workoutExerciseId)
    },
    [addSet]
  )

  const handleRemoveExercise = useCallback(
    (workoutExerciseId: string) => {
      void removeExercise(workoutExerciseId)
    },
    [removeExercise]
  )

  const handleUpdateNotes = useCallback(
    (workoutExerciseId: string, notes: string) => {
      void updateExerciseNotes({ workoutExerciseId, notes })
    },
    [updateExerciseNotes]
  )

  // Automatically expand newly added exercises
  const [prevExerciseCount, setPrevExerciseCount] = useState(workout?.exercises.length ?? 0)

  useEffect(() => {
    if (workout && workout.exercises.length > prevExerciseCount) {
      const newExercise = workout.exercises.at(-1)
      if (newExercise) {
        setExpandedExerciseId(newExercise.id)
      }
    }
    setPrevExerciseCount(workout?.exercises.length ?? 0)
  }, [workout?.exercises.length, prevExerciseCount, workout])

  const handleBack = useCallback(async () => {
    if (hasChanges()) {
      setShowCancelDialog(true)
      return
    }
    // No changes, just cancel without confirmation
    await handleCancel()
  }, [hasChanges, handleCancel])

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!activeSession || !workout) {
    return <Navigate to="/workout" replace />
  }

  return (
    <div
      className="flex flex-col"
      onTouchStart={handleUserInteraction}
      onClick={handleUserInteraction}
      onKeyDown={handleUserInteraction}
      role="presentation"
    >
      <Header
        title={workout.name}
        showBack
        onBack={() => void handleBack()}
        bottomContent={<RestTimerBanner defaultDuration={restTimerDuration} />}
      />

      <div className="flex-1 space-y-4 p-4">
        <WorkoutProgressSummary
          completedSets={completedSets}
          totalSets={totalSets}
          startedAt={activeSession.startedAt}
          exerciseCount={workout.exercises.length}
        />

        {/* Exercises */}
        {workout.exercises.map((workoutExercise) => {
          const isCountdownForExercise =
            countdown.activeSetId !== null &&
            workoutExercise.sets.some((s) => s.id === countdown.activeSetId)

          return (
            <WorkoutExerciseCard
              key={workoutExercise.id}
              workoutExercise={workoutExercise}
              exercise={exercisesById.get(workoutExercise.exerciseId)}
              isExpanded={expandedExerciseId === workoutExercise.id}
              onToggleExpanded={handleToggleExpanded}
              onAddSet={handleAddSet}
              onRemoveSet={handleRemoveSet}
              onUpdateSet={handleUpdateSet}
              onToggleSetComplete={handleToggleSetComplete}
              onRemoveExercise={handleRemoveExercise}
              onUpdateNotes={handleUpdateNotes}
              weightUnitLabel={weightUnit.unitLabel}
              activeSetId={countdown.activeSetId ?? undefined}
              countdownFormattedTime={isCountdownForExercise ? countdown.formattedTime : undefined}
              countdownIsRunning={isCountdownForExercise ? countdown.isRunning : false}
              onStartCountdown={countdown.start}
              onPauseCountdown={countdown.pause}
              onResumeCountdown={countdown.resume}
              onStartRestTimer={timerControls.start}
            />
          )
        })}

        {/* Add Exercise Button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowExerciseSheet(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Exercise
        </Button>

        {/* Finish Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={() => setShowFinishDialog(true)}
          disabled={workout.exercises.length === 0}
        >
          <Save className="mr-2 h-4 w-4" />
          Finish Workout
        </Button>
      </div>

      {/* Exercise Selection Sheet */}
      <ExercisePickerSheet
        isOpen={showExerciseSheet}
        onOpenChange={setShowExerciseSheet}
        onSelect={(exerciseId) => void handleAddExercise(exerciseId)}
        addedExerciseIds={workout.exercises.map((e) => e.exerciseId)}
      />

      <FinishWorkoutDialog
        open={showFinishDialog}
        onOpenChange={setShowFinishDialog}
        completedSets={completedSets}
        totalSets={totalSets}
        exerciseCount={workout.exercises.length}
        saveAsTemplate={saveAsTemplate}
        onSaveAsTemplateChange={setSaveAsTemplate}
        templateName={templateName}
        onTemplateNameChange={setTemplateName}
        isFinishing={isFinishing}
        onFinish={() => void handleFinish()}
      />

      <CancelWorkoutDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirmCancel={() => void handleCancel()}
      />
    </div>
  )
}
