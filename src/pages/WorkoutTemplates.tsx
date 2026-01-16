import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  LayoutTemplate,
  Dumbbell,
  Play,
  Trash2,
  Pencil,
  Plus,
} from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ExercisePickerSheet } from "@/components/ExercisePickerSheet"
import { useWorkoutStore } from "@/stores/workout"
import { useExerciseStore } from "@/stores/exerciseStore"
import type { WorkoutTemplate } from "@/lib/types"

export function WorkoutTemplates() {
  const navigate = useNavigate()
  const { templates, deleteTemplate, createTemplate, updateTemplate, startWorkout } =
    useWorkoutStore()
  const { getExercise } = useExerciseStore()

  const [templateToDelete, setTemplateToDelete] = useState<WorkoutTemplate | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState("")
  const [editName, setEditName] = useState("")
  const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false)

  const handleDelete = () => {
    if (templateToDelete) {
      deleteTemplate(templateToDelete.id)
      setTemplateToDelete(null)
    }
  }

  const handleCreate = () => {
    if (newTemplateName.trim()) {
      const template = createTemplate(newTemplateName.trim())
      setNewTemplateName("")
      setIsCreating(false)
      setEditingTemplate(template)
      setEditName(template.name)
    }
  }

  const handleStartFromTemplate = (template: WorkoutTemplate) => {
    startWorkout(template.name, template.id)
    navigate("/workout/active")
  }

  const handleEditOpen = (template: WorkoutTemplate) => {
    setEditingTemplate(template)
    setEditName(template.name)
  }

  const handleSaveEdit = () => {
    if (editingTemplate && editName.trim()) {
      updateTemplate(editingTemplate.id, { name: editName.trim() })
      // Refresh the editing template
      const updated = templates.find((t) => t.id === editingTemplate.id)
      if (updated) {
        setEditingTemplate({ ...updated, name: editName.trim() })
      }
    }
  }

  const handleAddExercise = (exerciseId: string) => {
    if (editingTemplate) {
      const updatedExercises = [
        ...editingTemplate.exercises,
        { exerciseId, targetSets: 3, targetReps: 10 },
      ]
      updateTemplate(editingTemplate.id, { exercises: updatedExercises })
      setEditingTemplate({
        ...editingTemplate,
        exercises: updatedExercises,
      })
    }
    setIsAddExerciseOpen(false)
  }

  const handleRemoveExercise = (exerciseId: string) => {
    if (editingTemplate) {
      const updatedExercises = editingTemplate.exercises.filter(
        (e) => e.exerciseId !== exerciseId
      )
      updateTemplate(editingTemplate.id, { exercises: updatedExercises })
      setEditingTemplate({
        ...editingTemplate,
        exercises: updatedExercises,
      })
    }
  }

  const handleUpdateTargets = (
    exerciseId: string,
    field: "targetSets" | "targetReps" | "targetWeight",
    value: number
  ) => {
    if (editingTemplate) {
      const updatedExercises = editingTemplate.exercises.map((e) =>
        e.exerciseId === exerciseId ? { ...e, [field]: value } : e
      )
      updateTemplate(editingTemplate.id, { exercises: updatedExercises })
      setEditingTemplate({
        ...editingTemplate,
        exercises: updatedExercises,
      })
    }
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Templates"
        showBack
        rightAction={
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(true)}>
            <Plus className="mr-1 h-4 w-4" />
            New
          </Button>
        }
      />

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {templates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <LayoutTemplate className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">No templates yet</p>
                <p className="mb-4 text-sm text-muted-foreground">
                  Create a template to quickly start workouts
                </p>
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="mr-1 h-4 w-4" />
                  Create Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            templates.map((template) => (
              <Card key={template.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <LayoutTemplate className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{template.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {template.exercises.length} exercises
                      </p>
                      {template.exercises.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {template.exercises
                            .slice(0, 3)
                            .map((e) => getExercise(e.exerciseId)?.name)
                            .filter(Boolean)
                            .join(", ")}
                          {template.exercises.length > 3 &&
                            ` +${template.exercises.length - 3} more`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleStartFromTemplate(template)}
                    >
                      <Play className="mr-1 h-4 w-4" />
                      Start
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditOpen(template)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setTemplateToDelete(template)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Create Template Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="e.g., Push Day, Upper Body"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate()
                }}
              />
            </div>
            <Button onClick={handleCreate} className="w-full">
              Create Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={templateToDelete !== null}
        onOpenChange={(open) => !open && setTemplateToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Sheet */}
      <Sheet
        open={editingTemplate !== null}
        onOpenChange={(open) => !open && setEditingTemplate(null)}
      >
        <SheetContent side="bottom" className="h-[85vh]">
          <SheetHeader>
            <SheetTitle>Edit Template</SheetTitle>
          </SheetHeader>

          {editingTemplate && (
            <div className="flex flex-col gap-4 h-[calc(85vh-100px)] p-4">
              {/* Template Name */}
              <div className="flex gap-2 mx-auto w-full max-w-lg">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Template name"
                  className="flex-1"
                />
                <Button onClick={handleSaveEdit} disabled={!editName.trim()}>
                  Save
                </Button>
              </div>

              {/* Exercises List */}
              <ScrollArea className="flex-1 overflow-hidden">
                <div className="mx-auto w-full max-w-lg space-y-3">
                  {editingTemplate.exercises.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center">
                      <Dumbbell className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        No exercises yet. Add some to get started!
                      </p>
                    </div>
                  ) : (
                    editingTemplate.exercises.map((te, index) => {
                      const exercise = getExercise(te.exerciseId)
                      return (
                        <Card key={te.exerciseId}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">
                                {index + 1}. {exercise?.name ?? "Unknown"}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemoveExercise(te.exerciseId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-xs">Sets</Label>
                                <Input
                                  type="number"
                                  value={te.targetSets}
                                  onChange={(e) =>
                                    handleUpdateTargets(
                                      te.exerciseId,
                                      "targetSets",
                                      parseInt(e.target.value) || 1
                                    )
                                  }
                                  min={1}
                                  className="mt-1 h-8"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Reps</Label>
                                <Input
                                  type="number"
                                  value={te.targetReps ?? ""}
                                  onChange={(e) =>
                                    handleUpdateTargets(
                                      te.exerciseId,
                                      "targetReps",
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  min={0}
                                  className="mt-1 h-8"
                                  placeholder="-"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Weight</Label>
                                <Input
                                  type="number"
                                  value={te.targetWeight ?? ""}
                                  onChange={(e) =>
                                    handleUpdateTargets(
                                      te.exerciseId,
                                      "targetWeight",
                                      parseInt(e.target.value) || 0
                                    )
                                  }
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
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Exercise Sheet */}
      <ExercisePickerSheet
        open={isAddExerciseOpen}
        onOpenChange={setIsAddExerciseOpen}
        onSelect={handleAddExercise}
        addedExerciseIds={editingTemplate?.exercises.map((e) => e.exerciseId) ?? []}
      />
    </div>
  )
}
