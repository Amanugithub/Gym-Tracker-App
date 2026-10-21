ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

UPDATE workouts
SET created_at = started_at
WHERE created_at IS NULL;

ALTER TABLE workouts
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;
