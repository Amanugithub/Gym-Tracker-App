import { describe, expect, it } from "vitest";

import type { BodyWeightEntry } from "../db/types";
import { calculateBmi, calculateWeightProgress } from "./body-weight";

function entry(overrides: Partial<BodyWeightEntry> = {}): BodyWeightEntry {
  return {
    id: "weight-1",
    weightKg: 75,
    measuredAt: "2026-10-01T08:00:00.000Z",
    timezoneId: "Africa/Addis_Ababa",
    localDate: "2026-10-01",
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T08:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

describe("bodyweight calculations", () => {
  it("calculates BMI from kilograms and centimeters", () => {
    expect(calculateBmi(75, 175)).toBeCloseTo(24.49, 2);
    expect(calculateBmi(75, null)).toBeNull();
  });

  it("calculates weight and BMI change from chronological entries", () => {
    const progress = calculateWeightProgress(
      [
        entry({ id: "later", weightKg: 72, measuredAt: "2026-10-15T08:00:00.000Z", localDate: "2026-10-15" }),
        entry({ id: "deleted", weightKg: 70, measuredAt: "2026-10-10T08:00:00.000Z", localDate: "2026-10-10", deletedAt: "2026-10-11T08:00:00.000Z" }),
        entry({ id: "earlier", weightKg: 75, measuredAt: "2026-10-01T08:00:00.000Z" }),
      ],
      175,
    );

    expect(progress.points.map((point) => point.entryId)).toEqual(["earlier", "later"]);
    expect(progress.startingWeightKg).toBe(75);
    expect(progress.currentWeightKg).toBe(72);
    expect(progress.changeKg).toBe(-3);
    expect(progress.changePercent).toBeCloseTo(-4, 5);
    expect(progress.currentBmi).toBeCloseTo(23.51, 2);
    expect(progress.bmiChange).toBeCloseTo(-0.98, 2);
  });
});
