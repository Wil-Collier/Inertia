import type { QueryClient } from "@tanstack/react-query"
import { useAuthStore, useSyncStore } from "@/features/sync/runtime/store"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { resetWorkoutFactory } from "@/test/factories/workoutFactory"
import { resetNutritionFactory } from "@/test/factories/nutritionFactory"
import { resetSessionFactory } from "@/test/factories/sessionFactory"

const DEFAULT_AUTH_STATE = {
  accessToken: null,
  userId: null,
  email: null,
  expiresAtMs: null,
  isAuthenticated: false,
}

const DEFAULT_SYNC_STATE = {
  status: "idle" as const,
  lastSyncedAtMs: null,
  lastError: null,
  pendingCount: 0,
  conflicts: [],
  initialSyncState: null,
  lastAutoMergeSummary: null,
}

export function resetEphemeralTestRuntime(queryClient?: QueryClient): void {
  sessionStorage.clear()
  localStorage.clear()

  resetWorkoutFactory()
  resetNutritionFactory()
  resetSessionFactory()

  useAuthStore.setState(DEFAULT_AUTH_STATE)
  useSyncStore.setState(DEFAULT_SYNC_STATE)

  queryClient?.clear()
}

export async function resetTestRuntime(queryClient?: QueryClient): Promise<void> {
  await clearDatabase()
  resetEphemeralTestRuntime(queryClient)
}
