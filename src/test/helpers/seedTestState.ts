import { ACTIVE_SESSION_ID } from "@/lib/constants"
import type {
  ActiveWorkoutSession,
  DailyNutrition,
  FoodItem,
  MealTemplate,
  StreakData,
  UnlockedAchievement,
  UserSettings,
  Workout,
  WorkoutTemplate,
} from "@/lib/types"
import type { WeightEntry } from "@/lib/types/bodyweight"
import { useAuthStore, useSyncStore } from "@/features/sync/store"
import { db } from "@/services/db"

interface SeedAchievements {
  unlockedAchievements: UnlockedAchievement[]
  streaks: StreakData
}

interface SeedAuthState {
  accessToken: string | null
  userId: string | null
  email: string | null
  expiresAtMs: number | null
  isAuthenticated: boolean
}

interface SeedSyncState {
  status: "idle" | "syncing" | "success" | "error" | "offline"
  lastSyncedAtMs: number | null
  lastError: string | null
  pendingCount: number
}

export interface TestStateSeed {
  settings?: UserSettings
  activeSession?: ActiveWorkoutSession | null
  workouts?: Workout[]
  templates?: WorkoutTemplate[]
  foods?: FoodItem[]
  nutritionLogs?: DailyNutrition[]
  mealTemplates?: MealTemplate[]
  achievements?: SeedAchievements
  bodyWeight?: WeightEntry[]
  authState?: Partial<SeedAuthState>
  syncState?: Partial<SeedSyncState>
}

export async function seedTestState(seed: TestStateSeed): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.settings,
      db.activeSession,
      db.workoutSessions,
      db.workoutTemplates,
      db.foods,
      db.nutritionLogs,
      db.mealTemplates,
      db.achievements,
      db.bodyWeight,
      db.syncPendingChanges,
      db.syncRecordVersions,
    ],
    async () => {
      if (seed.settings) {
        await db.settings.put({
          id: "settings",
          ...seed.settings,
        })
      }

      if (seed.activeSession === null) {
        await db.activeSession.delete(ACTIVE_SESSION_ID)
      } else if (seed.activeSession) {
        await db.activeSession.put({
          id: ACTIVE_SESSION_ID,
          ...seed.activeSession,
        })
      }

      if (seed.workouts && seed.workouts.length > 0) {
        await db.workoutSessions.bulkPut(seed.workouts)
      }

      if (seed.templates && seed.templates.length > 0) {
        await db.workoutTemplates.bulkPut(seed.templates)
      }

      if (seed.foods && seed.foods.length > 0) {
        await db.foods.bulkPut(seed.foods)
      }

      if (seed.nutritionLogs && seed.nutritionLogs.length > 0) {
        await db.nutritionLogs.bulkPut(seed.nutritionLogs)
      }

      if (seed.mealTemplates && seed.mealTemplates.length > 0) {
        await db.mealTemplates.bulkPut(seed.mealTemplates)
      }

      if (seed.achievements) {
        await db.achievements.put({
          id: "achievements",
          unlockedAchievements: seed.achievements.unlockedAchievements,
          streaks: seed.achievements.streaks,
        })
      }

      if (seed.bodyWeight && seed.bodyWeight.length > 0) {
        await db.bodyWeight.bulkPut(seed.bodyWeight)
      }
    }
  )

  if (seed.authState) {
    useAuthStore.setState(seed.authState)
  }

  if (seed.syncState) {
    useSyncStore.setState(seed.syncState)
  }
}
