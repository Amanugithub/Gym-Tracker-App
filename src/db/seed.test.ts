import { describe, expect, it, vi } from "vitest";

import { EXERCISE_SEED, seedExercises } from "./seed";
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
