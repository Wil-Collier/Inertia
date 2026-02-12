import type { PushConflict } from "@/features/sync/schemas"
import type { InitialSyncStrategy } from "@/features/sync/types"

type PushConflictResolution =
  | "accept_remote_record"
  | "reject_local_change"

export const PUSH_CONFLICT_POLICY: Record<string, PushConflictResolution> = {
  VERSION_MISMATCH: "accept_remote_record",
  RECORD_TOO_LARGE: "reject_local_change",
}

export function shouldAcknowledgePushConflict(conflict: PushConflict): boolean {
  return conflict.reason in PUSH_CONFLICT_POLICY
}

export const INITIAL_SYNC_POLICY: Record<
  InitialSyncStrategy,
  {
    localBehavior: "keep" | "replace"
    cloudBehavior: "keep" | "replace"
  }
> = {
  merge: {
    localBehavior: "keep",
    cloudBehavior: "keep",
  },
  "use-cloud": {
    localBehavior: "replace",
    cloudBehavior: "keep",
  },
  "use-local": {
    localBehavior: "keep",
    cloudBehavior: "replace",
  },
}

