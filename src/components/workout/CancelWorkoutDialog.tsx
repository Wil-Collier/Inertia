import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface CancelWorkoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmCancel: () => void
}

export function CancelWorkoutDialog({
  open,
  onOpenChange,
  onConfirmCancel,
}: CancelWorkoutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Workout?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            This will discard all your progress. Are you sure?
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Keep Working
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={onConfirmCancel}
            >
              Discard
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
