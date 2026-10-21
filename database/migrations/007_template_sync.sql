-- Allow custom templates to remain in the durable local sync outbox.

PRAGMA foreign_keys = ON;

CREATE TABLE sync_outbox_v7 (
  entity_type      TEXT NOT NULL CHECK (entity_type IN ('profile', 'body_weight', 'workout', 'template')),
  entity_id        TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  attempts         INTEGER NOT NULL DEFAULT 0,
  last_attempt_at  TEXT,
  last_error       TEXT,
  PRIMARY KEY (entity_type, entity_id)
);

INSERT INTO sync_outbox_v7
  (entity_type, entity_id, created_at, attempts, last_attempt_at, last_error)
SELECT entity_type, entity_id, created_at, attempts, last_attempt_at, last_error
FROM sync_outbox;

DROP TABLE sync_outbox;
ALTER TABLE sync_outbox_v7 RENAME TO sync_outbox;

PRAGMA user_version = 7;
