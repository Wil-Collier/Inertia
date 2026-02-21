import { Play, Pencil, Trash2, LayoutTemplate } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { WorkoutTemplate, Exercise } from "@/lib/types"

interface TemplateCardProps {
  template: WorkoutTemplate
  exercisesById: Map<string, Exercise>
  onStart: (template: WorkoutTemplate) => void
  onEdit: (template: WorkoutTemplate) => void
  onDelete: (template: WorkoutTemplate) => void
}

export function TemplateCard({
  template,
  exercisesById,
  onStart,
  onEdit,
  onDelete,
}: TemplateCardProps) {
  return (
    <Card>
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
                  .map((templateExercise) =>
                    exercisesById.get(templateExercise.exerciseId)?.name
                  )
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
            onClick={() => onStart(template)}
          >
            <Play className="mr-1 h-4 w-4" />
            Start
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(template)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(template)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
