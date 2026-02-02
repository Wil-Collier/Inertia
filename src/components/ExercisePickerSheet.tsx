import { useState, useEffect, useMemo, memo, useCallback } from "react"
import { Search, X, Loader2, Plus, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
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
import { useExercises } from "@/features/exercises/queries"
import type { MuscleGroup, Exercise } from "@/lib/types"
import { muscleGroupLabels, muscleGroups } from "@/lib/muscleGroups"
import { AddExerciseDialog } from "@/components/AddExerciseDialog"

interface ExerciseListItemProps {
  exercise: Exercise
  isAdded: boolean
  onSelect: (exerciseId: string) => void
  onEdit?: (exercise: Exercise) => void
}

const ExerciseListItem = memo(({
  exercise,
  isAdded,
  onSelect,
  onEdit,
}: ExerciseListItemProps) => {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between rounded-lg p-3 transition-colors",
        isAdded ? "bg-primary/10" : "hover:bg-muted"
      )}
    >
      <div className="flex-1 flex flex-col items-start min-w-0 mr-2">
        <button
          className={cn(
            "w-full text-left font-medium truncate transition-colors",
            isAdded ? "text-primary" : "text-foreground"
          )}
          onClick={() => !isAdded && onSelect(exercise.id)}
          disabled={isAdded}
        >
          {exercise.name}
        </button>
        {exercise.description && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
            {exercise.description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isAdded && (
          <span className="text-xs text-primary font-medium mr-1">Added</span>
        )}
        {exercise.isCustom && onEdit && (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => onEdit(exercise)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        <ExerciseInfoButton exercise={exercise} />
      </div>
    </div>
  )
})

ExerciseListItem.displayName = "ExerciseListItem"

interface ExercisePickerSheetProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onSelect: (exerciseId: string) => void
  /** Array of exercise IDs that are already added (shown with "Added" indicator) */
  addedExerciseIds?: string[]
}

export function ExercisePickerSheet({
  isOpen,
  onOpenChange,
  onSelect,
  addedExerciseIds = [],
}: ExercisePickerSheetProps) {
  const { data: allExercises = [], isLoading } = useExercises()

  const [selectedMuscleGroup, setSelectedMuscleGroup] =
    useState<MuscleGroup | null>(null)
  const [showCustomOnly, setShowCustomOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [exerciseToEdit, setExerciseToEdit] = useState<Exercise | null>(null)

  const filteredExercises = useMemo(() => {
    return allExercises.filter(ex => {
      const matchesQuery = !debouncedQuery || ex.name.toLowerCase().includes(debouncedQuery.toLowerCase())
      const matchesMuscle = !selectedMuscleGroup || ex.muscleGroup === selectedMuscleGroup
      const matchesCustom = !showCustomOnly || ex.isCustom
      return matchesQuery && matchesMuscle && matchesCustom
    })
  }, [allExercises, debouncedQuery, selectedMuscleGroup, showCustomOnly])

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Group exercises by muscle group for display
  const exercisesByGroup = useMemo(() => {
    const grouped: Record<MuscleGroup, Exercise[]> = {
      chest: [],
      back: [],
      shoulders: [],
      arms: [],
      legs: [],
      core: [],
      cardio: [],
    }

    for (const ex of filteredExercises) {
      grouped[ex.muscleGroup].push(ex)
    }

    return grouped
  }, [filteredExercises])

  const handleSelect = useCallback((exerciseId: string) => {
    onSelect(exerciseId)
    onOpenChange(false)
  }, [onSelect, onOpenChange])

  const handleEdit = useCallback((exercise: Exercise) => {
    setExerciseToEdit(exercise)
    setIsAddDialogOpen(true)
  }, [])

  const handleCreateNew = useCallback(() => {
    setExerciseToEdit(null)
    setIsAddDialogOpen(true)
  }, [])

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => {
        if (!open) {
          setSearchQuery("")
          setSelectedMuscleGroup(null)
          setShowCustomOnly(false)
        }
        onOpenChange(open)
      }}>
        <SheetContent
          side="bottom"
          className={cn(
            "h-[80vh] transition-all duration-300",
            isAddDialogOpen && "blur-md brightness-50 pointer-events-none"
          )}
        >
          <SheetHeader>
            <SheetTitle className="uppercase tracking-tight">Add Exercise</SheetTitle>
          </SheetHeader>

          <div className="flex h-[calc(80vh-80px)] flex-col px-4">
            {/* Search Input and Add Custom Button */}
            <div className="mb-3 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search exercises..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                className="shrink-0 gap-1.5"
                onClick={handleCreateNew}
                title="Add Custom Exercise"
              >
                <Plus className="h-4 w-4" />
                New
              </Button>
            </div>

            {/* Filters */}
            <div className="mb-2 flex flex-wrap gap-2">
              <Button
                variant={!selectedMuscleGroup && !showCustomOnly ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedMuscleGroup(null)
                  setShowCustomOnly(false)
                }}
              >
                All
              </Button>
              <Button
                variant={showCustomOnly ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setShowCustomOnly(!showCustomOnly)
                  setSelectedMuscleGroup(null)
                }}
              >
                Custom
              </Button>
              <div className="h-8 w-px bg-border mx-1 self-center" />
              {muscleGroups.map((mg) => (
                <Button
                  key={mg}
                  variant={selectedMuscleGroup === mg ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedMuscleGroup(mg)
                    setShowCustomOnly(false)
                  }}
                >
                  {muscleGroupLabels[mg]}
                </Button>
              ))}
            </div>

            {/* Loading State */}
            {isLoading ? (
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
                <ScrollArea className="flex-1 overflow-hidden min-h-full">
                  <div className="space-y-6 pr-4 pb-[env(safe-area-inset-bottom,1rem)]">
                    {filteredExercises.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        <p>No exercises found</p>
                        {(searchQuery || selectedMuscleGroup || showCustomOnly) && (
                          <p className="mt-1 text-sm">
                            Try a different search term or filter
                          </p>
                        )}
                      </div>
                    ) : (
                      muscleGroups
                        .filter((group) => exercisesByGroup[group].length > 0)
                        .map((group) => (
                          <div key={group}>
                            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                              {muscleGroupLabels[group]}
                            </h3>
                            <div className="space-y-1">
                              {exercisesByGroup[group].map((exercise) => (
                                <ExerciseListItem
                                  key={exercise.id}
                                  exercise={exercise}
                                  isAdded={addedExerciseIds.includes(exercise.id)}
                                  onSelect={handleSelect}
                                  onEdit={handleEdit}
                                />
                              ))}
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

      <AddExerciseDialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open)
          if (!open) setExerciseToEdit(null)
        }}
        exerciseToEdit={exerciseToEdit}
        onSuccess={(exerciseId) => {
          if (!exerciseToEdit) {
            onSelect(exerciseId)
            onOpenChange(false)
          }
          setExerciseToEdit(null)
        }}
      />
    </>
  )
}
