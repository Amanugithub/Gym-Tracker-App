import { describe, expect, it } from "vitest";

import { syncPushSchema } from "../src/sync/contracts";

const iso = "2026-10-21T10:00:00.000Z";

function validWorkout(
  status: "completed" | "abandoned" | "active" = "completed",
) {
  return {
    id: "workout-1",
    status,
    startedAt: iso,
    endedAt: "2026-10-21T11:00:00.000Z",
    timezoneId: "Africa/Addis_Ababa",
    bodyweightKg: 75,
    localDate: "2026-10-21",
    note: null,
    createdAt: iso,
    updatedAt: iso,
    deletedAt: null,
    exercises: [{ exerciseId: "barbell-bench-press", position: 0 }],
    sets: [
      {
        id: "set-1",
        exerciseId: "barbell-bench-press",
        setType: "working",
        weightKg: 50,
        reps: 5,
        rpe: null,
        performedAt: iso,
        timezoneId: "Africa/Addis_Ababa",
        localDate: "2026-10-21",
        createdAt: iso,
        updatedAt: iso,
        deletedAt: null,
      },
    ],
  };
}

describe("sync contract", () => {
  it("accepts terminal workout snapshots and tombstones", () => {
    const result = syncPushSchema.safeParse({
      profile: {
        displayName: "Amanuel",
        timezoneId: "Africa/Addis_Ababa",
        unit: "kg",
        language: "en",
        weeklyTarget: 4,
        bodyweightKg: 75,
        heightCm: 175,
        updatedAt: iso,
      },
      bodyWeightEntries: [
        {
          id: "weight-1",
          weightKg: 75,
          measuredAt: iso,
          timezoneId: "Africa/Addis_Ababa",
          localDate: "2026-10-21",
          updatedAt: iso,
          deletedAt: null,
        },
      ],
      workouts: [validWorkout()],
    });

    expect(result.success).toBe(true);
  });

  it("rejects active workouts from the server sync contract", () => {
    const result = syncPushSchema.safeParse({
      profile: null,
      bodyWeightEntries: [],
      workouts: [validWorkout("active")],
    });

    expect(result.success).toBe(false);
  });

  it("accepts custom template snapshots and deletion tombstones", () => {
    const result = syncPushSchema.safeParse({
      profile: null,
      bodyWeightEntries: [],
      workouts: [],
      templates: [
        {
          id: "template-1",
          name: "Upper Focus",
          source: "custom",
          createdAt: iso,
          updatedAt: iso,
          deletedAt: null,
          exercises: [{ exerciseId: "barbell-bench-press", position: 0 }],
        },
        {
          id: "template-2",
          name: "Old Plan",
          source: "custom",
          createdAt: iso,
          updatedAt: iso,
          deletedAt: "2026-10-21T11:00:00.000Z",
          exercises: [],
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
