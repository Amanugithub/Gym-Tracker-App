CREATE TABLE IF NOT EXISTS workout_templates (
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id                TEXT NOT NULL,
  name              TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  created_at        TIMESTAMPTZ NOT NULL,
  client_updated_at TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_workout_templates_sync
  ON workout_templates (user_id, updated_at);

CREATE TABLE IF NOT EXISTS template_exercises (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  position    INTEGER NOT NULL CHECK (position >= 0),
  created_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, template_id, exercise_id),
  FOREIGN KEY (user_id, template_id)
    REFERENCES workout_templates(user_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_template_exercises_position
  ON template_exercises (user_id, template_id, position);
