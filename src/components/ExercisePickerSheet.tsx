import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useExerciseStore } from "@/stores/exerciseStore"
import type { MuscleGroup } from "@/lib/types"

const muscleGroups: MuscleGroup[] = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "core",
  "cardio",
]

const muscleGroupLabels: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  legs: "Legs",
  core: "Core",
  cardio: "Cardio",
}

interface ExercisePickerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (exerciseId: string) => void
  /** Array of exercise IDs that are already added (shown with "Added" indicator) */
  addedExerciseIds?: string[]
}

export function ExercisePickerSheet({
  open,
  onOpenChange,
  onSelect,
  addedExerciseIds = [],
}: ExercisePickerSheetProps) {
  const { exercises } = useExerciseStore()
  const [selectedMuscleGroup, setSelectedMuscleGroup] =
    useState<MuscleGroup | null>(null)

  const filteredExercises = selectedMuscleGroup
    ? exercises.filter((e) => e.muscleGroup === selectedMuscleGroup)
    : exercises

  // Group exercises by muscle group for display
  const exercisesByGroup = filteredExercises.reduce(
    (acc, ex) => {
      if (!acc[ex.muscleGroup]) {
        acc[ex.muscleGroup] = []
      }
      acc[ex.muscleGroup].push(ex)
      return acc
    },
    {} as Record<MuscleGroup, typeof exercises>
  )

  const handleSelect = (exerciseId: string) => {
    onSelect(exerciseId)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>Add Exercise</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex h-[calc(80vh-80px)] flex-col">
          {/* Muscle Group Filter */}
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              variant={selectedMuscleGroup === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedMuscleGroup(null)}
            >
              All
            </Button>
            {muscleGroups.map((mg) => (
              <Button
                key={mg}
                variant={selectedMuscleGroup === mg ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedMuscleGroup(mg)}
              >
                {muscleGroupLabels[mg]}
              </Button>
            ))}
          </div>

          {/* Exercise List */}
          <ScrollArea className="flex-1 overflow-hidden">
            <div className="space-y-6 pr-4">
              {(Object.keys(exercisesByGroup) as MuscleGroup[]).map((group) => (
                <div key={group}>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                    {muscleGroupLabels[group]}
                  </h3>
                  <div className="space-y-1">
                    {exercisesByGroup[group].map((exercise) => {
                      const isAdded = addedExerciseIds.includes(exercise.id)
                      return (
                        <button
                          key={exercise.id}
                          className={`flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors ${
                            isAdded
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted"
                          }`}
                          onClick={() => !isAdded && handleSelect(exercise.id)}
                          disabled={isAdded}
                        >
                          <span className="font-medium">{exercise.name}</span>
                          {isAdded && (
                            <span className="text-xs text-primary">Added</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
