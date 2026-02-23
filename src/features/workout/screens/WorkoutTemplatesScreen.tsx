import { useState, useMemo, useCallback } from "react"
import { useNavigate } from "@tanstack/react-router"
import { LayoutTemplate, Plus } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  TemplateCard,
  CreateTemplateDialog,
  DeleteTemplateDialog,
  TemplateEditSheet,
} from "@/features/workout/components/templates"
import { useActiveSessionActions } from "@/features/workout/hooks/useActiveSession"
import { useTemplates } from "@/features/workout/queries"
import {
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from "@/features/workout/mutations"
import { useExercisesByIds } from "@/features/exercises/queries"
import type { TemplateExercise, WorkoutTemplate } from "@/lib/types"

function sanitizeTemplateExercise(exercise: TemplateExercise): TemplateExercise {
  return {
    exerciseId: exercise.exerciseId,
    targetSets: exercise.targetSets,
    targetReps: exercise.targetReps,
  }
}

function normalizeTemplate(template: WorkoutTemplate): WorkoutTemplate {
  return {
    ...template,
    exercises: template.exercises.map(sanitizeTemplateExercise),
  }
}

export function WorkoutTemplates() {
  const navigate = useNavigate()
  const { startWorkout } = useActiveSessionActions()
  const createTemplateMutation = useCreateTemplate()
  const updateTemplateMutation = useUpdateTemplate()
  const deleteTemplateMutation = useDeleteTemplate()

  const { data: templates = [] } = useTemplates()

  // Resolve all exercise names in templates
  const allExerciseIds = useMemo(() => {
    return [
      ...new Set(
        templates.flatMap((template) =>
          template.exercises.map((exercise) => exercise.exerciseId)
        )
      ),
    ]
  }, [templates])
  const { data: exercisesById = new Map() } = useExercisesByIds(allExerciseIds)

  // Dialog/Sheet state
  const [templateToDelete, setTemplateToDelete] =
    useState<WorkoutTemplate | null>(null)
  const [editingTemplate, setEditingTemplate] =
    useState<WorkoutTemplate | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState("")
  const [editName, setEditName] = useState("")

  // Loading states
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const handleDelete = useCallback(async () => {
    if (!templateToDelete) return

    setIsDeleting(true)
    try {
      await deleteTemplateMutation.mutateAsync(templateToDelete.id)
      setTemplateToDelete(null)
    } catch {
      // Mutation toasts
    } finally {
      setIsDeleting(false)
    }
  }, [templateToDelete, deleteTemplateMutation])

  const handleCreate = useCallback(async () => {
    if (!newTemplateName.trim()) return

    setIsCreatingNew(true)
    try {
      const template = await createTemplateMutation.mutateAsync({
        name: newTemplateName.trim(),
        exercises: [],
      })
      setNewTemplateName("")
      setIsCreating(false)
      setEditingTemplate(normalizeTemplate(template))
      setEditName(template.name)
    } catch {
      // Mutation toasts
    } finally {
      setIsCreatingNew(false)
    }
  }, [newTemplateName, createTemplateMutation])

  const handleStartFromTemplate = useCallback(
    async (template: WorkoutTemplate) => {
      try {
        await startWorkout({ name: template.name, templateId: template.id })
        void navigate({ to: "/workout/active" })
      } catch {
        // Store already toasts
      }
    },
    [startWorkout, navigate]
  )

  const handleEditOpen = useCallback((template: WorkoutTemplate) => {
    setEditingTemplate(normalizeTemplate(template))
    setEditName(template.name)
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!editingTemplate || !editName.trim()) return false

    setIsSavingEdit(true)
    try {
      await updateTemplateMutation.mutateAsync({
        id: editingTemplate.id,
        updates: { name: editName.trim() },
      })
      return true
    } catch {
      // Mutation toasts
      return false
    } finally {
      setIsSavingEdit(false)
    }
  }, [editingTemplate, editName, updateTemplateMutation])

  const handleAddExercise = useCallback(
    async (exerciseId: string) => {
      if (!editingTemplate) return

      const updatedExercises = [
        ...editingTemplate.exercises.map(sanitizeTemplateExercise),
        { exerciseId, targetSets: 3, targetReps: 10 },
      ]

      try {
        await updateTemplateMutation.mutateAsync({
          id: editingTemplate.id,
          updates: { exercises: updatedExercises },
        })
        setEditingTemplate({
          ...editingTemplate,
          exercises: updatedExercises,
        })
      } catch {
        // Mutation toasts
      }
    },
    [editingTemplate, updateTemplateMutation]
  )

  const handleRemoveExercise = useCallback(
    async (exerciseId: string) => {
      if (!editingTemplate) return

      const updatedExercises = editingTemplate.exercises.filter(
        (e) => e.exerciseId !== exerciseId
      ).map(sanitizeTemplateExercise)

      try {
        await updateTemplateMutation.mutateAsync({
          id: editingTemplate.id,
          updates: { exercises: updatedExercises },
        })
        setEditingTemplate({
          ...editingTemplate,
          exercises: updatedExercises,
        })
      } catch {
        // Mutation toasts
      }
    },
    [editingTemplate, updateTemplateMutation]
  )

  const handleUpdateTargets = useCallback(
    async (
      exerciseId: string,
      field: "targetSets" | "targetReps",
      value: number
    ) => {
      if (!editingTemplate) return

      const updatedExercises = editingTemplate.exercises.map((exercise) => {
        const sanitized = sanitizeTemplateExercise(exercise)
        if (sanitized.exerciseId !== exerciseId) {
          return sanitized
        }

        return {
          ...sanitized,
          [field]: value,
        }
      })

      try {
        await updateTemplateMutation.mutateAsync({
          id: editingTemplate.id,
          updates: { exercises: updatedExercises },
        })
        setEditingTemplate({
          ...editingTemplate,
          exercises: updatedExercises,
        })
      } catch {
        // Mutation toasts
      }
    },
    [editingTemplate, updateTemplateMutation]
  )

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))]">
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

      <ScrollArea className="flex-1" hideScrollBar>
        <div className="space-y-4 p-4 pb-20">
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
              <TemplateCard
                key={template.id}
                template={template}
                exercisesById={exercisesById}
                onStart={(selectedTemplate) => void handleStartFromTemplate(selectedTemplate)}
                onEdit={handleEditOpen}
                onDelete={setTemplateToDelete}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Create Template Dialog */}
      <CreateTemplateDialog
        open={isCreating}
        onOpenChange={setIsCreating}
        templateName={newTemplateName}
        onTemplateNameChange={setNewTemplateName}
        onCreate={() => void handleCreate()}
        isCreating={isCreatingNew}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteTemplateDialog
        template={templateToDelete}
        onOpenChange={() => setTemplateToDelete(null)}
        onDelete={() => void handleDelete()}
        isDeleting={isDeleting}
      />

      {/* Edit Template Sheet */}
      <TemplateEditSheet
        template={editingTemplate}
        exercisesById={exercisesById}
        editName={editName}
        onEditNameChange={setEditName}
        onSave={handleSaveEdit}
        onClose={() => setEditingTemplate(null)}
        onAddExercise={handleAddExercise}
        onRemoveExercise={handleRemoveExercise}
        onUpdateTargets={handleUpdateTargets}
        isSaving={isSavingEdit}
      />
    </div>
  )
}
