-- Big-bang cutover: reset old sync schema
DROP TABLE IF EXISTS sync_store;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS sync_events;
DROP TABLE IF EXISTS refresh_sessions;

-- Snapshot table for current server state per record
CREATE TABLE IF NOT EXISTS sync_store (
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  record_version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  mutation_id TEXT NOT NULL,
  device_id TEXT,
  PRIMARY KEY (user_id, collection, id)
);

CREATE INDEX IF NOT EXISTS idx_sync_store_user_collection
  ON sync_store (user_id, collection, id);

CREATE INDEX IF NOT EXISTS idx_sync_store_user_version
  ON sync_store (user_id, record_version);

-- Append-only event log for pull pagination and idempotency
CREATE TABLE IF NOT EXISTS sync_events (
  version INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,
  base_version INTEGER NOT NULL,
  mutation_id TEXT NOT NULL,
  device_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_events_user_mutation
  ON sync_events (user_id, mutation_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_events_user_record_base_version
  ON sync_events (user_id, collection, id, base_version);

CREATE INDEX IF NOT EXISTS idx_sync_events_user_version
  ON sync_events (user_id, version);

CREATE INDEX IF NOT EXISTS idx_sync_events_user_collection_id
  ON sync_events (user_id, collection, id);

-- Refresh session store for rotating refresh tokens
CREATE TABLE IF NOT EXISTS refresh_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  token_hash_current TEXT NOT NULL,
  token_hash_previous TEXT,
  previous_valid_until INTEGER,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user
  ON refresh_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_sessions_expiry
  ON refresh_sessions (expires_at);

-- Audit log (recreated after reset)
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
