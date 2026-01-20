import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface SaveTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateName: string
  onTemplateNameChange: (name: string) => void
  isSaving: boolean
  onSave: () => void
}

export function SaveTemplateDialog({
  open,
  onOpenChange,
  templateName,
  onTemplateNameChange,
  isSaving,
  onSave,
}: SaveTemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Template Name</label>
            <Input
              value={templateName}
              onChange={(e) => onTemplateNameChange(e.target.value)}
              placeholder="Enter template name..."
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!templateName.trim() || isSaving}
              onClick={onSave}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
