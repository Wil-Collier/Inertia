import type { PushConflict } from "@/features/sync/schemas"
import type { InitialSyncStrategy } from "@/features/sync/types"

type PushConflictResolution =
  | "accept_remote_record"
  | "reject_local_change"

export const PUSH_CONFLICT_POLICY: Record<string, PushConflictResolution> = {
  VERSION_MISMATCH: "accept_remote_record",
  RECORD_TOO_LARGE: "reject_local_change",
}

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
