import { useState, useCallback } from "react"
import { useNavigate, Navigate } from "react-router-dom"
import {
  Plus,
  Check,
  Trash2,
  Timer,
  Save,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  TrendingUp,
  StickyNote,
} from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DurationInput } from "@/components/ui/duration-input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ExercisePickerSheet } from "@/components/ExercisePickerSheet"
import { ExerciseInfoButton } from "@/components/ExerciseInfoSheet"
import { useWorkoutStore } from "@/stores/workoutStore"
import { useExerciseStore } from "@/stores/exerciseStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { useRestTimer } from "@/hooks/useRestTimer"
import { useCountdownTimer } from "@/hooks/useCountdownTimer"
import { useWeightUnit } from "@/hooks/useWeightUnit"
import { playDingSound, unlockAudio } from "@/lib/audio"
import { cn } from "@/lib/utils"
import { format, parseISO } from "date-fns"

export function ActiveWorkout() {
  const navigate = useNavigate()
  const {
    activeSession,
    finishWorkout,
    cancelWorkout,
    addExerciseToWorkout,
    removeExerciseFromWorkout,
    addSet,
    updateSet,
    removeSet,
    toggleSetComplete,
    createTemplate,
    updateExerciseNotes,
    getProgressionSuggestion,
    applyProgressionSuggestion,
  } = useWorkoutStore()

  const { getExercise } = useExerciseStore()
  const { settings } = useSettingsStore()
  const weightUnit = useWeightUnit()
  const [showExerciseSheet, setShowExerciseSheet] = useState(false)
  const [showFinishDialog, setShowFinishDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(
    new Set()
  )

  // Handler for when rest timer completes
  const handleRestTimerComplete = useCallback(() => {
    playDingSound()
  }, [])

  const timer = useRestTimer({
    defaultDuration: settings.restTimerDuration,
    onComplete: handleRestTimerComplete,
  })

  // Handler for when countdown timer completes
  const handleCountdownComplete = useCallback(
    (setId: string, workoutExerciseId: string) => {
      playDingSound()
      toggleSetComplete(workoutExerciseId, setId)
      timer.start() // Start rest timer after completing timed set
    },
    [toggleSetComplete, timer]
  )

  const countdown = useCountdownTimer({ onComplete: handleCountdownComplete })

  // Unlock audio on first user interaction for Safari/iOS
  const handleUserInteraction = useCallback(() => {
    unlockAudio()
  }, [])

  if (!activeSession) {
    return <Navigate to="/workout" replace />
  }

  const { workout } = activeSession

  const handleFinish = () => {
    const completed = finishWorkout()
    if (completed && saveAsTemplate && templateName.trim()) {
      createTemplate(templateName.trim(), completed)
    }
    navigate("/workout")
  }

  const handleCancel = () => {
    cancelWorkout()
    navigate("/workout")
  }

  const toggleExpanded = (id: string) => {
    setExpandedExercises((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleAddExercise = (exerciseId: string) => {
    addExerciseToWorkout(exerciseId)
    // Expand the newly added exercise
    setTimeout(() => {
      const newExercise = workout.exercises[workout.exercises.length - 1]
      if (newExercise) {
        setExpandedExercises((prev) => new Set([...prev, newExercise.id]))
      }
    }, 0)
  }

  const completedSets = workout.exercises.reduce(
    (sum, e) => sum + e.sets.filter((s) => s.completed).length,
    0
  )
  const totalSets = workout.exercises.reduce((sum, e) => sum + e.sets.length, 0)

  // Check if the workout has any meaningful changes that would warrant a discard warning
  const hasChanges = () => {
    // If any set is completed, there are changes
    if (completedSets > 0) return true
    
    // If there's no template, check if any exercises were added
    if (!activeSession.templateId) {
      return workout.exercises.length > 0
    }
    
    // If started from template, check if exercises were added or removed
    const template = useWorkoutStore.getState().templates.find(
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
  }

  const handleBack = () => {
    if (hasChanges()) {
      setShowCancelDialog(true)
    } else {
      // No changes, just cancel without confirmation
      handleCancel()
    }
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
            <p className="text-sm text-muted-foreground">Exercises</p>
            <p className="font-medium">{workout.exercises.length}</p>
          </div>
        </div>

        {/* Exercises */}
        {workout.exercises.map((workoutExercise) => {
          const exercise = getExercise(workoutExercise.exerciseId)
          const isExpanded = expandedExercises.has(workoutExercise.id)
          const hasLastPerformance = !!workoutExercise.lastPerformanceDate
          const isWeightedExercise = exercise?.isWeighted && !exercise?.isTimeBased
          const isTimeBasedExercise = exercise?.isTimeBased ?? false
          
          // Get smart progression suggestion
          const suggestion = hasLastPerformance 
            ? getProgressionSuggestion(workoutExercise.exerciseId, isTimeBasedExercise)
            : null

          return (
            <Card key={workoutExercise.id}>
              <CardHeader
                className="cursor-pointer py-3"
                onClick={() => toggleExpanded(workoutExercise.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <CardTitle className="text-base">
                        {exercise?.name || "Unknown Exercise"}
                      </CardTitle>
                      {exercise && <ExerciseInfoButton exercise={exercise} />}
                      {/* Ready to progress badge */}
                      {suggestion?.type === "increase" && (
                        <span className="ml-1 inline-flex items-center rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                          Ready
                        </span>
                      )}
                    </div>
                    {hasLastPerformance && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Last: {format(parseISO(workoutExercise.lastPerformanceDate!), "MMM d")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Smart progression button for weighted exercises with history */}
                    {hasLastPerformance && isWeightedExercise && suggestion && (
                      <Button
                        size="sm"
                        variant={suggestion.type === "increase" ? "default" : "outline"}
                        className={cn(
                          "h-7 px-2 text-xs font-medium",
                          suggestion.type === "increase" && "bg-green-600 hover:bg-green-700"
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          applyProgressionSuggestion(workoutExercise.id, suggestion)
                        }}
                        title={suggestion.reason}
                      >
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {suggestion.type === "increase" 
                          ? `Try ${weightUnit.format(suggestion.suggestedWeight, { showUnit: false })} ${weightUnit.unitLabel}`
                          : weightUnit.formatIncrement(suggestion.increment)
                        }
                      </Button>
                    )}
                    {/* Smart progression button for time-based exercises */}
                    {hasLastPerformance && isTimeBasedExercise && suggestion && (
                      <Button
                        size="sm"
                        variant={suggestion.type === "increase" ? "default" : "outline"}
                        className={cn(
                          "h-7 px-2 text-xs font-medium",
                          suggestion.type === "increase" && "bg-green-600 hover:bg-green-700"
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          applyProgressionSuggestion(workoutExercise.id, suggestion)
                        }}
                        title={suggestion.reason}
                      >
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {suggestion.suggestedDuration 
                          ? `Try ${Math.floor(suggestion.suggestedDuration / 60)}:${(suggestion.suggestedDuration % 60).toString().padStart(2, '0')}`
                          : `+${suggestion.increment}s`
                        }
                      </Button>
                    )}
                    {/* Notes indicator */}
                    {workoutExercise.notes && (
                      <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {workoutExercise.sets.filter((s) => s.completed).length}/
                      {workoutExercise.sets.length}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="space-y-3 pt-0">
                  {/* Sets Header */}
                  <div className={cn(
                    "gap-2 text-xs text-muted-foreground grid",
                    exercise?.isTimeBased
                      ? "grid-cols-[1fr_4fr_auto]"
                      : exercise?.isWeighted 
                        ? "grid-cols-[1fr_3fr_3fr_auto]" 
                        : "grid-cols-[1fr_6fr_auto]"
                  )}>
                    <span>Set</span>
                    {exercise?.isWeighted && !exercise?.isTimeBased && <span>Weight</span>}
                    <span>{exercise?.isTimeBased ? "Duration" : "Reps"}</span>
                    <span className="w-8"></span>
                  </div>

                  {/* Sets */}
                  {workoutExercise.sets.map((set, index) => {
                    const isTimeBased = exercise?.isTimeBased ?? false
                    const isActiveCountdown = countdown.activeSetId === set.id
                    const canComplete = isTimeBased
                      ? set.reps > 0 // reps stores duration in seconds for time-based
                      : exercise?.isWeighted 
                        ? set.weight > 0 && set.reps > 0
                        : set.reps > 0

                    return (
                      <div
                        key={set.id}
                        className={cn(
                          "items-center gap-2 grid",
                          isTimeBased
                            ? "grid-cols-[1fr_4fr_auto]"
                            : exercise?.isWeighted 
                              ? "grid-cols-[1fr_3fr_3fr_auto]" 
                              : "grid-cols-[1fr_6fr_auto]",
                          set.completed && "opacity-60"
                        )}
                      >
                        <span className="text-sm font-medium">{index + 1}</span>
                        
                        {/* Weight input (only for weighted, non-time-based exercises) */}
                        {exercise?.isWeighted && !isTimeBased && (
                          <Input
                            type="number"
                            value={set.weight || ""}
                            onChange={(e) =>
                              updateSet(workoutExercise.id, set.id, {
                                weight: parseFloat(e.target.value) || 0,
                              })
                            }
                            placeholder={weightUnit.unitLabel}
                            className="h-9"
                            disabled={set.completed}
                          />
                        )}

                        {/* Duration input/countdown for time-based exercises */}
                        {isTimeBased ? (
                          isActiveCountdown ? (
                            /* Show countdown in place of duration input */
                            <div className="flex h-9 items-center justify-center rounded-md border bg-primary/10 font-mono text-lg font-bold text-primary">
                              {countdown.formattedTime}
                            </div>
                          ) : (
                            /* Show editable duration input */
                            <DurationInput
                              value={set.reps} // reps stores duration in seconds
                              onChange={(seconds) =>
                                updateSet(workoutExercise.id, set.id, {
                                  reps: seconds,
                                })
                              }
                              disabled={set.completed}
                            />
                          )
                        ) : (
                          /* Reps input for non-time-based exercises */
                          <Input
                            type="number"
                            value={set.reps || ""}
                            onChange={(e) =>
                              updateSet(workoutExercise.id, set.id, {
                                reps: parseInt(e.target.value) || 0,
                              })
                            }
                            placeholder="reps"
                            className="h-9"
                            disabled={set.completed}
                          />
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-1">
                          {isTimeBased && !set.completed ? (
                            /* Time-based exercise: Play/Pause button */
                            isActiveCountdown ? (
                              /* Show pause or resume button based on running state */
                              <Button
                                size="icon-sm"
                                variant={countdown.isRunning ? "default" : "outline"}
                                onClick={() => {
                                  if (countdown.isRunning) {
                                    countdown.pause()
                                  } else {
                                    countdown.resume()
                                  }
                                }}
                              >
                                {countdown.isRunning ? (
                                  <Pause className="h-3 w-3" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                              </Button>
                            ) : (
                              /* Show play button to start */
                              <Button
                                size="icon-sm"
                                variant="outline"
                                disabled={!canComplete}
                                onClick={() => {
                                  if (canComplete) {
                                    countdown.start(set.id, workoutExercise.id, set.reps)
                                  }
                                }}
                              >
                                <Play className="h-3 w-3" />
                              </Button>
                            )
                          ) : (
                            /* Rep-based exercise or completed: Check button */
                            <Button
                              size="icon-sm"
                              variant={set.completed ? "default" : "outline"}
                              disabled={!set.completed && !canComplete}
                              onClick={() => {
                                if (set.completed || canComplete) {
                                  toggleSetComplete(workoutExercise.id, set.id)
                                  if (!set.completed) {
                                    timer.start()
                                  }
                                }
                              }}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          {!set.completed && !isActiveCountdown && workoutExercise.sets.length > 1 ? (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() =>
                                removeSet(workoutExercise.id, set.id)
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          ) : (
                            /* Invisible placeholder to maintain layout */
                            workoutExercise.sets.length > 1 && (
                              <div className="w-7 h-7" />
                            )
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Add Set & Remove Exercise */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => addSet(workoutExercise.id)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add Set
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        removeExerciseFromWorkout(workoutExercise.id)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Notes */}
                  <div className="pt-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Notes</span>
                    </div>
                    <Input
                      value={workoutExercise.notes || ""}
                      onChange={(e) =>
                        updateExerciseNotes(workoutExercise.id, e.target.value)
                      }
                      placeholder="Add a note for this exercise..."
                      className="h-8 text-sm"
                    />
                  </div>
                </CardContent>
              )}
            </Card>
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
        open={showExerciseSheet}
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
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={saveAsTemplate}
                  onChange={(e) => setSaveAsTemplate(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm">Save as template</span>
              </label>

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
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleFinish}>
                Finish
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
