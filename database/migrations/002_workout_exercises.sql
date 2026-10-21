-- Persist the exercises selected for each workout.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workout_exercises (
  workout_id  TEXT NOT NULL REFERENCES workouts(id),
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  position    INTEGER NOT NULL CHECK (position >= 0),
  created_at  TEXT NOT NULL,
  PRIMARY KEY (workout_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_workout_exercises_position
  ON workout_exercises (workout_id, position);

PRAGMA user_version = 2;
