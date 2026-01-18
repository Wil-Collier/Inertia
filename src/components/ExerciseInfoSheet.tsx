import { useState } from "react"
import { Info, CheckCircle2 } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getExerciseInstructions } from "@/data/exerciseInstructions"
import { muscleGroupLabels } from "@/lib/muscleGroups"
import type { Exercise } from "@/lib/types"

interface ExerciseInfoSheetProps {
  exercise: Exercise | null
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export function ExerciseInfoSheet({ exercise, isOpen, onOpenChange }: ExerciseInfoSheetProps) {
  if (!exercise) return null

  const instructions = getExerciseInstructions(exercise.id)

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] max-h-[85vh] rounded-t-xl">
        <SheetHeader className="pb-0">
          <SheetTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            {exercise.name}
          </SheetTitle>
          <SheetDescription>
            {muscleGroupLabels[exercise.muscleGroup]}
            {exercise.isTimeBased && " • Time-based"}
            {!exercise.isWeighted && !exercise.isTimeBased && " • Bodyweight"}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 pb-4">
          <div className="space-y-6">
            {/* Instructions */}
            {instructions?.instructions && instructions.instructions.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  How to Perform
                </h3>
                <ol className="space-y-2">
                  {instructions.instructions.map((instruction, index) => (
                    <li key={index} className="flex gap-3 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {index + 1}
                      </span>
                      <span className="text-muted-foreground">{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* No instructions available */}
            {!instructions && (
              <div className="py-8 text-center">
                <Info className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No instructions available for this exercise yet.
                </p>
                {exercise.isCustom && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Custom exercises don't have built-in instructions.
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// Trigger button component for easy integration
export function ExerciseInfoButton({
  exercise,
  className,
}: {
  exercise: Exercise
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const instructions = getExerciseInstructions(exercise.id)

  // Only show button if there are instructions available
  if (!instructions) return null

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className={className}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(true)
        }}
        title="Exercise info"
      >
        <Info className="h-4 w-4" />
      </Button>
      <ExerciseInfoSheet exercise={exercise} isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  )
}
