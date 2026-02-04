import { AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { InitialSyncStrategy } from "@/features/sync/types"

interface SyncConflictDialogProps {
  open: boolean
  onResolve: (strategy: InitialSyncStrategy) => void
  onOpenChange?: (open: boolean) => void
}

export function SyncConflictDialog({ open, onResolve, onOpenChange }: SyncConflictDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 uppercase tracking-tight">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Initial Sync Decision
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            This device already has local data, and the cloud has existing data.
            Choose how to resolve the initial sync.
          </p>
          <div className="space-y-2">
            <Button className="w-full" onClick={() => onResolve("merge")}>
              Merge Cloud + Local
            </Button>
            <Button variant="outline" className="w-full" onClick={() => onResolve("use-cloud")}>
              Use Cloud (Replace Local)
            </Button>
            <Button variant="destructive" className="w-full" onClick={() => onResolve("use-local")}>
              Use Local (Overwrite Cloud)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Merge keeps entries from both sides. Use Cloud or Use Local will replace the other side.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
