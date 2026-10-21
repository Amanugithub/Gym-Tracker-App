import type { Workout } from "../db/types";

export type PRType = "weight" | "reps" | "e1rm";

export type SetLog = {
  id: string;
  exerciseId: string;
  setType: "warmup" | "working";
  weightKg: number;
  reps: number;
  performedAt: string;
  deleted?: boolean;
};

export type PersonalRecord = {
  setId: string;
  exerciseId: string;
  performedAt: string;
  types: PRType[];
};

/** Epley estimated one-rep max. High-rep sets are intentionally excluded. */
export function e1rm(weightKg: number, reps: number): number | null {
  if (
    !Number.isFinite(weightKg) ||
    !Number.isFinite(reps) ||
    !Number.isInteger(reps) ||
    reps < 1 ||
    weightKg <= 0 ||
    reps > 10
  ) {
    return null;
  }
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/**
 * Calculates records in chronological order, independent of input order.
 * The first valid working set for an exercise establishes its baseline.
 */
export function detectPRs(sets: SetLog[]): Record<string, PRType[]> {
  const result: Record<string, PRType[]> = {};
  const groupedSets = new Map<string, SetLog[]>();

  for (const set of sets) {
    result[set.id] = [];
    if (set.deleted === true || set.setType !== "working") continue;

    const exerciseSets = groupedSets.get(set.exerciseId) ?? [];
    exerciseSets.push(set);
    groupedSets.set(set.exerciseId, exerciseSets);
  }

  for (const exerciseSets of groupedSets.values()) {
    const ordered = [...exerciseSets].sort((a, b) =>
      a.performedAt.localeCompare(b.performedAt) || a.id.localeCompare(b.id),
    );

    let maxWeight = -Infinity;
    let maxE1rm = -Infinity;
    let hasE1rmBaseline = false;

    for (const [index, set] of ordered.entries()) {
      const types: PRType[] = [];
      const estimated1rm = e1rm(set.weightKg, set.reps);
      const isBaseline = maxWeight === -Infinity;

      if (!isBaseline && set.weightKg > maxWeight) types.push("weight");

      // A reps PR must only compare against earlier sets at the same or heavier load.
      const earlierSetsAtOrAboveLoad = ordered.slice(0, index).filter(
        (earlierSet) => earlierSet.weightKg >= set.weightKg,
      );
      const earlierMaxRepsAtOrAboveLoad = earlierSetsAtOrAboveLoad.reduce(
        (maximum, earlierSet) => Math.max(maximum, earlierSet.reps),
        -Infinity,
      );
      if (
        earlierMaxRepsAtOrAboveLoad > -Infinity &&
        set.reps > earlierMaxRepsAtOrAboveLoad
      ) {
        types.push("reps");
      }

      if (estimated1rm !== null) {
        if (hasE1rmBaseline && estimated1rm > maxE1rm) {
          types.push("e1rm");
        }
        maxE1rm = Math.max(maxE1rm, estimated1rm);
        hasE1rmBaseline = true;
      }

      result[set.id] = types;
      maxWeight = Math.max(maxWeight, set.weightKg);
    }
  }

  return result;
}

export function calculatePersonalRecords(workouts: Workout[]): PersonalRecord[] {
  const exerciseKinds = new Map(
    workouts.flatMap((workout) =>
      workout.exercises.map((exercise) => [exercise.exerciseId, exercise.kind] as const),
    ),
  );
  const logs = workouts.flatMap((workout) =>
    workout.status === "completed" && workout.deletedAt === null
      ? workout.sets
          .filter((set) => set.deletedAt === null)
          .map<SetLog>((set) => ({
            id: set.id,
            exerciseId: set.exerciseId,
            setType: set.setType,
            weightKg: set.weightKg,
            reps: set.reps,
            performedAt: set.performedAt,
          }))
      : [],
  );
  const detected = detectPRs(logs);

  return logs
    .map((set) => ({
      setId: set.id,
      exerciseId: set.exerciseId,
      performedAt: set.performedAt,
      types: detected[set.id].filter(
        (type) => type !== "e1rm" || exerciseKinds.get(set.exerciseId) !== "bodyweight",
      ),
    }))
    .filter((record) => record.types.length > 0)
    .sort((a, b) => a.performedAt.localeCompare(b.performedAt));
}
