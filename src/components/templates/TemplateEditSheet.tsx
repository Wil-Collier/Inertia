import { Dumbbell, Plus, Trash2, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ExercisePickerSheet } from "@/components/ExercisePickerSheet"
import type { WorkoutTemplate, Exercise } from "@/lib/types"
import { useState } from "react"

interface TemplateEditSheetProps {
  template: WorkoutTemplate | null
  exercisesById: Map<string, Exercise>
  editName: string
  onEditNameChange: (name: string) => void
  onSave: () => Promise<boolean>
  onClose: () => void
  onAddExercise: (exerciseId: string) => Promise<void>
  onRemoveExercise: (exerciseId: string) => Promise<void>
  onUpdateTargets: (
    exerciseId: string,
    field: "targetSets" | "targetReps" | "targetWeight",
    value: number
  ) => Promise<void>
  isSaving: boolean
}

export function TemplateEditSheet({
  template,
  exercisesById,
  editName,
  onEditNameChange,
  onSave,
  onClose,
  onAddExercise,
  onRemoveExercise,
  onUpdateTargets,
  isSaving,
}: TemplateEditSheetProps) {
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false)

  const handleAddExercise = async (exerciseId: string) => {
    await onAddExercise(exerciseId)
    setIsAddExerciseOpen(false)
  }

  return (
    <>
      <Sheet open={template !== null} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="h-[85vh]">
          <SheetHeader>
            <SheetTitle>Edit Template</SheetTitle>
          </SheetHeader>

          {template && (
            <div className="flex flex-col gap-4 h-[calc(85vh-100px)] p-4">
              {/* Template Name */}
              <div className="flex gap-2 mx-auto w-full max-w-lg">
                <Input
                  value={editName}
                  onChange={(e) => onEditNameChange(e.target.value)}
                  placeholder="Template name"
                  className="flex-1"
                />
              </div>

              {/* Exercises List */}
              <ScrollArea className="flex-1 overflow-hidden">
                <div className="mx-auto w-full max-w-lg space-y-3">
                  {template.exercises.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <Dumbbell className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        No exercises yet. Add some to get started!
                      </p>
                    </div>
                  ) : (
                    template.exercises.map((templateExercise, index) => {
                      const exercise = exercisesById.get(templateExercise.exerciseId)
                      return (
                        <Card key={templateExercise.exerciseId}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">
                                {index + 1}. {exercise?.name ?? "Unknown"}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                onClick={() => void onRemoveExercise(templateExercise.exerciseId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-xs">Sets</Label>
                                <Input
                                  type="number"
                                  value={templateExercise.targetSets}
                                  onChange={(e) => void onUpdateTargets(
                                      templateExercise.exerciseId,
                                      "targetSets",
                                      parseInt(e.target.value) || 1
                                    )}
                                  min={1}
                                  className="mt-1 h-8"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Reps</Label>
                                <Input
                                  type="number"
                                  value={templateExercise.targetReps ?? ""}
                                  onChange={(e) => void onUpdateTargets(
                                      templateExercise.exerciseId,
                                      "targetReps",
                                      parseInt(e.target.value) || 0
                                    )}
                                  min={0}
                                  className="mt-1 h-8"
                                  placeholder="-"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Weight</Label>
                                <Input
                                  type="number"
                                  value={templateExercise.targetWeight ?? ""}
                                  onChange={(e) => void onUpdateTargets(
                                      templateExercise.exerciseId,
                                      "targetWeight",
                                      parseInt(e.target.value) || 0
                                    )}
                                  min={0}
                                  className="mt-1 h-8"
                                  placeholder="-"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })
                  )}

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsAddExerciseOpen(true)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add Exercise
                  </Button>
                </div>
              </ScrollArea>
              <div className="pt-2">
                <Button
                  className="w-full"
                  disabled={!editName.trim() || isSaving}
                  onClick={() => {
                    void (async () => {
                      if (editName.trim() !== template.name) {
                        const success = await onSave()
                        if (!success) return
                      }
                      onClose()
                    })()
                  }}
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Exercise Sheet */}
      <ExercisePickerSheet
        isOpen={isAddExerciseOpen}
        onOpenChange={setIsAddExerciseOpen}
        onSelect={(exerciseId) => void handleAddExercise(exerciseId)}
        addedExerciseIds={template?.exercises.map((e) => e.exerciseId) ?? []}
      />
    </>
  )
}
