import { clearSyncAndAuthState } from "@/features/sync/client/authState"

export async function resetSyncState(): Promise<void> {
  await clearSyncAndAuthState({
    clearDevice: true,
    clearConflicts: true,
    clearSyncMetadata: true,
  })
}
