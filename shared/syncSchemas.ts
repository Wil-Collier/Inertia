import { z } from "zod"

export const SYNC_COLLECTIONS = [
  "workouts",
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
  updatedAt: z.number(),
  collection: SyncCollectionSchema,
  id: z.string(),
})
export type SyncCursor = z.infer<typeof SyncCursorSchema>

export const PushChangeSchema = z.object({
  collection: SyncCollectionSchema,
  id: z.string(),
  data: z.record(z.string(), z.any()).nullable(),
  updatedAt: z.number(),
  deviceId: z.string().optional(),
})
export type PushChange = z.infer<typeof PushChangeSchema>

export const PushRequestSchema = z.object({
  changes: z.array(PushChangeSchema),
})
export type PushRequest = z.infer<typeof PushRequestSchema>

export const PushConflictSchema = z.object({
  collection: SyncCollectionSchema,
  id: z.string(),
  serverUpdatedAt: z.number(),
  reason: z.string(),
})
export type PushConflict = z.infer<typeof PushConflictSchema>

export const PushResponseSchema = z.object({
  accepted: z.number().int().nonnegative(),
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
  data: z.record(z.string(), z.any()).nullable(),
  updatedAt: z.number(),
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

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
})
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
