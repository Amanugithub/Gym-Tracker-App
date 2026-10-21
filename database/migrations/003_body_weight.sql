-- Add optional height and historical bodyweight measurements.

PRAGMA foreign_keys = ON;

ALTER TABLE profile ADD COLUMN height_cm REAL
  CHECK (height_cm IS NULL OR height_cm > 0);

CREATE TABLE IF NOT EXISTS body_weight_entries (
  id           TEXT PRIMARY KEY,
  weight_kg    REAL NOT NULL CHECK (weight_kg > 0),
  measured_at  TEXT NOT NULL,
  timezone_id  TEXT NOT NULL,
  local_date   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_body_weight_measured_at
  ON body_weight_entries (measured_at, id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_body_weight_updated_at
  ON body_weight_entries (updated_at);

PRAGMA user_version = 3;
