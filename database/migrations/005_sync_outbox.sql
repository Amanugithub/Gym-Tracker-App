-- Keep local changes pending until a sync attempt succeeds.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sync_outbox (
  entity_type      TEXT NOT NULL CHECK (entity_type IN ('profile', 'body_weight', 'workout')),
  entity_id        TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  attempts         INTEGER NOT NULL DEFAULT 0,
  last_attempt_at  TEXT,
  last_error       TEXT,
  PRIMARY KEY (entity_type, entity_id)
);

PRAGMA user_version = 5;
