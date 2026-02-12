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
  data: z.record(z.string(), z.any()).nullable(),
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
  data: z.record(z.string(), z.any()).nullable(),
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
