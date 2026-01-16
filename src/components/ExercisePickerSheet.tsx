import { useState, useMemo, useEffect } from "react"
import { Search, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ExerciseInfoButton } from "@/components/ExerciseInfoSheet"
import { useExerciseStore } from "@/stores/exerciseStore"
import { ensureExercisesLoaded } from "@/data/exerciseLoader"
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

import { muscleGroupLabels } from "@/lib/muscleGroups"

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
  const { exercises, isLoaded, setDefaultExercises } = useExerciseStore()
  const [selectedMuscleGroup, setSelectedMuscleGroup] =
    useState<MuscleGroup | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoadingExercises, setIsLoadingExercises] = useState(false)

  // Load exercises when sheet opens
  useEffect(() => {
    if (open && !isLoaded) {
      setIsLoadingExercises(true)
      ensureExercisesLoaded(setDefaultExercises, isLoaded)
        .finally(() => {
          setIsLoadingExercises(false)
        })
    }
  }, [open, isLoaded, setDefaultExercises])

  // Filter exercises by search query and muscle group
  const filteredExercises = useMemo(() => {
    let result = exercises

    // Filter by muscle group
    if (selectedMuscleGroup) {
      result = result.filter((e) => e.muscleGroup === selectedMuscleGroup)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter((e) => e.name.toLowerCase().includes(query))
    }

    return result
  }, [exercises, selectedMuscleGroup, searchQuery])

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
    <Sheet open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setSearchQuery("")
        setSelectedMuscleGroup(null)
      }
      onOpenChange(isOpen)
    }}>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>Add Exercise</SheetTitle>
        </SheetHeader>

        <div className="flex h-[calc(80vh-80px)] flex-col px-4">
          {/* Search Input */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search exercises..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Muscle Group Filter */}
          <div className="mb-2 flex flex-wrap gap-2">
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

          {/* Loading State */}
          {isLoadingExercises ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading exercises...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Result count */}
              <p className="mb-2 text-xs text-muted-foreground">
                {filteredExercises.length} exercise{filteredExercises.length !== 1 ? "s" : ""}
                {searchQuery && ` matching "${searchQuery}"`}
              </p>

              {/* Exercise List */}
              <ScrollArea className="flex-1 overflow-hidden">
                <div className="space-y-6 pr-4">
                  {filteredExercises.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <p>No exercises found</p>
                      {searchQuery && (
                        <p className="mt-1 text-sm">
                          Try a different search term or filter
                        </p>
                      )}
                    </div>
                  ) : (
                    (Object.keys(exercisesByGroup) as MuscleGroup[]).map((group) => (
                    <div key={group}>
                      <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                        {muscleGroupLabels[group]}
                      </h3>
                      <div className="space-y-1">
                        {exercisesByGroup[group].map((exercise) => {
                          const isAdded = addedExerciseIds.includes(exercise.id)
                          return (
                            <div
                              key={exercise.id}
                              className={`flex w-full items-center justify-between rounded-lg p-3 transition-colors ${
                                isAdded
                                  ? "bg-primary/10"
                                  : "hover:bg-muted"
                              }`}
                            >
                              <button
                                className={`flex-1 text-left font-medium ${isAdded ? "text-primary" : ""}`}
                                onClick={() => !isAdded && handleSelect(exercise.id)}
                                disabled={isAdded}
                              >
                                {exercise.name}
                              </button>
                              <div className="flex items-center gap-1">
                                <ExerciseInfoButton exercise={exercise} />
                                {isAdded && (
                                  <span className="text-xs text-primary">Added</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
