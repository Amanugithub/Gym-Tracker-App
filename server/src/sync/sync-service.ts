import type { Pool, PoolClient } from "pg";

import { withTransaction } from "../db/client";
import type { SyncPush } from "./contracts";

function nullableDate(value: string | null): string | null {
  return value;
}

async function ensureUser(client: PoolClient, userId: string) {
  await client.query(
    `INSERT INTO users (id)
     VALUES ($1)
     ON CONFLICT (id) DO NOTHING`,
    [userId],
  );
}

export async function pushSync(
  database: Pool,
  userId: string,
  payload: SyncPush,
): Promise<{ serverTime: string; acceptedWorkoutIds: string[] }> {
  return withTransaction(database, async (client) => {
    await ensureUser(client, userId);

    if (payload.profile) {
      const profile = payload.profile;
      await client.query(
        `INSERT INTO profiles
          (user_id, display_name, timezone_id, unit, language, weekly_target,
           bodyweight_kg, height_cm, client_updated_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
         ON CONFLICT (user_id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           timezone_id = EXCLUDED.timezone_id,
           unit = EXCLUDED.unit,
           language = EXCLUDED.language,
           weekly_target = EXCLUDED.weekly_target,
           bodyweight_kg = EXCLUDED.bodyweight_kg,
           height_cm = EXCLUDED.height_cm,
           client_updated_at = EXCLUDED.client_updated_at,
           updated_at = now()
         WHERE profiles.client_updated_at <= EXCLUDED.client_updated_at`,
        [
          userId,
          profile.displayName,
          profile.timezoneId,
          profile.unit,
          profile.language,
          profile.weeklyTarget,
          profile.bodyweightKg,
          profile.heightCm,
          profile.updatedAt,
        ],
      );
    }

    for (const entry of payload.bodyWeightEntries) {
      await client.query(
        `INSERT INTO body_weight_entries
          (user_id, id, weight_kg, measured_at, timezone_id, local_date,
           client_updated_at, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8)
         ON CONFLICT (user_id, id) DO UPDATE SET
           weight_kg = EXCLUDED.weight_kg,
           measured_at = EXCLUDED.measured_at,
           timezone_id = EXCLUDED.timezone_id,
           local_date = EXCLUDED.local_date,
           client_updated_at = EXCLUDED.client_updated_at,
           updated_at = now(),
           deleted_at = EXCLUDED.deleted_at
         WHERE body_weight_entries.client_updated_at <= EXCLUDED.client_updated_at
           AND (
             body_weight_entries.deleted_at IS NULL
             OR EXCLUDED.deleted_at IS NOT NULL
           )`,
        [
          userId,
          entry.id,
          entry.weightKg,
          entry.measuredAt,
          entry.timezoneId,
          entry.localDate,
          entry.updatedAt,
          nullableDate(entry.deletedAt),
        ],
      );
    }

    const acceptedWorkoutIds: string[] = [];
    for (const workout of payload.workouts) {
      await client.query(
        `INSERT INTO workouts
          (user_id, id, status, started_at, ended_at, timezone_id,
           bodyweight_kg, local_date, note, client_updated_at, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), $11)
         ON CONFLICT (user_id, id) DO UPDATE SET
           note = EXCLUDED.note,
           client_updated_at = EXCLUDED.client_updated_at,
           updated_at = now()
         WHERE workouts.client_updated_at <= EXCLUDED.client_updated_at`,
        [
          userId,
          workout.id,
          workout.status,
          workout.startedAt,
          workout.endedAt,
          workout.timezoneId,
          workout.bodyweightKg,
          workout.localDate,
          workout.note,
          workout.updatedAt,
          nullableDate(workout.deletedAt),
        ],
      );

      for (const exercise of workout.exercises) {
        await client.query(
          `INSERT INTO workout_exercises
            (user_id, workout_id, exercise_id, position, created_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, workout_id, exercise_id) DO NOTHING`,
          [userId, workout.id, exercise.exerciseId, exercise.position, workout.createdAt],
        );
      }

      for (const set of workout.sets) {
        await client.query(
          `INSERT INTO sets
            (user_id, id, workout_id, exercise_id, set_type, weight_kg, reps, rpe,
             performed_at, timezone_id, local_date, created_at, client_updated_at,
             updated_at, deleted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), $14)
           ON CONFLICT (user_id, id) DO NOTHING`,
          [
            userId,
            set.id,
            workout.id,
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
            nullableDate(set.deletedAt),
          ],
        );
      }
      acceptedWorkoutIds.push(workout.id);
    }

    return {
      serverTime: new Date().toISOString(),
      acceptedWorkoutIds,
    };
  });
}

export async function pullSync(
  database: Pool,
  userId: string,
  since: string | null,
): Promise<Record<string, unknown>> {
  const cursor = new Date().toISOString();
  const range = since ? `updated_at > $2 AND updated_at <= $3` : `updated_at <= $2`;
  const values = since ? [userId, since, cursor] : [userId, cursor];

  const profile = await database.query(
    `SELECT display_name AS "displayName", timezone_id AS "timezoneId",
            unit, language, weekly_target AS "weeklyTarget",
            bodyweight_kg AS "bodyweightKg", height_cm AS "heightCm",
            client_updated_at AS "clientUpdatedAt", updated_at AS "updatedAt"
     FROM profiles
     WHERE user_id = $1 AND ${range}
     ORDER BY updated_at DESC
     LIMIT 1`,
    values,
  );
  const bodyWeightEntries = await database.query(
    `SELECT id, weight_kg AS "weightKg", measured_at AS "measuredAt",
            timezone_id AS "timezoneId", local_date AS "localDate",
            client_updated_at AS "clientUpdatedAt", updated_at AS "updatedAt",
            deleted_at AS "deletedAt"
     FROM body_weight_entries
     WHERE user_id = $1 AND ${range}
     ORDER BY measured_at ASC, id ASC`,
    values,
  );
  const workouts = await database.query<{ id: string }>(
    `SELECT id, status, started_at AS "startedAt", ended_at AS "endedAt",
            timezone_id AS "timezoneId", bodyweight_kg AS "bodyweightKg",
            local_date AS "localDate", note,
            client_updated_at AS "clientUpdatedAt", updated_at AS "updatedAt",
            deleted_at AS "deletedAt"
     FROM workouts
     WHERE user_id = $1 AND ${range}
     ORDER BY started_at ASC, id ASC`,
    values,
  );
  const workoutIds = workouts.rows.map((workout) => workout.id);
  const workoutExercises = workoutIds.length
    ? await database.query(
        `SELECT workout_id AS "workoutId", exercise_id AS "exerciseId", position
         FROM workout_exercises
         WHERE user_id = $1 AND workout_id = ANY($2::text[])
         ORDER BY workout_id, position`,
        [userId, workoutIds],
      )
    : { rows: [] };
  const sets = workoutIds.length
    ? await database.query(
        `SELECT id, workout_id AS "workoutId", exercise_id AS "exerciseId",
                set_type AS "setType", weight_kg AS "weightKg", reps, rpe,
                performed_at AS "performedAt", timezone_id AS "timezoneId",
                local_date AS "localDate", created_at AS "createdAt",
                client_updated_at AS "clientUpdatedAt", updated_at AS "updatedAt",
                deleted_at AS "deletedAt"
         FROM sets
         WHERE user_id = $1 AND workout_id = ANY($2::text[])
         ORDER BY performed_at ASC, id ASC`,
        [userId, workoutIds],
      )
    : { rows: [] };

  return {
    cursor,
    profile: profile.rows[0] ?? null,
    bodyWeightEntries: bodyWeightEntries.rows,
    workouts: workouts.rows,
    workoutExercises: workoutExercises.rows,
    sets: sets.rows,
  };
}
