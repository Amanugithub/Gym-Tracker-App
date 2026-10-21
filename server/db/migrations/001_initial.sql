CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  google_subject TEXT UNIQUE,
  email          TEXT,
  display_name   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id             TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name        TEXT,
  timezone_id         TEXT NOT NULL,
  unit                TEXT NOT NULL CHECK (unit IN ('kg', 'lb')),
  language            TEXT NOT NULL CHECK (language IN ('en', 'am')),
  weekly_target       INTEGER NOT NULL CHECK (weekly_target BETWEEN 1 AND 7),
  bodyweight_kg       DOUBLE PRECISION CHECK (bodyweight_kg IS NULL OR bodyweight_kg > 0),
  height_cm           DOUBLE PRECISION CHECK (height_cm IS NULL OR height_cm > 0),
  client_updated_at   TIMESTAMPTZ NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS body_weight_entries (
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id                  TEXT NOT NULL,
  weight_kg           DOUBLE PRECISION NOT NULL CHECK (weight_kg > 0),
  measured_at         TIMESTAMPTZ NOT NULL,
  timezone_id         TEXT NOT NULL,
  local_date          DATE NOT NULL,
  client_updated_at   TIMESTAMPTZ NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_body_weight_sync
  ON body_weight_entries (user_id, updated_at);

CREATE TABLE IF NOT EXISTS workouts (
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id                  TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('completed', 'abandoned')),
  started_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at            TIMESTAMPTZ NOT NULL,
  timezone_id         TEXT NOT NULL,
  bodyweight_kg       DOUBLE PRECISION CHECK (bodyweight_kg IS NULL OR bodyweight_kg > 0),
  local_date          DATE NOT NULL,
  note                TEXT,
  client_updated_at   TIMESTAMPTZ NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_workouts_sync
  ON workouts (user_id, updated_at);

CREATE TABLE IF NOT EXISTS workout_exercises (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id    TEXT NOT NULL,
  exercise_id   TEXT NOT NULL,
  position      INTEGER NOT NULL CHECK (position >= 0),
  created_at    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, workout_id, exercise_id),
  FOREIGN KEY (user_id, workout_id)
    REFERENCES workouts(user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sets (
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id                  TEXT NOT NULL,
  workout_id          TEXT NOT NULL,
  exercise_id         TEXT NOT NULL,
  set_type            TEXT NOT NULL CHECK (set_type IN ('warmup', 'working')),
  weight_kg           DOUBLE PRECISION NOT NULL CHECK (weight_kg >= 0),
  reps                INTEGER NOT NULL CHECK (reps >= 1),
  rpe                 DOUBLE PRECISION CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  performed_at        TIMESTAMPTZ NOT NULL,
  timezone_id         TEXT NOT NULL,
  local_date          DATE NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL,
  client_updated_at   TIMESTAMPTZ NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, workout_id)
    REFERENCES workouts(user_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sets_sync
  ON sets (user_id, updated_at);
