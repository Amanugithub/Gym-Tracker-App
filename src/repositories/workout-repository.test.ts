import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../db/types";
import { WorkoutRepository } from "./workout-repository";

function fakeDatabase(): DatabaseClient {
  return {
    execAsync: vi.fn(),
    runAsync: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
    getFirstAsync: vi.fn(),
    getAllAsync: vi.fn(),
    withTransactionAsync: vi.fn(async (task) => task()),
  };
}

const workoutRow = {
  id: "workout-1",
  status: "active" as const,
  started_at: "2026-10-21T10:00:00.000Z",
  ended_at: null,
  timezone_id: "Africa/Addis_Ababa",
  bodyweight_kg: 75,
  local_date: "2026-10-21",
  note: null,
  created_at: "2026-10-21T10:00:00.000Z",
  updated_at: "2026-10-21T10:00:00.000Z",
  deleted_at: null,
};

describe("WorkoutRepository", () => {
  it("creates a workout and saves its selected exercises", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getFirstAsync).mockResolvedValueOnce(null).mockResolvedValueOnce(workoutRow);
    vi.mocked(db.getAllAsync)
      .mockResolvedValueOnce([
        {
          exercise_id: "barbell-bench-press",
          name: "Barbell Bench Press",
          equipment: "barbell",
          kind: "weighted",
          sort_order: 30,
        },
      ])
      .mockResolvedValueOnce([]);

    const workout = await new WorkoutRepository(db).createWorkout({
      id: "workout-1",
      startedAt: "2026-10-21T10:00:00.000Z",
      timezoneId: "Africa/Addis_Ababa",
      localDate: "2026-10-21",
      bodyweightKg: 75,
      exerciseIds: ["barbell-bench-press", "barbell-bench-press"],
    });

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenCalledTimes(2);
    expect(workout.id).toBe("workout-1");
    expect(workout.exercises[0]?.name).toBe("Barbell Bench Press");
  });

  it("allows an empty workout before exercises are chosen", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getFirstAsync)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(workoutRow);
    vi.mocked(db.getAllAsync)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const workout = await new WorkoutRepository(db).createWorkout({
      id: "workout-1",
      startedAt: "2026-10-21T10:00:00.000Z",
      timezoneId: "Africa/Addis_Ababa",
      localDate: "2026-10-21",
      bodyweightKg: null,
      exerciseIds: [],
    });

    expect(workout.exercises).toEqual([]);
  });

  it("adds exercises to an active workout without duplicating them", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getFirstAsync)
      .mockResolvedValueOnce({ id: "workout-1" })
      .mockResolvedValueOnce({ position: 1 });

    await new WorkoutRepository(db).addExercisesToWorkout("workout-1", [
      "barbell-bench-press",
      "barbell-bench-press",
    ]);

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO workout_exercises"),
      ["workout-1", "barbell-bench-press", 2, expect.any(String)],
    );
  });

  it("lists completed workouts with their exercises and sets", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getAllAsync)
      .mockResolvedValueOnce([{ ...workoutRow, status: "completed", ended_at: "2026-10-21T11:00:00.000Z" }])
      .mockResolvedValueOnce([
        {
          exercise_id: "barbell-bench-press",
          name: "Barbell Bench Press",
          equipment: "barbell",
          kind: "weighted",
          sort_order: 30,
        },
      ])
      .mockResolvedValueOnce([]);

    const workouts = await new WorkoutRepository(db).listCompletedWorkouts();

    expect(workouts).toHaveLength(1);
    expect(workouts[0]?.status).toBe("completed");
    expect(workouts[0]?.exercises[0]?.name).toBe("Barbell Bench Press");
    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("status IN (?)"),
      ["completed", 50],
    );
  });

  it("saves a set with a client-generated id", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getFirstAsync).mockResolvedValue({ id: "workout-1" });
    const set = await new WorkoutRepository(db).addSet({
      id: "set-1",
      workoutId: "workout-1",
      exerciseId: "pull-up",
      setType: "working",
      weightKg: 0,
      reps: 8,
      rpe: null,
      performedAt: "2026-10-21T10:15:00.000Z",
      timezoneId: "Africa/Addis_Ababa",
      localDate: "2026-10-21",
    });

    expect(set.id).toBe("set-1");
    expect(set.weightKg).toBe(0);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO sets"),
      expect.arrayContaining(["workout-1", "pull-up", 0, 8]),
    );
  });

  it("does not save a set outside an active workout exercise", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getFirstAsync).mockResolvedValue(null);

    await expect(
      new WorkoutRepository(db).addSet({
        id: "set-1",
        workoutId: "completed-workout",
        exerciseId: "pull-up",
        setType: "working",
        weightKg: 0,
        reps: 8,
        rpe: null,
        performedAt: "2026-10-21T10:15:00.000Z",
        timezoneId: "Africa/Addis_Ababa",
        localDate: "2026-10-21",
      }),
    ).rejects.toThrow("active workout");

    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it("updates a set while the workout is active", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getFirstAsync).mockResolvedValue({ id: "workout-1" });

    await new WorkoutRepository(db).updateSet({
      id: "set-1",
      workoutId: "workout-1",
      exerciseId: "pull-up",
      setType: "warmup",
      weightKg: 2.5,
      reps: 10,
      rpe: null,
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE sets"),
      [
        "warmup",
        2.5,
        10,
        null,
        expect.any(String),
        "set-1",
        "workout-1",
        "pull-up",
      ],
    );
  });

  it("soft-deletes a set while the workout is active", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getFirstAsync).mockResolvedValue({ id: "workout-1" });

    await new WorkoutRepository(db).deleteSet("workout-1", "set-1");

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("SET deleted_at"),
      [expect.any(String), expect.any(String), "set-1", "workout-1"],
    );
  });

  it("does not finish a workout that is no longer active", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getFirstAsync).mockResolvedValue({ count: 1 });
    vi.mocked(db.runAsync).mockResolvedValue({ changes: 0, lastInsertRowId: 0 });

    await expect(
      new WorkoutRepository(db).finishWorkout("workout-1"),
    ).rejects.toThrow("Only an active workout");
  });
});
