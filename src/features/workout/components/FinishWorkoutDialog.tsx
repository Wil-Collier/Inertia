import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface FinishWorkoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  completedSets: number
  totalSets: number
  exerciseCount: number
  canSaveAsTemplate?: boolean
  saveAsTemplate: boolean
  onSaveAsTemplateChange: (checked: boolean) => void
  templateName: string
  onTemplateNameChange: (name: string) => void
  isFinishing: boolean
  onFinish: () => void
}

export function FinishWorkoutDialog({
  open,
  onOpenChange,
  completedSets,
  totalSets,
  exerciseCount,
  canSaveAsTemplate = true,
  saveAsTemplate,
  onSaveAsTemplateChange,
  templateName,
  onTemplateNameChange,
  isFinishing,
  onFinish,
}: FinishWorkoutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finish Workout?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            You completed {completedSets} of {totalSets} sets across{" "}
            {exerciseCount} exercises.
          </p>

          {canSaveAsTemplate && (
            <div className="space-y-2">
              <Label className="flex items-center gap-3 py-2 cursor-pointer">
                <Checkbox
                  checked={saveAsTemplate}
                  onCheckedChange={(checked) => onSaveAsTemplateChange(!!checked)}
                />
                <span className="text-sm">Save as template</span>
              </Label>

              {saveAsTemplate && (
                <Input
                  placeholder="Template name"
                  value={templateName}
                  onChange={(e) => onTemplateNameChange(e.target.value)}
                />
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isFinishing}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={onFinish} disabled={isFinishing}>
              {isFinishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isFinishing ? "Saving..." : "Finish"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
