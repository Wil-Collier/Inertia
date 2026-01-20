import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { WorkoutTemplate } from "@/lib/types"

interface DeleteTemplateDialogProps {
  template: WorkoutTemplate | null
  onOpenChange: (open: boolean) => void
  onDelete: () => void
  isDeleting: boolean
}

export function DeleteTemplateDialog({
  template,
  onOpenChange,
  onDelete,
  isDeleting,
}: DeleteTemplateDialogProps) {
  return (
    <Dialog
      open={template !== null}
      onOpenChange={(open) => !open && onOpenChange(false)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Template</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{template?.name}"? This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDelete} disabled={isDeleting}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
