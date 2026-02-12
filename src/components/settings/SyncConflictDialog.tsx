import { AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { InitialSyncState, InitialSyncStrategy } from "@/features/sync/types"
import { INITIAL_SYNC_POLICY } from "@/features/sync/conflictPolicy"

interface SyncConflictDialogProps {
  open: boolean
  state: InitialSyncState | null
  onResolve: (strategy: InitialSyncStrategy) => void
  onOpenChange?: (open: boolean) => void
}

export function SyncConflictDialog({ open, state, onResolve, onOpenChange }: SyncConflictDialogProps) {
  const description = state?.localHasData && state?.cloudHasData
    ? "This device already has local data, and the cloud has existing data. Choose how to resolve the initial sync."
    : "This device has local data that does not match the signed-in cloud account. Choose how to resolve the initial sync."

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
          <p>{description}</p>
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
            Policy: Merge keeps both sides ({INITIAL_SYNC_POLICY.merge.localBehavior}/{INITIAL_SYNC_POLICY.merge.cloudBehavior});
            Use Cloud replaces local data; Use Local replaces cloud data.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
