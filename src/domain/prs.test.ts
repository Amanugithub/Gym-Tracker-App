import { describe, expect, it } from "vitest";

import { detectPRs, e1rm } from "./prs";

let nextId = 0;
function set(
  exerciseId: string,
  weightKg: number,
  reps: number,
  performedAt: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id: `set-${++nextId}`,
    exerciseId,
    setType: "working" as const,
    weightKg,
    reps,
    performedAt,
    ...extra,
  };
}

function typesOf(result: Record<string, string[]>, id: string) {
  return [...(result[id] ?? [])].sort();
}

describe("one-rep max", () => {
  it("uses the Epley estimate for normal rep ranges", () => {
    expect(e1rm(100, 5)).toBeCloseTo(116.67, 1);
    expect(e1rm(80, 10)).toBeCloseTo(106.67, 1);
  });

  it("does not estimate invalid or high-rep sets", () => {
    expect(e1rm(120, 1)).toBe(120);
    expect(e1rm(60, 15)).toBeNull();
    expect(e1rm(0, 5)).toBeNull();
  });
});

describe("personal records", () => {
  it("does not call the first set a PR", () => {
    const first = set("bench", 80, 8, "2026-10-01T10:00:00Z");
    expect(typesOf(detectPRs([first]), first.id)).toEqual([]);
  });

  it("detects weight, rep, and e1RM records independently", () => {
    const first = set("bench", 80, 8, "2026-10-01T10:00:00Z");
    const heavier = set("bench", 85, 6, "2026-10-08T10:00:00Z");
    const moreReps = set("bench", 80, 9, "2026-10-15T10:00:00Z");
    const result = detectPRs([moreReps, first, heavier]);

    expect(typesOf(result, first.id)).toEqual([]);
    expect(typesOf(result, heavier.id)).toEqual(["e1rm", "weight"]);
    expect(typesOf(result, moreReps.id)).toEqual(["e1rm", "reps"]);
  });

  it("ignores warm-ups and re-evaluates after soft deletion", () => {
    const first = set("squat", 100, 5, "2026-10-01T10:00:00Z");
    const warmup = set("squat", 140, 3, "2026-10-02T10:00:00Z", {
      setType: "warmup",
    });
    const deleted = set("squat", 100, 9, "2026-10-03T10:00:00Z", {
      deleted: true,
    });
    const next = set("squat", 105, 5, "2026-10-04T10:00:00Z");
    const result = detectPRs([next, deleted, warmup, first]);

    expect(typesOf(result, warmup.id)).toEqual([]);
    expect(typesOf(result, deleted.id)).toEqual([]);
    expect(typesOf(result, next.id)).toContain("weight");
  });

  it("handles the heavier-load rep record rule", () => {
    const first = set("bench", 80, 8, "2026-10-01T10:00:00Z");
    const heavier = set("bench", 85, 6, "2026-10-08T10:00:00Z");
    const result = detectPRs([first, heavier]);

    expect(typesOf(result, heavier.id)).not.toContain("reps");
  });

  it("compares a rep PR only with earlier sets at the same or heavier load", () => {
    const base = set("bench", 50, 12, "2026-10-01T10:00:00Z");
    const lowerReps = set("bench", 50, 11, "2026-10-01T10:01:00Z");
    const heavier = set("bench", 51, 5, "2026-10-08T10:00:00Z");
    const heavierRepPR = set("bench", 51, 6, "2026-10-08T10:01:00Z");
    const result = detectPRs([base, lowerReps, heavier, heavierRepPR]);

    expect(typesOf(result, lowerReps.id)).not.toContain("reps");
    expect(typesOf(result, heavier.id)).not.toContain("reps");
    expect(typesOf(result, heavierRepPR.id)).toContain("reps");
  });

  it("treats the first valid e1RM after high-rep sets as a baseline", () => {
    const highRepSet = set("bench", 50, 12, "2026-10-01T10:00:00Z");
    const firstValidE1rm = set("bench", 51, 5, "2026-10-08T10:00:00Z");
    const nextE1rm = set("bench", 52, 5, "2026-10-15T10:00:00Z");
    const result = detectPRs([highRepSet, firstValidE1rm, nextE1rm]);

    expect(typesOf(result, firstValidE1rm.id)).not.toContain("e1rm");
    expect(typesOf(result, nextE1rm.id)).toContain("e1rm");
  });
});
