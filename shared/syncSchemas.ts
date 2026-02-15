import { z } from "zod"

export const SYNC_COLLECTIONS = [
  "workouts",
  "activeSession",
  "templates",
  "foods",
  "nutrition",
  "mealTemplates",
  "weight",
  "settings",
  "exercises",
] as const

export const SyncCollectionSchema = z.enum(SYNC_COLLECTIONS)
export type SyncCollection = z.infer<typeof SyncCollectionSchema>

export const SyncCursorSchema = z.object({
  version: z.number().int().nonnegative(),
})
export type SyncCursor = z.infer<typeof SyncCursorSchema>

export const PushChangeSchema = z.object({
  collection: SyncCollectionSchema,
  id: z.string(),
  data: z.record(z.string(), z.unknown()).nullable(),
  baseVersion: z.number().int().nonnegative(),
  mutationId: z.string().min(1),
  deviceId: z.string().optional(),
})
export type PushChange = z.infer<typeof PushChangeSchema>

export const MAX_PUSH_BATCH = 200

export const PushRequestSchema = z.object({
  changes: z.array(PushChangeSchema).max(MAX_PUSH_BATCH),
})
export type PushRequest = z.infer<typeof PushRequestSchema>

export const KNOWN_PUSH_CONFLICT_REASONS = [
  "VERSION_MISMATCH",
  "RECORD_TOO_LARGE",
  "MUTATION_ID_REUSE",
] as const

export const PushConflictReasonSchema = z.enum(KNOWN_PUSH_CONFLICT_REASONS)
export type PushConflictReason = z.infer<typeof PushConflictReasonSchema>

export const PushConflictSchema = z.object({
  collection: SyncCollectionSchema,
  id: z.string(),
  serverVersion: z.number().int().nonnegative(),
  clientBaseVersion: z.number().int().nonnegative(),
  reason: z.union([PushConflictReasonSchema, z.string()]),
})
export type PushConflict = z.infer<typeof PushConflictSchema>

export const PushAcceptedChangeSchema = z.object({
  collection: SyncCollectionSchema,
  id: z.string(),
  version: z.number().int().positive(),
  mutationId: z.string().min(1),
})
export type PushAcceptedChange = z.infer<typeof PushAcceptedChangeSchema>

export const PushResponseSchema = z.object({
  accepted: z.number().int().nonnegative(),
  acceptedChanges: z.array(PushAcceptedChangeSchema),
  conflicts: z.array(PushConflictSchema),
})
export type PushResponse = z.infer<typeof PushResponseSchema>

export const MAX_PULL_LIMIT = 500

export const PullRequestSchema = z.object({
  cursor: SyncCursorSchema.optional(),
  collections: z.array(SyncCollectionSchema).optional(),
  limit: z.number().int().min(1).max(MAX_PULL_LIMIT).optional(),
})
export type PullRequest = z.infer<typeof PullRequestSchema>

export const PullChangeSchema = z.object({
  collection: SyncCollectionSchema,
  id: z.string(),
  data: z.record(z.string(), z.unknown()).nullable(),
  version: z.number().int().positive(),
  deleted: z.boolean(),
})
export type PullChange = z.infer<typeof PullChangeSchema>

export const PullResponseSchema = z.object({
  changes: z.array(PullChangeSchema),
  nextCursor: SyncCursorSchema.nullable(),
  serverTimestampMs: z.number(),
  hasMore: z.boolean(),
})
export type PullResponse = z.infer<typeof PullResponseSchema>

const WeightUnitSchema = z.enum(["kg", "lbs"])

export const WorkoutSetRecordSchema = z.object({
  id: z.string(),
  reps: z.number(),
  weight: z.number(),
  isCompleted: z.boolean(),
})

export const WorkoutExerciseRecordSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  sets: z.array(WorkoutSetRecordSchema),
  notes: z.string().optional(),
  lastPerformanceDate: z.string().optional(),
})

export const WorkoutRecordSchema = z.object({
  id: z.string(),
  date: z.string(),
  name: z.string(),
  exercises: z.array(WorkoutExerciseRecordSchema),
  exerciseIds: z.array(z.string()).optional(),
  duration: z.number().optional(),
  completedAt: z.string().optional(),
  weightUnit: WeightUnitSchema,
  updatedAt: z.number().optional(),
})
export type WorkoutRecord = z.infer<typeof WorkoutRecordSchema>

export const ActiveWorkoutSessionRecordSchema = z.object({
  workout: WorkoutRecordSchema,
  startedAt: z.string(),
  templateId: z.string().optional(),
  updatedAt: z.number().optional(),
})
export type ActiveWorkoutSessionRecord = z.infer<typeof ActiveWorkoutSessionRecordSchema>

export const WorkoutTemplateRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  exercises: z.array(
    z.object({
      exerciseId: z.string(),
      targetSets: z.number(),
      targetReps: z.number().optional(),
      targetWeight: z.number().optional(),
    })
  ),
  updatedAt: z.number().optional(),
})
export type WorkoutTemplateRecord = z.infer<typeof WorkoutTemplateRecordSchema>

export const FoodItemRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string().optional(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fiber: z.number(),
  sugar: z.number(),
  servingSize: z.string(),
  servingGrams: z.number().optional(),
  barcode: z.string().optional(),
  isCustom: z.boolean(),
  isFavorite: z.boolean().optional(),
  usageCount: z.number().optional(),
  updatedAt: z.number().optional(),
})
export type FoodItemRecord = z.infer<typeof FoodItemRecordSchema>

export const MealEntryRecordSchema = z.object({
  id: z.string(),
  foodId: z.string(),
  quantity: z.number(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  updatedAt: z.number(),
  deletedAt: z.number().optional(),
  templateId: z.string().optional(),
  templateInstanceId: z.string().optional(),
  templateName: z.string().optional(),
})

export const DailyNutritionRecordSchema = z.object({
  date: z.string(),
  entries: z.array(MealEntryRecordSchema),
  updatedAt: z.number().optional(),
})
export type DailyNutritionRecord = z.infer<typeof DailyNutritionRecordSchema>

export const MealTemplateEntryRecordSchema = z.object({
  foodId: z.string(),
  quantity: z.number(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  templateId: z.string().optional(),
})

export const MealTemplateRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  entries: z.array(MealTemplateEntryRecordSchema),
  updatedAt: z.number().optional(),
})
export type MealTemplateRecord = z.infer<typeof MealTemplateRecordSchema>

export const WeightEntryRecordSchema = z.object({
  id: z.string(),
  date: z.string(),
  weight: z.number(),
  note: z.string().optional(),
  updatedAt: z.number().optional(),
})
export type WeightEntryRecord = z.infer<typeof WeightEntryRecordSchema>

export const UserSettingsRecordSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  nutritionGoals: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    fiber: z.number(),
    sugar: z.number(),
  }),
  restTimerDuration: z.number(),
  unitPreferences: z.object({
    weight: WeightUnitSchema,
    distance: z.enum(["mi", "km"]),
  }),
  areNotificationsEnabled: z.boolean(),
  updatedAt: z.number().optional(),
})
export type UserSettingsRecord = z.infer<typeof UserSettingsRecordSchema>

export const ExerciseRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  muscleGroup: z.enum(["chest", "back", "shoulders", "arms", "legs", "core", "cardio"]),
  isCustom: z.boolean(),
  isWeighted: z.boolean(),
  isTimeBased: z.boolean(),
  description: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.number().optional(),
})
export type ExerciseRecord = z.infer<typeof ExerciseRecordSchema>

export const LoginRequestSchema = z.object({
  idToken: z.string(),
})
export type LoginRequest = z.infer<typeof LoginRequestSchema>

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  userId: z.string(),
  email: z.string(),
  expiresAtMs: z.number(),
})
export type LoginResponse = z.infer<typeof LoginResponseSchema>

export const RefreshResponseSchema = z.object({
  accessToken: z.string(),
  userId: z.string(),
  email: z.string(),
  expiresAtMs: z.number(),
})
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>

export const LogoutResponseSchema = z.object({
  success: z.literal(true),
})
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
})
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
