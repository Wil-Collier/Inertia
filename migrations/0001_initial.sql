-- Main sync store
CREATE TABLE IF NOT EXISTS sync_store (
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  device_id TEXT,
  PRIMARY KEY (user_id, collection, id)
);

-- Index for efficient pull queries
CREATE INDEX IF NOT EXISTS idx_sync_pull
  ON sync_store (user_id, updated_at, collection, id);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
