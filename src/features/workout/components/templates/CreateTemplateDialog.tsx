import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CreateTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateName: string
  onTemplateNameChange: (name: string) => void
  onCreate: () => void
  isCreating: boolean
}

export function CreateTemplateDialog({
  open,
  onOpenChange,
  templateName,
  onTemplateNameChange,
  onCreate,
  isCreating,
}: CreateTemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Template Name</Label>
            <Input
              placeholder="e.g., Push Day, Upper Body"
              value={templateName}
              onChange={(e) => onTemplateNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreate()
              }}
            />
          </div>
          <Button onClick={onCreate} className="w-full" disabled={isCreating}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isCreating ? "Creating..." : "Create Template"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
