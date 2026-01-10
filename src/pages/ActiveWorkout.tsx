import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Plus,
  X,
  Check,
  Trash2,
  Timer,
  Save,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useWorkoutStore } from "@/stores/workoutStore"
import { useExerciseStore } from "@/stores/exerciseStore"
import { useRestTimer } from "@/hooks/useRestTimer"
import { cn } from "@/lib/utils"
import type { MuscleGroup } from "@/lib/types"
import { muscleGroupLabels } from "@/data/defaultExercises"

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
  } = useWorkoutStore()

  const { exercises, getExercise } = useExerciseStore()
  const [showExerciseSheet, setShowExerciseSheet] = useState(false)
  const [showFinishDialog, setShowFinishDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(
    new Set()
  )

  const timer = useRestTimer({ defaultDuration: 90 })

  if (!activeSession) {
    navigate("/workout")
    return null
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

  const exercisesByGroup = exercises.reduce(
    (acc, ex) => {
      if (!acc[ex.muscleGroup]) {
        acc[ex.muscleGroup] = []
      }
      acc[ex.muscleGroup].push(ex)
      return acc
    },
    {} as Record<MuscleGroup, typeof exercises>
  )

  const completedSets = workout.exercises.reduce(
    (sum, e) => sum + e.sets.filter((s) => s.completed).length,
    0
  )
  const totalSets = workout.exercises.reduce((sum, e) => sum + e.sets.length, 0)

  return (
    <div className="flex flex-col">
      <Header
        title={workout.name}
        showBack
        rightAction={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCancelDialog(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        }
      />

      {/* Rest Timer */}
      {timer.isRunning && (
        <div className="border-b border-border bg-primary/5 px-4 py-3">
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
      )}

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

          return (
            <Card key={workoutExercise.id}>
              <CardHeader
                className="cursor-pointer py-3"
                onClick={() => toggleExpanded(workoutExercise.id)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {exercise?.name || "Unknown Exercise"}
                  </CardTitle>
                  <div className="flex items-center gap-2">
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
                  <div className="grid grid-cols-[1fr_3fr_3fr_auto] gap-2 text-xs text-muted-foreground">
                    <span>Set</span>
                    <span>Weight</span>
                    <span>Reps</span>
                    <span className="w-8"></span>
                  </div>

                  {/* Sets */}
                  {workoutExercise.sets.map((set, index) => (
                    <div
                      key={set.id}
                      className={cn(
                        "grid grid-cols-[1fr_3fr_3fr_auto] items-center gap-2",
                        set.completed && "opacity-60"
                      )}
                    >
                      <span className="text-sm font-medium">{index + 1}</span>
                      <Input
                        type="number"
                        value={set.weight || ""}
                        onChange={(e) =>
                          updateSet(workoutExercise.id, set.id, {
                            weight: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="lbs"
                        className="h-9"
                        disabled={set.completed}
                      />
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
                      <div className="flex gap-1">
                        <Button
                          size="icon-sm"
                          variant={set.completed ? "default" : "outline"}
                          onClick={() => {
                            toggleSetComplete(workoutExercise.id, set.id)
                            if (!set.completed) {
                              timer.start()
                            }
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        {!set.completed && workoutExercise.sets.length > 1 && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() =>
                              removeSet(workoutExercise.id, set.id)
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

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
      <Sheet open={showExerciseSheet} onOpenChange={setShowExerciseSheet}>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle>Add Exercise</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-full pr-4">
            <div className="space-y-6 py-4">
              {(Object.keys(exercisesByGroup) as MuscleGroup[]).map((group) => (
                <div key={group}>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                    {muscleGroupLabels[group]}
                  </h3>
                  <div className="space-y-1">
                    {exercisesByGroup[group].map((exercise) => (
                      <Button
                        key={exercise.id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => {
                          addExerciseToWorkout(exercise.id)
                          setExpandedExercises(
                            (prev) =>
                              new Set([
                                ...prev,
                                workout.exercises[workout.exercises.length - 1]
                                  ?.id,
                              ].filter(Boolean))
                          )
                          setShowExerciseSheet(false)
                        }}
                      >
                        {exercise.name}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

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
