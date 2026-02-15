import { describe, expect, it } from "vitest"
import { db } from "@/services/db"
import {
  ACTIVE_SESSION_SYNC_WRITE_TABLES,
  EXERCISE_DELETE_SYNC_WRITE_TABLES,
  SYNC_TRACKING_TABLES,
  WORKOUT_COMPLETION_SYNC_WRITE_TABLES,
  WORKOUT_HISTORY_DERIVED_DATA_TABLES,
  WORKOUT_HISTORY_SYNC_WRITE_TABLES,
  WORKOUT_SESSION_SYNC_WRITE_TABLES,
  WORKOUT_TEMPLATE_SYNC_WRITE_TABLES,
} from "@/services/dbTransactionTables"

describe("dbTransactionTables", () => {
  it("defines sync tracking tables shared by write transactions", () => {
    expect(SYNC_TRACKING_TABLES).toEqual([db.syncPendingChanges, db.syncRecordVersions])
  })

  it("composes session and template sync write tables from base + sync tables", () => {
    expect(WORKOUT_SESSION_SYNC_WRITE_TABLES).toEqual([db.workoutSessions, ...SYNC_TRACKING_TABLES])
    expect(WORKOUT_TEMPLATE_SYNC_WRITE_TABLES).toEqual([db.workoutTemplates, ...SYNC_TRACKING_TABLES])
  })

  it("includes active session + sync tracking for active workout writes", () => {
    expect(ACTIVE_SESSION_SYNC_WRITE_TABLES).toEqual([db.activeSession, ...SYNC_TRACKING_TABLES])
  })

  it("defines workout history derived-data tables without unrelated settings", () => {
    expect(WORKOUT_HISTORY_DERIVED_DATA_TABLES).toContain(db.workoutSessions)
    expect(WORKOUT_HISTORY_DERIVED_DATA_TABLES).toContain(db.userStats)
    expect(WORKOUT_HISTORY_DERIVED_DATA_TABLES).toContain(db.achievements)
    expect(WORKOUT_HISTORY_DERIVED_DATA_TABLES).toContain(db.workoutTemplates)
    expect(WORKOUT_HISTORY_DERIVED_DATA_TABLES).toContain(db.personalRecords)
    expect(WORKOUT_HISTORY_DERIVED_DATA_TABLES).toContain(db.customExercises)
    expect(WORKOUT_HISTORY_DERIVED_DATA_TABLES).toContain(db.nutritionLogs)
    expect(WORKOUT_HISTORY_DERIVED_DATA_TABLES).not.toContain(db.settings)
  })

  it("includes required workout history stores and excludes unused settings store", () => {
    expect(WORKOUT_HISTORY_SYNC_WRITE_TABLES).toContain(db.workoutSessions)
    expect(WORKOUT_HISTORY_SYNC_WRITE_TABLES).toContain(db.userStats)
    expect(WORKOUT_HISTORY_SYNC_WRITE_TABLES).toContain(db.workoutTemplates)
    expect(WORKOUT_HISTORY_SYNC_WRITE_TABLES).toContain(db.personalRecords)
    expect(WORKOUT_HISTORY_SYNC_WRITE_TABLES).toContain(db.customExercises)
    expect(WORKOUT_HISTORY_SYNC_WRITE_TABLES).toContain(db.nutritionLogs)
    expect(WORKOUT_HISTORY_SYNC_WRITE_TABLES).toContain(db.syncPendingChanges)
    expect(WORKOUT_HISTORY_SYNC_WRITE_TABLES).toContain(db.syncRecordVersions)
    expect(WORKOUT_HISTORY_SYNC_WRITE_TABLES).not.toContain(db.achievements)
    expect(WORKOUT_HISTORY_SYNC_WRITE_TABLES).not.toContain(db.settings)
  })

  it("defines dedicated sync tables for workout completion and exercise deletion flows", () => {
    expect(WORKOUT_COMPLETION_SYNC_WRITE_TABLES).toEqual([
      db.workoutSessions,
      db.activeSession,
      db.personalRecords,
      db.userStats,
      ...SYNC_TRACKING_TABLES,
    ])

    expect(EXERCISE_DELETE_SYNC_WRITE_TABLES).toEqual([
      db.workoutTemplates,
      db.workoutSessions,
      db.activeSession,
      db.customExercises,
      db.personalRecords,
      ...SYNC_TRACKING_TABLES,
    ])
  })
})
