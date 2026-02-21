import { useState, useEffect } from "react"
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
import { muscleGroupLabels } from "@/lib/muscleGroups"
import type { Exercise } from "@/lib/types"

interface ExerciseInstruction {
  instructions: string[]
}

// Dynamically load exercise instructions to keep exercises.json out of main bundle
async function loadExerciseInstructions(exerciseId: string): Promise<ExerciseInstruction | undefined> {
  const { getExerciseInstructions } = await import("@/data/exerciseInstructions")
  return getExerciseInstructions(exerciseId)
}

// Hook to load instructions asynchronously
function useExerciseInstructions(exerciseId: string | undefined, isEnabled: boolean) {
  const [instructions, setInstructions] = useState<ExerciseInstruction | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!exerciseId) {
      setInstructions(undefined)
      setIsLoading(false)
      return
    }

    if (!isEnabled) {
      return
    }

    let cancelled = false
    setIsLoading(true)

    void loadExerciseInstructions(exerciseId).then((result) => {
      if (!cancelled) {
        setInstructions(result)
        setIsLoading(false)
      }
      return result
    })

    return () => {
      cancelled = true
    }
  }, [exerciseId, isEnabled])

  return { instructions, isLoading }
}

interface ExerciseInfoSheetProps {
  exercise: Exercise | null
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export function ExerciseInfoSheet({ exercise, isOpen, onOpenChange }: ExerciseInfoSheetProps) {
  const { instructions, isLoading } = useExerciseInstructions(exercise?.id, isOpen)

  if (!exercise) return null

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
            {exercise.isTimeBased && " - Time-based"}
            {!exercise.isWeighted && !exercise.isTimeBased && " - Bodyweight"}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 pb-4">
          <div className="space-y-6">
            {/* Loading state */}
            {isLoading && (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">Loading instructions...</p>
              </div>
            )}

            {/* Description */}
            {exercise.description && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">
                  Description
                </h3>
                <p className="text-sm text-muted-foreground">{exercise.description}</p>
              </div>
            )}

            {/* Instructions */}
            {!isLoading && instructions?.instructions && instructions.instructions.length > 0 && (
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  How to Perform
                </h3>
                <ol className="space-y-2">
                  {instructions.instructions.map((instruction, index) => (
                    <li key={instruction} className="flex gap-3 text-sm">
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
            {!isLoading && !instructions && !exercise.description && (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No description provided
                </p>
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
  const [hasOpened, setHasOpened] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className={className}
        onClick={(e) => {
          e.stopPropagation()
          setHasOpened(true)
          setIsOpen(true)
        }}
        title="Exercise info"
      >
        <Info className="h-4 w-4" />
      </Button>
      {hasOpened && <ExerciseInfoSheet exercise={exercise} isOpen={isOpen} onOpenChange={setIsOpen} />}
    </>
  )
}
