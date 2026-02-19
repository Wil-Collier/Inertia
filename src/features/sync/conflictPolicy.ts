import type { PushConflict } from "@/features/sync/schemas"
import type { InitialSyncStrategy } from "@/features/sync/types"

export function shouldAcknowledgePushConflict(conflict: PushConflict): boolean {
  return (
    conflict.reason === "VERSION_MISMATCH" ||
    conflict.reason === "RECORD_TOO_LARGE" ||
    conflict.reason === "MUTATION_ID_REUSE"
  )
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
