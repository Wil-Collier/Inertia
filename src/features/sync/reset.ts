import { clearSyncAndAuthState } from "@/features/sync/authState"

export async function resetSyncState(): Promise<void> {
  await clearSyncAndAuthState({
    clearDevice: true,
    clearConflicts: true,
    clearSyncMetadata: true,
  })
}
