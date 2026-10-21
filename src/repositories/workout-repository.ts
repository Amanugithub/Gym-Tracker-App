import type {
  AddSetInput,
  CreateWorkoutInput,
  DatabaseClient,
  UpdateSetInput,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutStatus,
} from "../db/types";

type WorkoutRow = {
  id: string;
  status: WorkoutStatus;
  started_at: string;
  ended_at: string | null;
  timezone_id: string;
  bodyweight_kg: number | null;
  local_date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type WorkoutExerciseRow = {
  exercise_id: string;
  name: string;
  equipment: WorkoutExercise["equipment"];
  kind: WorkoutExercise["kind"];
  sort_order: number;
};

type WorkoutSetRow = {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_type: WorkoutSet["setType"];
  weight_kg: number;
  reps: number;
  rpe: number | null;
  performed_at: string;
  timezone_id: string;
  local_date: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function mapWorkout(row: WorkoutRow): Workout {
  return {
    id: row.id,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    timezoneId: row.timezone_id,
    bodyweightKg: row.bodyweight_kg,
    localDate: row.local_date,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    exercises: [],
    sets: [],
  };
}

function mapExercise(row: WorkoutExerciseRow): WorkoutExercise {
  return {
    exerciseId: row.exercise_id,
    name: row.name,
    equipment: row.equipment,
    kind: row.kind,
    sortOrder: row.sort_order,
  };
}

function mapSet(row: WorkoutSetRow): WorkoutSet {
  return {
    id: row.id,
    workoutId: row.workout_id,
    exerciseId: row.exercise_id,
    setType: row.set_type,
    weightKg: row.weight_kg,
    reps: row.reps,
    rpe: row.rpe,
    performedAt: row.performed_at,
    timezoneId: row.timezone_id,
    localDate: row.local_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

const WORKOUT_FIELDS = `
  SELECT id, status, started_at, ended_at, timezone_id,
         bodyweight_kg, local_date, note, created_at, updated_at, deleted_at
  FROM workouts
`;

const EXERCISE_FIELDS = `
  SELECT e.id AS exercise_id, n.name, e.equipment, e.kind, e.sort_order
  FROM workout_exercises we
  JOIN exercises e ON e.id = we.exercise_id
  LEFT JOIN exercise_names n
    ON n.exercise_id = e.id AND n.locale = 'en'
`;

const SET_FIELDS = `
  SELECT id, workout_id, exercise_id, set_type, weight_kg, reps, rpe,
         performed_at, timezone_id, local_date, created_at, updated_at, deleted_at
  FROM sets
`;

export class WorkoutRepository {
  constructor(private readonly db: DatabaseClient) {}

  async createWorkout(input: CreateWorkoutInput): Promise<Workout> {
    const exerciseIds = [...new Set(input.exerciseIds)];
    if (await this.getActiveWorkout()) {
      throw new Error("An active workout already exists");
    }

    const createdAt = input.startedAt;

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO workouts
          (id, status, started_at, ended_at, timezone_id,
           bodyweight_kg, local_date, note, created_at, updated_at, deleted_at)
         VALUES (?, 'active', ?, NULL, ?, ?, ?, NULL, ?, ?, NULL)`,
        [
          input.id,
          input.startedAt,
          input.timezoneId,
          input.bodyweightKg,
          input.localDate,
          createdAt,
          createdAt,
        ],
      );

      for (const [position, exerciseId] of exerciseIds.entries()) {
        await this.db.runAsync(
          `INSERT INTO workout_exercises
            (workout_id, exercise_id, position, created_at)
           VALUES (?, ?, ?, ?)`,
          [input.id, exerciseId, position, createdAt],
        );
      }
    });

    const workout = await this.getWorkout(input.id);
    if (!workout) throw new Error("Workout was not available after creation");
    return workout;
  }

  async addExercisesToWorkout(
    workoutId: string,
    exerciseIds: string[],
  ): Promise<void> {
    const uniqueExerciseIds = [...new Set(exerciseIds)];
    if (uniqueExerciseIds.length === 0) return;

    const workout = await this.db.getFirstAsync<{ id: string }>(
      `SELECT id
       FROM workouts
       WHERE id = ? AND status = 'active' AND deleted_at IS NULL`,
      [workoutId],
    );
    if (!workout) throw new Error("Only an active workout can receive exercises");

    const positionRow = await this.db.getFirstAsync<{ position: number | null }>(
      `SELECT MAX(position) AS position
       FROM workout_exercises
       WHERE workout_id = ?`,
      [workoutId],
    );
    let nextPosition = (positionRow?.position ?? -1) + 1;
    const createdAt = new Date().toISOString();

    await this.db.withTransactionAsync(async () => {
      for (const exerciseId of uniqueExerciseIds) {
        await this.db.runAsync(
          `INSERT OR IGNORE INTO workout_exercises
            (workout_id, exercise_id, position, created_at)
           VALUES (?, ?, ?, ?)`,
          [workoutId, exerciseId, nextPosition, createdAt],
        );
        nextPosition += 1;
      }
    });
  }

  async getActiveWorkout(): Promise<Workout | null> {
    const row = await this.db.getFirstAsync<WorkoutRow>(
      `${WORKOUT_FIELDS}
       WHERE status = 'active' AND deleted_at IS NULL
       ORDER BY started_at ASC
       LIMIT 1`,
      [],
    );
    return row ? this.loadWorkout(row) : null;
  }

  async getWorkout(id: string): Promise<Workout | null> {
    const row = await this.db.getFirstAsync<WorkoutRow>(
      `${WORKOUT_FIELDS}
       WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return row ? this.loadWorkout(row) : null;
  }

  async listCompletedWorkouts(limit = 50): Promise<Workout[]> {
    return this.listWorkoutsByStatuses(["completed"], limit);
  }

  async listWorkoutHistory(limit = 50): Promise<Workout[]> {
    return this.listWorkoutsByStatuses(["completed", "abandoned"], limit);
  }

  async updateWorkoutNote(id: string, note: string | null): Promise<void> {
    const now = new Date().toISOString();
    const workout = await this.db.getFirstAsync<{ id: string }>(
      `${WORKOUT_FIELDS}
       WHERE id = ? AND status IN ('active', 'completed') AND deleted_at IS NULL`,
      [id],
    );
    if (!workout) throw new Error("Only an active or completed workout can be updated");

    await this.db.runAsync(
      `UPDATE workouts
       SET note = ?, updated_at = ?
       WHERE id = ? AND status IN ('active', 'completed') AND deleted_at IS NULL`,
      [note?.trim() || null, now, id],
    );
  }

  async addSet(input: AddSetInput): Promise<WorkoutSet> {
    await this.assertActiveWorkoutExercise(input.workoutId, input.exerciseId);

    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO sets
        (id, workout_id, exercise_id, set_type, weight_kg, reps, rpe,
         performed_at, timezone_id, local_date, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        input.id,
        input.workoutId,
        input.exerciseId,
        input.setType,
        input.weightKg,
        input.reps,
        input.rpe,
        input.performedAt,
        input.timezoneId,
        input.localDate,
        now,
        now,
      ],
    );

    return {
      id: input.id,
      workoutId: input.workoutId,
      exerciseId: input.exerciseId,
      setType: input.setType,
      weightKg: input.weightKg,
      reps: input.reps,
      rpe: input.rpe,
      performedAt: input.performedAt,
      timezoneId: input.timezoneId,
      localDate: input.localDate,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
  }

  async updateSet(input: UpdateSetInput): Promise<void> {
    await this.assertEditableWorkoutExercise(input.workoutId, input.exerciseId);
    const now = new Date().toISOString();
    const result = await this.db.runAsync(
      `UPDATE sets
       SET set_type = ?, weight_kg = ?, reps = ?, rpe = ?, updated_at = ?
       WHERE id = ? AND workout_id = ? AND exercise_id = ? AND deleted_at IS NULL`,
      [
        input.setType,
        input.weightKg,
        input.reps,
        input.rpe,
        now,
        input.id,
        input.workoutId,
        input.exerciseId,
      ],
    );
    if (result.changes !== 1) throw new Error("Set was not found in this workout");
  }

  async deleteSet(workoutId: string, setId: string): Promise<void> {
    const workout = await this.db.getFirstAsync<{ id: string }>(
      `SELECT id
       FROM workouts
       WHERE id = ? AND status IN ('active', 'completed') AND deleted_at IS NULL`,
      [workoutId],
    );
    if (!workout) throw new Error("Only an active or completed workout can be edited");

    const now = new Date().toISOString();
    const result = await this.db.runAsync(
      `UPDATE sets
       SET deleted_at = ?, updated_at = ?
       WHERE id = ? AND workout_id = ? AND deleted_at IS NULL`,
      [now, now, setId, workoutId],
    );
    if (result.changes !== 1) throw new Error("Set was not found in this workout");
  }

  async finishWorkout(id: string, endedAt = new Date().toISOString()): Promise<void> {
    const setCount = await this.db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM sets
       WHERE workout_id = ? AND deleted_at IS NULL`,
      [id],
    );
    if (!setCount || setCount.count < 1) {
      throw new Error("A workout needs at least one set before it can be completed");
    }

    const result = await this.db.runAsync(
      `UPDATE workouts
       SET status = 'completed', ended_at = ?, updated_at = ?
       WHERE id = ? AND status = 'active' AND deleted_at IS NULL`,
      [endedAt, endedAt, id],
    );

    if (result.changes !== 1) {
      throw new Error("Only an active workout can be completed");
    }
  }

  async abandonWorkout(id: string, endedAt = new Date().toISOString()): Promise<void> {
    const result = await this.db.runAsync(
      `UPDATE workouts
       SET status = 'abandoned', ended_at = ?, updated_at = ?
       WHERE id = ? AND status = 'active' AND deleted_at IS NULL`,
      [endedAt, endedAt, id],
    );

    if (result.changes !== 1) {
      throw new Error("Only an active workout can be abandoned");
    }
  }

  private async loadWorkout(row: WorkoutRow): Promise<Workout> {
    const workout = mapWorkout(row);
    const [exerciseRows, setRows] = await Promise.all([
      this.db.getAllAsync<WorkoutExerciseRow>(
        `${EXERCISE_FIELDS}
         WHERE we.workout_id = ?
         ORDER BY we.position ASC`,
        [row.id],
      ),
      this.db.getAllAsync<WorkoutSetRow>(
        `${SET_FIELDS}
         WHERE workout_id = ? AND deleted_at IS NULL
         ORDER BY performed_at ASC, id ASC`,
        [row.id],
      ),
    ]);

    workout.exercises = exerciseRows.map(mapExercise);
    workout.sets = setRows.map(mapSet);
    return workout;
  }

  private async listWorkoutsByStatuses(
    statuses: readonly Exclude<WorkoutStatus, "active">[],
    limit: number,
  ): Promise<Workout[]> {
    const safeLimit = Math.max(1, Math.floor(limit));
    const placeholders = statuses.map(() => "?").join(", ");
    const rows = await this.db.getAllAsync<WorkoutRow>(
      `${WORKOUT_FIELDS}
       WHERE status IN (${placeholders}) AND deleted_at IS NULL
       ORDER BY ended_at DESC, started_at DESC
       LIMIT ?`,
      [...statuses, safeLimit],
    );

    return Promise.all(rows.map((row) => this.loadWorkout(row)));
  }

  private async assertActiveWorkoutExercise(
    workoutId: string,
    exerciseId: string,
  ): Promise<void> {
    const workoutExercise = await this.db.getFirstAsync<{ id: string }>(
      `SELECT w.id
       FROM workouts w
       JOIN workout_exercises we ON we.workout_id = w.id
       WHERE w.id = ?
         AND we.exercise_id = ?
         AND w.status = 'active'
         AND w.deleted_at IS NULL`,
      [workoutId, exerciseId],
    );
    if (!workoutExercise) {
      throw new Error("Sets can only be added for exercises in an active workout");
    }
  }

  private async assertEditableWorkoutExercise(
    workoutId: string,
    exerciseId: string,
  ): Promise<void> {
    const workoutExercise = await this.db.getFirstAsync<{ id: string }>(
      `SELECT w.id
       FROM workouts w
       JOIN workout_exercises we ON we.workout_id = w.id
       WHERE w.id = ?
         AND we.exercise_id = ?
         AND w.status IN ('active', 'completed')
         AND w.deleted_at IS NULL`,
      [workoutId, exerciseId],
    );
    if (!workoutExercise) {
      throw new Error("Sets can only be edited in an active or completed workout");
    }
  }
}
