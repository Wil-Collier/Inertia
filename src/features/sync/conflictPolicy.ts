import type { PushConflict } from "@/features/sync/schemas"
import type { InitialSyncStrategy } from "@/features/sync/types"

export function shouldAcknowledgePushConflict(_conflict: PushConflict): boolean {
  // Always acknowledge conflicts so pending changes don't get stuck.
  // The conflict policy determines the *resolution strategy*, not whether to clear the pending change.
  return true
}

export const INITIAL_SYNC_POLICY: Record<
  InitialSyncStrategy,
  {
    localBehavior: "keep" | "replace"
    cloudBehavior: "keep" | "replace"
    conflictBehavior: "manual-resolution" | "overwrite-cloud" | "overwrite-local"
  }
> = {
  merge: {
    localBehavior: "keep",
    cloudBehavior: "keep",
    conflictBehavior: "manual-resolution",
  },
  "use-cloud": {
    localBehavior: "replace",
    cloudBehavior: "keep",
    conflictBehavior: "overwrite-local",
  },
  "use-local": {
    localBehavior: "keep",
    cloudBehavior: "replace",
    conflictBehavior: "overwrite-cloud",
  },
}
