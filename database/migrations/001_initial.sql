-- Gym Tracker v0: local-only SQLite schema
-- All timestamps are UTC ISO 8601 strings.
-- local_date is fixed at logging time and is never recomputed.

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS exercises (
  id         TEXT PRIMARY KEY,
  equipment  TEXT NOT NULL CHECK (equipment IN (
    'barbell', 'dumbbell', 'machine', 'cable',
    'kettlebell', 'bodyweight', 'other'
  )),
  kind       TEXT NOT NULL CHECK (kind IN ('weighted', 'bodyweight')),
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exercise_names (
  exercise_id TEXT NOT NULL
    REFERENCES exercises(id) ON DELETE CASCADE,
  locale      TEXT NOT NULL CHECK (locale IN ('en', 'am')),
  name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
  PRIMARY KEY (exercise_id, locale)
);

CREATE TABLE IF NOT EXISTS profile (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  display_name  TEXT,
  timezone_id   TEXT NOT NULL DEFAULT 'Africa/Addis_Ababa',
  unit          TEXT NOT NULL DEFAULT 'kg'
    CHECK (unit IN ('kg', 'lb')),
  language      TEXT NOT NULL DEFAULT 'en'
    CHECK (language IN ('en', 'am')),
  weekly_target INTEGER NOT NULL DEFAULT 4
    CHECK (weekly_target BETWEEN 1 AND 7),
  bodyweight_kg REAL
    CHECK (bodyweight_kg IS NULL OR bodyweight_kg > 0),
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workouts (
  id            TEXT PRIMARY KEY,
  status        TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'abandoned')),
  started_at    TEXT NOT NULL,
  ended_at      TEXT,
  timezone_id   TEXT NOT NULL,
  bodyweight_kg REAL
    CHECK (bodyweight_kg IS NULL OR bodyweight_kg > 0),
  local_date    TEXT NOT NULL,
  note          TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  CHECK (
    (status = 'active' AND ended_at IS NULL)
    OR
    (status IN ('completed', 'abandoned') AND ended_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS sets (
  id           TEXT PRIMARY KEY,
  workout_id   TEXT NOT NULL REFERENCES workouts(id),
  exercise_id  TEXT NOT NULL REFERENCES exercises(id),
  set_type     TEXT NOT NULL CHECK (set_type IN ('warmup', 'working')),
  weight_kg    REAL NOT NULL CHECK (weight_kg >= 0),
  reps         INTEGER NOT NULL CHECK (reps >= 1),
  rpe          REAL CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  performed_at TEXT NOT NULL,
  timezone_id  TEXT NOT NULL,
  local_date   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_sets_exercise_time
  ON sets (exercise_id, performed_at, id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sets_workout_time
  ON sets (workout_id, performed_at, id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sets_local_date
  ON sets (local_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sets_updated_at
  ON sets (updated_at);

CREATE INDEX IF NOT EXISTS idx_workouts_updated_at
  ON workouts (updated_at);

PRAGMA user_version = 1;
