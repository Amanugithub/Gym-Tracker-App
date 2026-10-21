import { describe, expect, it, vi } from "vitest";

import {
  EXERCISE_SEED,
  seedExercises,
  seedWorkoutTemplates,
  WORKOUT_TEMPLATE_SEED,
} from "./seed";
import type { DatabaseClient } from "./types";

describe("seedExercises", () => {
  it("seeds every exercise with an English display name", async () => {
    const db: DatabaseClient = {
      execAsync: vi.fn(),
      runAsync: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
      getFirstAsync: vi.fn(),
      getAllAsync: vi.fn(),
      withTransactionAsync: vi.fn(),
    };

    await seedExercises(db);

    expect(db.runAsync).toHaveBeenCalledTimes(EXERCISE_SEED.length * 2);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO exercises"),
      [
        "barbell-bench-press",
        "barbell",
        "weighted",
        30,
      ],
    );
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO exercise_names"),
      ["barbell-bench-press", "Barbell Bench Press"],
    );
  });
});

describe("seedWorkoutTemplates", () => {
  it("seeds the built-in templates and their ordered exercises", async () => {
    const db: DatabaseClient = {
      execAsync: vi.fn(),
      runAsync: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
      getFirstAsync: vi.fn(),
      getAllAsync: vi.fn(),
      withTransactionAsync: vi.fn(),
    };

    await seedWorkoutTemplates(db);

    const exerciseIds = new Set(EXERCISE_SEED.map((exercise) => exercise.id));
    expect(WORKOUT_TEMPLATE_SEED).toHaveLength(5);
    expect(WORKOUT_TEMPLATE_SEED.every((template) =>
      template.exerciseIds.every((exerciseId) => exerciseIds.has(exerciseId)),
    )).toBe(true);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO workout_templates"),
      ["system-push-day", "Push Day", expect.any(String), expect.any(String)],
    );
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO template_exercises"),
      ["system-push-day", "barbell-bench-press", 0, expect.any(String)],
    );
  });
});
