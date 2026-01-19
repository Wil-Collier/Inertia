// TODO(ActiveWorkout):
// - Split into smaller components/hooks (timers, dialogs, summary, exercise list) to reduce complexity.
// - Extract and test `hasChanges` workout-vs-template comparison logic.
// - Revisit template target derivation (per-set targets vs single reps/weight defaults).
// - Consider making audio unlock once-per-session to avoid repeated calls.

import { useState, useCallback, useMemo, useEffect } from "react"
import { toast } from "sonner"
import { useNavigate, Navigate } from "@tanstack/react-router"
import {
  Plus,
  Save,
  Timer,
  Loader2,
} from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ExercisePickerSheet } from "@/components/ExercisePickerSheet"
import { WorkoutExerciseCard } from "@/components/workout/WorkoutExerciseCard"
import { useActiveSession, useActiveSessionActions } from "@/features/workout/hooks/useActiveSession"
import { useTemplates } from "@/features/workout/queries"
import { useCreateTemplate } from "@/features/workout/mutations"
import { useExercisesByIds } from "@/features/exercises/queries"
import { useSettings } from "@/features/settings/queries"
import { useRestTimer } from "@/hooks/useRestTimer"
import { useCountdownTimer } from "@/hooks/useCountdownTimer"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { useElapsedTime } from "@/hooks/useElapsedTime"
import { playDingSound, unlockAudio } from "@/lib/audio"

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
    updateExerciseNotes
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

  // Handler for when rest timer completes
  const handleRestTimerComplete = useCallback(() => {
    playDingSound()
  }, [])

  const timer = useRestTimer({
    defaultDuration: restTimerDuration,
    onComplete: handleRestTimerComplete,
  })

  // Handler for when countdown timer completes
  const handleCountdownComplete = useCallback(
    (setId: string, workoutExerciseId: string) => {
      playDingSound()
      toggleSetComplete({ workoutExerciseId, setId })
      timer.start() // Start rest timer after completing timed set
    },
    [toggleSetComplete, timer]
  )

  const countdown = useCountdownTimer({ onComplete: handleCountdownComplete })

  // Unlock audio on first user interaction for Safari/iOS
  const handleUserInteraction = useCallback(() => {
    unlockAudio()
  }, [])

  // Track elapsed time for the workout
  const elapsed = useElapsedTime({
    startedAt: activeSession?.startedAt ?? new Date().toISOString(),
  })

  const workout = activeSession?.workout
  const exerciseIds = useMemo(
    () => workout?.exercises.map(e => e.exerciseId) ?? [],
    [workout?.exercises]
  )
  const { data: exercisesById = new Map() } = useExercisesByIds(exerciseIds)

  const handleFinish = useCallback(async () => {
    setIsFinishing(true)
    try {
      const completed = await finishWorkout()

      if (!completed) {
        toast.error("Failed to finish workout")
        return
      }

      if (saveAsTemplate && templateName.trim()) {
        const to0 = (n: number | undefined) => (Number.isFinite(n) ? n : 0)

        await createTemplateMutation.mutateAsync({
          name: templateName.trim(),
          exercises: completed.exercises.map((e) => {
            const reps = e.sets.find((s) => (s.reps ?? 0) > 0)?.reps
            const weight = e.sets.find((s) => (s.weight ?? 0) > 0)?.weight

            return {
              exerciseId: e.exerciseId,
              targetSets: e.sets.length,
              targetReps: to0(reps),
              targetWeight: to0(weight),
            }
          }),
        })
        toast.success(`Workout saved & template "${templateName.trim()}" created!`)
      } else {
        toast.success("Workout saved!")
      }

      navigate({ to: "/workout" })
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
      navigate({ to: "/workout" })
    } catch {
      toast.error("Failed to cancel workout")
    }
  }, [cancelWorkout, navigate])

  const handleToggleExpanded = useCallback((id: string) => {
    setExpandedExerciseId((prev) => (prev === id ? null : id))
  }, [])

  const handleAddExercise = useCallback(async (exerciseId: string) => {
    try {
      await addExercise(exerciseId)
    } catch {
      toast.error("Failed to add exercise")
    }
  }, [addExercise])

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

  const completedSets = useMemo(() => {
    return workout?.exercises.reduce(
      (sum, e) => sum + e.sets.filter((s) => s.isCompleted).length,
      0
    ) ?? 0
  }, [workout?.exercises])

  const totalSets = useMemo(() => {
    return workout?.exercises.reduce((sum, e) => sum + e.sets.length, 0) ?? 0
  }, [workout?.exercises])

  // Check if the workout has any meaningful changes that would warrant a discard warning
  const hasChanges = useCallback(() => {
    if (!workout || !activeSession) return false

    // If any set is completed, there are changes
    if (completedSets > 0) return true
    
    // If there's no template, check if any exercises were added
    if (!activeSession.templateId) {
      return workout.exercises.length > 0
    }
    
    // If started from template, check if exercises were added or removed
    const template = templates.find(
      (t) => t.id === activeSession.templateId
    )
    if (!template) return workout.exercises.length > 0
    
    // Different number of exercises means changes were made
    if (workout.exercises.length !== template.exercises.length) return true
    
    // Check if any exercise was swapped or if set counts changed
    for (let i = 0; i < workout.exercises.length; i++) {
      const workoutEx = workout.exercises[i]
      const templateEx = template.exercises[i]
      if (workoutEx.exerciseId !== templateEx.exerciseId) return true
      if (workoutEx.sets.length !== templateEx.targetSets) return true
    }
    
    return false
  }, [completedSets, activeSession, workout, templates])

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
    <div className="flex flex-col" onTouchStart={handleUserInteraction} onClick={handleUserInteraction}>
      <Header
        title={workout.name}
        showBack
        onBack={handleBack}
        bottomContent={
          timer.isRunning ? (
            <div className="border-t border-border bg-primary/5 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-primary" />
                  <span className="font-mono text-lg font-bold">
                    {timer.formattedTime}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={timer.pause}>
                    Pause
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => timer.start(timer.duration + 30)}
                  >
                    +30s
                  </Button>
                  <Button size="sm" variant="ghost" onClick={timer.reset}>
                    Skip
                  </Button>
                </div>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${timer.progress}%` }}
                />
              </div>
            </div>
          ) : undefined
        }
      />

      <div className="flex-1 space-y-4 p-4">
        {/* Progress Summary */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
          <div>
            <p className="text-sm text-muted-foreground">Progress</p>
            <p className="font-medium">
              {completedSets} / {totalSets} sets
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Elapsed</p>
            <p className="font-medium font-mono">{elapsed.formattedTime}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Exercises</p>
            <p className="font-medium">{workout.exercises.length}</p>
          </div>
        </div>

        {/* Exercises */}
        {workout.exercises.map((workoutExercise) => (
            <WorkoutExerciseCard
              key={workoutExercise.id}
              workoutExercise={workoutExercise}
              exercise={exercisesById.get(workoutExercise.exerciseId)}
              isExpanded={expandedExerciseId === workoutExercise.id}
              onToggleExpanded={handleToggleExpanded}
              onAddSet={addSet}
            onRemoveSet={(_weId, setId) => removeSet({ workoutExerciseId: workoutExercise.id, setId })}
            onUpdateSet={(_weId, setId, updates) => updateSet({ workoutExerciseId: workoutExercise.id, setId, updates })}
            onToggleSetComplete={(_weId, setId) => toggleSetComplete({ workoutExerciseId: workoutExercise.id, setId })}
            onRemoveExercise={removeExercise}
            onUpdateNotes={(notes) => updateExerciseNotes({ workoutExerciseId: workoutExercise.id, notes })}
            weightUnitLabel={weightUnit.unitLabel}
            activeSetId={countdown.activeSetId ?? undefined}
            countdownFormattedTime={countdown.formattedTime}
            countdownIsRunning={countdown.isRunning}
            onStartCountdown={countdown.start}
            onPauseCountdown={countdown.pause}
            onResumeCountdown={countdown.resume}
            onStartRestTimer={timer.start}
          />
        ))}

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
        onSelect={handleAddExercise}
        addedExerciseIds={workout.exercises.map((e) => e.exerciseId)}
      />

      {/* Finish Dialog */}
      <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish Workout?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              You completed {completedSets} of {totalSets} sets across{" "}
              {workout.exercises.length} exercises.
            </p>

            <div className="space-y-2">
              <Label className="flex items-center gap-3 py-2 cursor-pointer">
                <Checkbox 
                  checked={saveAsTemplate} 
                  onCheckedChange={(checked) => setSaveAsTemplate(!!checked)}
                />
                <span className="text-sm">Save as template</span>
              </Label>

              {saveAsTemplate && (
                <Input
                  placeholder="Template name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowFinishDialog(false)}
                disabled={isFinishing}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleFinish} disabled={isFinishing}>
                {isFinishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isFinishing ? "Saving..." : "Finish"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Workout?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              This will discard all your progress. Are you sure?
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelDialog(false)}
              >
                Keep Working
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleCancel}
              >
                Discard
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
