-- Add built-in and user-created workout templates.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workout_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  source      TEXT NOT NULL CHECK (source IN ('system', 'custom')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);

CREATE TABLE IF NOT EXISTS template_exercises (
  template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  position    INTEGER NOT NULL CHECK (position >= 0),
  created_at  TEXT NOT NULL,
  PRIMARY KEY (template_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_template_exercises_position
  ON template_exercises (template_id, position);

CREATE INDEX IF NOT EXISTS idx_workout_templates_updated_at
  ON workout_templates (updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_workout
  ON workouts (status)
  WHERE status = 'active' AND deleted_at IS NULL;

PRAGMA user_version = 6;
