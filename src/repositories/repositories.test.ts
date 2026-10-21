import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../db/types";
import { ExerciseRepository } from "./exercise-repository";
import { BodyWeightRepository } from "./body-weight-repository";
import { ProfileRepository } from "./profile-repository";

function fakeDatabase(): DatabaseClient {
  return {
    execAsync: vi.fn(),
    runAsync: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
    getFirstAsync: vi.fn(),
    getAllAsync: vi.fn(),
    withTransactionAsync: vi.fn(),
  } as unknown as DatabaseClient;
}

describe("ProfileRepository", () => {
  it("maps a database row into the domain profile", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getFirstAsync).mockResolvedValue({
      id: 1,
      display_name: "Amanuel",
      timezone_id: "Africa/Addis_Ababa",
      unit: "kg",
      language: "en",
      weekly_target: 4,
      bodyweight_kg: 75,
      height_cm: 175,
      updated_at: "2026-10-21T10:00:00.000Z",
    });

    const profile = await new ProfileRepository(db).getProfile();

    expect(profile).toEqual({
      id: 1,
      displayName: "Amanuel",
      timezoneId: "Africa/Addis_Ababa",
      unit: "kg",
      language: "en",
      weeklyTarget: 4,
      bodyweightKg: 75,
      heightCm: 175,
      updatedAt: "2026-10-21T10:00:00.000Z",
    });
  });

  it("upserts a profile and returns the saved record", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getFirstAsync).mockResolvedValue({
      id: 1,
      display_name: null,
      timezone_id: "Africa/Addis_Ababa",
      unit: "kg",
      language: "am",
      weekly_target: 3,
      bodyweight_kg: null,
      height_cm: null,
      updated_at: "2026-10-21T10:00:00.000Z",
    });

    const profile = await new ProfileRepository(db).saveProfile({
      displayName: null,
      timezoneId: "Africa/Addis_Ababa",
      unit: "kg",
      language: "am",
      weeklyTarget: 3,
      bodyweightKg: null,
      heightCm: null,
      updatedAt: "2026-10-21T10:00:00.000Z",
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT(id) DO UPDATE"),
      [null, "Africa/Addis_Ababa", "kg", "am", 3, null, null, "2026-10-21T10:00:00.000Z"],
    );
    expect(profile.language).toBe("am");
  });
});

describe("ExerciseRepository", () => {
  it("maps active exercises and asks SQL for the requested locale", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getAllAsync).mockResolvedValue([
      {
        id: "barbell-bench-press",
        equipment: "barbell",
        kind: "weighted",
        is_active: 1,
        sort_order: 30,
        name: "Barbell Bench Press",
      },
    ]);

    const exercises = await new ExerciseRepository(db).listActiveExercises("am");

    expect(exercises).toEqual([
      {
        id: "barbell-bench-press",
        equipment: "barbell",
        kind: "weighted",
        isActive: true,
        sortOrder: 30,
        name: "Barbell Bench Press",
      },
    ]);
    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("requested.locale = ?"),
      ["am"],
    );
  });

  it("returns null for an inactive or missing exercise", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getFirstAsync).mockResolvedValue(null);

    const exercise = await new ExerciseRepository(db).getExercise("missing");

    expect(exercise).toBeNull();
    expect(db.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("e.is_active = 1"),
      ["en", "missing"],
    );
  });
});

describe("BodyWeightRepository", () => {
  it("returns bodyweight entries in chronological order", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getAllAsync).mockResolvedValue([
      {
        id: "later",
        weight_kg: 72,
        measured_at: "2026-10-15T08:00:00.000Z",
        timezone_id: "Africa/Addis_Ababa",
        local_date: "2026-10-15",
        created_at: "2026-10-15T08:00:00.000Z",
        updated_at: "2026-10-15T08:00:00.000Z",
        deleted_at: null,
      },
      {
        id: "earlier",
        weight_kg: 75,
        measured_at: "2026-10-01T08:00:00.000Z",
        timezone_id: "Africa/Addis_Ababa",
        local_date: "2026-10-01",
        created_at: "2026-10-01T08:00:00.000Z",
        updated_at: "2026-10-01T08:00:00.000Z",
        deleted_at: null,
      },
    ]);

    const entries = await new BodyWeightRepository(db).listEntries(30);

    expect(entries.map((entry) => entry.id)).toEqual(["earlier", "later"]);
    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY measured_at DESC"),
      [30],
    );
  });

  it("saves a measurement and updates the current profile weight", async () => {
    const db = fakeDatabase();
    vi.mocked(db.withTransactionAsync).mockImplementation(async (task) => task());
    vi.mocked(db.getFirstAsync).mockResolvedValue({
      id: "weight-1",
      weight_kg: 75,
      measured_at: "2026-10-21T08:00:00.000Z",
      timezone_id: "Africa/Addis_Ababa",
      local_date: "2026-10-21",
      created_at: "2026-10-21T08:00:00.000Z",
      updated_at: "2026-10-21T08:00:00.000Z",
      deleted_at: null,
    });

    const saved = await new BodyWeightRepository(db).addEntry({
      id: "weight-1",
      weightKg: 75,
      measuredAt: "2026-10-21T08:00:00.000Z",
      timezoneId: "Africa/Addis_Ababa",
      localDate: "2026-10-21",
    });

    expect(saved.weightKg).toBe(75);
    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("SET bodyweight_kg"),
      [75, expect.any(String)],
    );
  });
});
