import type { DatabaseClient } from "./types";

export const CURRENT_SCHEMA_VERSION = 7;

/**
 * Runtime copy of the SQL migrations in database/migrations.
 * Expo bundles TypeScript reliably, while importing a .sql file would require
 * an extra Metro transformer. Keep the SQL file as the reviewable migration
 * source and keep this string byte-for-byte equivalent in behavior.
 */
export const MIGRATIONS: Record<number, string> = {
  1: `
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
  `,
  2: `
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
  `,
  3: `
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
  `,
  4: `
    CREATE TABLE IF NOT EXISTS sync_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    PRAGMA user_version = 4;
  `,
  5: `
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
  `,
  6: `
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
  `,
  7: `
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
  `,
};

type UserVersionRow = { user_version: number };

export async function migrateDatabase(db: DatabaseClient): Promise<void> {
  const row = await db.getFirstAsync<UserVersionRow>("PRAGMA user_version", []);
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Database version ${currentVersion} is newer than supported version ${CURRENT_SCHEMA_VERSION}`,
    );
  }

  for (let version = currentVersion + 1; version <= CURRENT_SCHEMA_VERSION; version += 1) {
    const migration = MIGRATIONS[version];
    if (!migration) {
      throw new Error(`Missing database migration ${version}`);
    }
    await db.execAsync(migration);
  }
}
