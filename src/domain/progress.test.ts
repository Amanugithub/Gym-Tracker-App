import { describe, expect, it } from "vitest";

import type { Workout } from "../db/types";
import {
  calculateConsistencySummary,
  calculateProgressStats,
  summarizeWorkout,
} from "./progress";

function workout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "workout-1",
    status: "completed",
    startedAt: "2026-10-21T10:00:00.000Z",
    endedAt: "2026-10-21T11:00:00.000Z",
    timezoneId: "Africa/Addis_Ababa",
    bodyweightKg: 75,
    localDate: "2026-10-21",
    note: null,
    createdAt: "2026-10-21T10:00:00.000Z",
    updatedAt: "2026-10-21T11:00:00.000Z",
    deletedAt: null,
    exercises: [
      {
        exerciseId: "bench",
        name: "Bench Press",
        equipment: "barbell",
        kind: "weighted",
        sortOrder: 1,
      },
      {
        exerciseId: "pull-up",
        name: "Pull-up",
        equipment: "bodyweight",
        kind: "bodyweight",
        sortOrder: 2,
      },
    ],
    sets: [
      {
        id: "set-1",
        workoutId: "workout-1",
        exerciseId: "bench",
        setType: "working",
        weightKg: 60,
        reps: 5,
        rpe: null,
        performedAt: "2026-10-21T10:15:00.000Z",
        timezoneId: "Africa/Addis_Ababa",
        localDate: "2026-10-21",
        createdAt: "2026-10-21T10:15:00.000Z",
        updatedAt: "2026-10-21T10:15:00.000Z",
        deletedAt: null,
      },
      {
        id: "set-2",
        workoutId: "workout-1",
        exerciseId: "pull-up",
        setType: "working",
        weightKg: 5,
        reps: 8,
        rpe: null,
        performedAt: "2026-10-21T10:30:00.000Z",
        timezoneId: "Africa/Addis_Ababa",
        localDate: "2026-10-21",
        createdAt: "2026-10-21T10:30:00.000Z",
        updatedAt: "2026-10-21T10:30:00.000Z",
        deletedAt: null,
      },
    ],
    ...overrides,
  };
}

describe("progress calculations", () => {
  it("summarizes weighted and bodyweight volume", () => {
    expect(summarizeWorkout(workout())).toMatchObject({
      exerciseCount: 2,
      setCount: 2,
      volumeKg: 940,
    });
  });

  it("excludes soft-deleted sets from summaries", () => {
    const deletedSet = {
      ...workout().sets[0],
      id: "deleted-set",
      deletedAt: "2026-10-21T12:00:00.000Z",
    };
    const summary = summarizeWorkout(
      workout({ sets: [deletedSet, workout().sets[1]] }),
    );

    expect(summary.setCount).toBe(1);
    expect(summary.workingSetCount).toBe(1);
    expect(summary.volumeKg).toBe(640);
  });

  it("calculates weekly totals and per-exercise bests", () => {
    const base = workout();
    const first = workout({
      sets: [
        ...base.sets,
        {
          ...base.sets[0],
          id: "set-4",
          reps: 4,
        },
      ],
    });
    const second = workout({
      id: "workout-2",
      localDate: "2026-10-20",
      startedAt: "2026-10-20T10:00:00.000Z",
      endedAt: "2026-10-20T11:00:00.000Z",
      sets: [
        {
          ...first.sets[0],
          id: "set-3",
          workoutId: "workout-2",
          weightKg: 70,
          reps: 3,
        },
      ],
    });

    const stats = calculateProgressStats([first, second], {
      currentLocalDate: "2026-10-21",
      weeklyTarget: 4,
    });

    expect(stats.completedWorkoutCount).toBe(2);
    expect(stats.totalSetCount).toBe(4);
    expect(stats.workoutsThisWeek).toBe(1);
    expect(stats.qualifyingWorkoutCount).toBe(1);
    expect(stats.weeklyTarget).toBe(4);
    expect(stats.trainingDayCount).toBe(1);
    expect(stats.currentStreak).toBe(1);
    expect(stats.trackedExerciseCount).toBe(2);
    expect(stats.exercises.find((item) => item.exerciseId === "bench")).toMatchObject({
      heaviestWeightKg: 70,
      heaviestReps: 3,
      mostRepsWeightKg: 60,
      mostReps: 5,
      sessionCount: 2,
      bestE1rmKg: expect.closeTo(77, 5),
      prCount: 2,
    });
  });

  it("never combines the best weight and reps from different sets", () => {
    const firstWorkout = workout({
      id: "first",
      sets: [
        { ...workout().sets[0], id: "bench-12", weightKg: 50, reps: 12 },
        { ...workout().sets[0], id: "bench-11", weightKg: 50, reps: 11 },
        { ...workout().sets[0], id: "bench-10", weightKg: 50, reps: 10 },
      ],
    });
    const secondWorkout = workout({
      id: "second",
      sets: [
        { ...workout().sets[0], id: "bench-5-a", weightKg: 51, reps: 5 },
        { ...workout().sets[0], id: "bench-5-b", weightKg: 51, reps: 5 },
        { ...workout().sets[0], id: "bench-5-c", weightKg: 51, reps: 5 },
      ],
    });

    expect(calculateProgressStats([firstWorkout, secondWorkout]).exercises[0]).toMatchObject({
      heaviestWeightKg: 51,
      heaviestReps: 5,
      mostRepsWeightKg: 50,
      mostReps: 12,
    });
  });

  it("counts multiple qualifying workouts on one date as one training day", () => {
    const base = workout({
      id: "first",
      localDate: "2026-10-20",
      sets: [
        { ...workout().sets[0], id: "a" },
        { ...workout().sets[0], id: "b", performedAt: "2026-10-20T10:20:00.000Z" },
        { ...workout().sets[0], id: "c", performedAt: "2026-10-20T10:30:00.000Z" },
      ],
    });
    const sameDay = workout({
      id: "second",
      localDate: "2026-10-20",
      sets: [
        { ...workout().sets[0], id: "d" },
        { ...workout().sets[0], id: "e", performedAt: "2026-10-20T12:20:00.000Z" },
        { ...workout().sets[0], id: "f", performedAt: "2026-10-20T12:30:00.000Z" },
      ],
    });
    const nextDay = workout({
      id: "third",
      localDate: "2026-10-21",
      sets: [
        { ...workout().sets[0], id: "g" },
        { ...workout().sets[0], id: "h", performedAt: "2026-10-21T12:20:00.000Z" },
        { ...workout().sets[0], id: "i", performedAt: "2026-10-21T12:30:00.000Z" },
      ],
    });

    expect(calculateConsistencySummary([base, sameDay, nextDay], "2026-10-21")).toMatchObject({
      trainingDayCount: 2,
      currentStreak: 2,
      longestStreak: 2,
      dates: ["2026-10-20", "2026-10-21"],
    });
  });
});
