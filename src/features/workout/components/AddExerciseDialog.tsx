import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAddExercise, useUpdateExercise } from "@/features/exercises/mutations"
import { muscleGroups, muscleGroupLabels } from "@/lib/muscleGroups"
import type { MuscleGroup, Exercise } from "@/lib/types"

interface AddExerciseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (exerciseId: string) => void
  exerciseToEdit?: Exercise | null
}

export function AddExerciseDialog({
  open,
  onOpenChange,
  onSuccess,
  exerciseToEdit,
}: AddExerciseDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>("chest")
  const [isWeighted, setIsWeighted] = useState(true)
  const [isTimeBased, setIsTimeBased] = useState(false)

  const { mutate: addExercise, isPending: isAdding } = useAddExercise()
  const { mutate: updateExercise, isPending: isUpdating } = useUpdateExercise()

  const isPending = isAdding || isUpdating
  const isEditing = !!exerciseToEdit

  useEffect(() => {
    if (exerciseToEdit) {
      setName(exerciseToEdit.name)
      setDescription(exerciseToEdit.description || "")
      setMuscleGroup(exerciseToEdit.muscleGroup)
      setIsWeighted(exerciseToEdit.isWeighted)
      setIsTimeBased(exerciseToEdit.isTimeBased)
    } else {
      reset()
    }
  }, [exerciseToEdit, open])

  const handleSave = () => {
    if (!name.trim()) return

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      muscleGroup,
      isWeighted,
      isTimeBased,
    }

    if (isEditing && exerciseToEdit) {
      updateExercise(
        { id: exerciseToEdit.id, updates: payload },
        {
          onSuccess: () => {
            onOpenChange(false)
            onSuccess?.(exerciseToEdit.id)
          },
        }
      )
    } else {
      addExercise(
        payload,
        {
          onSuccess: (newExercise) => {
            onOpenChange(false)
            reset()
            onSuccess?.(newExercise.id)
          },
        }
      )
    }
  }

  const reset = () => {
    setName("")
    setDescription("")
    setMuscleGroup("chest")
    setIsWeighted(true)
    setIsTimeBased(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-tight">
            {isEditing ? "Edit Exercise" : "Create Custom Exercise"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g. Bench Press"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="e.g. Focus on full range of motion..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={muscleGroup}
              onValueChange={(value) => {
                const group = muscleGroups.find((g) => g === value)
                if (group) setMuscleGroup(group)
              }}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {muscleGroups.map((group) => (
                  <SelectItem key={group} value={group}>
                    {muscleGroupLabels[group]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="weighted">Weighted</Label>
              <p className="text-[0.8rem] text-muted-foreground">
                Exercise involves lifting weight
              </p>
            </div>
            <Switch
              id="weighted"
              checked={isWeighted}
              onCheckedChange={setIsWeighted}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="timed">Timed</Label>
              <p className="text-[0.8rem] text-muted-foreground">
                Exercise involves tracking time
              </p>
            </div>
            <Switch
              id="timed"
              checked={isTimeBased}
              onCheckedChange={setIsTimeBased}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="submit"
            onClick={handleSave}
            disabled={!name.trim() || isPending}
            className="w-full"
          >
            {isPending ? "Saving..." : isEditing ? "Update Exercise" : "Create Exercise"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
