import type { DatabaseClient } from "../db/types";
import { ProfileRepository } from "../repositories/profile-repository";
import { pullSync, pushSync } from "./api";
import {
  clearSyncOutbox,
  listSyncOutbox,
  markSyncAttempt,
  recordSyncError,
} from "./outbox";
import type { SyncPullResponse } from "./types";

const LAST_CURSOR = "last_pull_cursor";
const LAST_SUCCESS = "last_success_at";
const LAST_ERROR = "last_error";

type PushBodyWeightEntry = {
  id: string;
  weightKg: number;
  measuredAt: string;
  timezoneId: string;
  localDate: string;
  updatedAt: string;
  deletedAt: string | null;
};

type PushWorkoutRow = {
  id: string;
  status: "completed" | "abandoned";
  startedAt: string;
  endedAt: string;
  timezoneId: string;
  bodyweightKg: number | null;
  localDate: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type PushSetRow = {
  id: string;
  exerciseId: string;
  setType: "warmup" | "working";
  weightKg: number;
  reps: number;
  rpe: number | null;
  performedAt: string;
  timezoneId: string;
  localDate: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type PushTemplateRow = {
  id: string;
  name: string;
  source: "custom";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

async function getState(db: DatabaseClient, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM sync_state WHERE key = ?",
    [key],
  );
  return row?.value ?? null;
}

async function setState(db: DatabaseClient, key: string, value: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

async function buildPushPayload(db: DatabaseClient) {
  const profile = await new ProfileRepository(db).getProfile();
  const bodyWeightEntries = await db.getAllAsync<PushBodyWeightEntry>(
    `SELECT id, weight_kg AS weightKg, measured_at AS measuredAt,
            timezone_id AS timezoneId, local_date AS localDate,
            updated_at AS updatedAt, deleted_at AS deletedAt
     FROM body_weight_entries`,
    [],
  );
  const workoutRows = await db.getAllAsync<PushWorkoutRow>(
    `SELECT id, status, started_at AS startedAt, ended_at AS endedAt,
            timezone_id AS timezoneId, bodyweight_kg AS bodyweightKg,
            local_date AS localDate, note, created_at AS createdAt,
            updated_at AS updatedAt, deleted_at AS deletedAt
     FROM workouts
     WHERE status IN ('completed', 'abandoned')
     ORDER BY started_at ASC, id ASC`,
    [],
  );
  const templateRows = await db.getAllAsync<PushTemplateRow>(
    `SELECT id, name, 'custom' AS source, created_at AS createdAt,
            updated_at AS updatedAt, deleted_at AS deletedAt
     FROM workout_templates
     WHERE source = 'custom'
     ORDER BY updated_at ASC, id ASC`,
    [],
  );

  const workouts = [];
  for (const workout of workoutRows) {
    const exercises = await db.getAllAsync<{ exerciseId: string; position: number }>(
      `SELECT exercise_id AS exerciseId, position
       FROM workout_exercises WHERE workout_id = ? ORDER BY position ASC`,
      [workout.id],
    );
    const sets = await db.getAllAsync<PushSetRow>(
      `SELECT id, exercise_id AS exerciseId, set_type AS setType,
              weight_kg AS weightKg, reps, rpe, performed_at AS performedAt,
              timezone_id AS timezoneId, local_date AS localDate,
              created_at AS createdAt, updated_at AS updatedAt,
              deleted_at AS deletedAt
       FROM sets WHERE workout_id = ? ORDER BY performed_at ASC, id ASC`,
      [workout.id],
    );
    workouts.push({ ...workout, exercises, sets });
  }

  const templates = [];
  for (const template of templateRows) {
    const exercises = await db.getAllAsync<{ exerciseId: string; position: number }>(
      `SELECT exercise_id AS exerciseId, position
       FROM template_exercises
       WHERE template_id = ?
       ORDER BY position ASC, exercise_id ASC`,
      [template.id],
    );
    templates.push({ ...template, exercises });
  }

  return {
    profile: profile
      ? {
          displayName: profile.displayName,
          timezoneId: profile.timezoneId,
          unit: profile.unit,
          language: profile.language,
          weeklyTarget: profile.weeklyTarget,
          bodyweightKg: profile.bodyweightKg,
          heightCm: profile.heightCm,
          updatedAt: profile.updatedAt,
        }
      : null,
    bodyWeightEntries,
    workouts,
    templates,
  };
}

async function applyPull(db: DatabaseClient, payload: SyncPullResponse): Promise<void> {
  await db.withTransactionAsync(async () => {
    if (payload.profile) {
      await new ProfileRepository(db).saveProfile({
        displayName: payload.profile.displayName,
        timezoneId: payload.profile.timezoneId,
        unit: payload.profile.unit,
        language: payload.profile.language,
        weeklyTarget: payload.profile.weeklyTarget,
        bodyweightKg: payload.profile.bodyweightKg,
        heightCm: payload.profile.heightCm,
        updatedAt: payload.profile.clientUpdatedAt,
      }, { enqueue: false });
    }

    for (const template of payload.templates ?? []) {
      const result = await db.runAsync(
        `INSERT INTO workout_templates
          (id, name, source, created_at, updated_at, deleted_at)
         VALUES (?, ?, 'custom', ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at
         WHERE workout_templates.source = 'custom'
           AND workout_templates.updated_at <= excluded.updated_at`,
        [
          template.id,
          template.name,
          template.createdAt,
          template.updatedAt,
          template.deletedAt,
        ],
      );

      if (result.changes !== 1) continue;

      await db.runAsync(
        "DELETE FROM template_exercises WHERE template_id = ?",
        [template.id],
      );
      if (template.deletedAt) continue;

      for (const exercise of template.exercises) {
        await db.runAsync(
          `INSERT INTO template_exercises
            (template_id, exercise_id, position, created_at)
           VALUES (?, ?, ?, ?)`,
          [template.id, exercise.exerciseId, exercise.position, template.createdAt],
        );
      }
    }

    for (const entry of payload.bodyWeightEntries) {
      await db.runAsync(
        `INSERT INTO body_weight_entries
          (id, weight_kg, measured_at, timezone_id, local_date,
           created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           weight_kg = excluded.weight_kg,
           measured_at = excluded.measured_at,
           timezone_id = excluded.timezone_id,
           local_date = excluded.local_date,
           updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at
         WHERE body_weight_entries.updated_at <= excluded.updated_at`,
        [
          entry.id,
          entry.weightKg,
          entry.measuredAt,
          entry.timezoneId,
          entry.localDate,
          entry.createdAt,
          entry.updatedAt,
          entry.deletedAt,
        ],
      );
    }

    for (const workout of payload.workouts) {
      await db.runAsync(
        `INSERT INTO workouts
          (id, status, started_at, ended_at, timezone_id, bodyweight_kg,
           local_date, note, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status, ended_at = excluded.ended_at,
           note = excluded.note, updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at
         WHERE workouts.updated_at <= excluded.updated_at`,
        [
          workout.id,
          workout.status,
          workout.startedAt,
          workout.endedAt,
          workout.timezoneId,
          workout.bodyweightKg,
          workout.localDate,
          workout.note,
          workout.createdAt,
          workout.updatedAt,
          workout.deletedAt,
        ],
      );
    }

    for (const relation of payload.workoutExercises) {
      await db.runAsync(
        `INSERT OR IGNORE INTO workout_exercises
          (workout_id, exercise_id, position, created_at)
         VALUES (?, ?, ?, ?)`,
        [relation.workoutId, relation.exerciseId, relation.position, new Date().toISOString()],
      );
    }

    for (const set of payload.sets) {
      await db.runAsync(
        `INSERT INTO sets
          (id, workout_id, exercise_id, set_type, weight_kg, reps, rpe,
           performed_at, timezone_id, local_date, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           set_type = excluded.set_type, weight_kg = excluded.weight_kg,
           reps = excluded.reps, rpe = excluded.rpe,
           updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
         WHERE sets.updated_at <= excluded.updated_at`,
        [
          set.id,
          set.workoutId,
          set.exerciseId,
          set.setType,
          set.weightKg,
          set.reps,
          set.rpe,
          set.performedAt,
          set.timezoneId,
          set.localDate,
          set.createdAt,
          set.updatedAt,
          set.deletedAt,
        ],
      );
    }
  });
}

export type SyncResult = {
  success: boolean;
  message: string;
  syncedAt: string | null;
  pendingCount: number;
};

export async function syncNow(db: DatabaseClient): Promise<SyncResult> {
  const pending = await listSyncOutbox(db);
  await markSyncAttempt(db, pending);
  try {
    const pushResponse = await pushSync(await buildPushPayload(db));
    const cursor = await getState(db, LAST_CURSOR);
    const pulled = await pullSync(cursor);
    await applyPull(db, pulled);
    await clearSyncOutbox(db, pending);
    await setState(db, LAST_CURSOR, pulled.cursor);
    await setState(db, LAST_SUCCESS, pushResponse.serverTime);
    await setState(db, LAST_ERROR, "");
    return {
      success: true,
      message: "Synced successfully.",
      syncedAt: pushResponse.serverTime,
      pendingCount: (await listSyncOutbox(db)).length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    await recordSyncError(db, pending, message);
    await setState(db, LAST_ERROR, message);
    return {
      success: false,
      message,
      syncedAt: await getState(db, LAST_SUCCESS),
      pendingCount: (await listSyncOutbox(db)).length,
    };
  }
}

export async function getSyncStatus(db: DatabaseClient): Promise<{
  lastSuccess: string | null;
  lastError: string | null;
  pendingCount: number;
}> {
  const pending = await listSyncOutbox(db);
  return {
    lastSuccess: await getState(db, LAST_SUCCESS),
    lastError: await getState(db, LAST_ERROR),
    pendingCount: pending.length,
  };
}
