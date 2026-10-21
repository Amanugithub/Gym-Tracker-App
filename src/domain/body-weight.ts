import type { BodyWeightEntry } from "../db/types";

export type WeightProgressPoint = {
  entryId: string;
  localDate: string;
  measuredAt: string;
  weightKg: number;
  bmi: number | null;
};

export type WeightProgress = {
  points: WeightProgressPoint[];
  startingWeightKg: number | null;
  currentWeightKg: number | null;
  changeKg: number | null;
  changePercent: number | null;
  startingBmi: number | null;
  currentBmi: number | null;
  bmiChange: number | null;
};

export function calculateBmi(
  weightKg: number,
  heightCm: number | null,
): number | null {
  if (
    !Number.isFinite(weightKg) ||
    weightKg <= 0 ||
    heightCm === null ||
    !Number.isFinite(heightCm) ||
    heightCm <= 0
  ) {
    return null;
  }
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function calculateWeightProgress(
  entries: BodyWeightEntry[],
  heightCm: number | null,
): WeightProgress {
  const points = entries
    .filter((entry) => entry.deletedAt === null)
    .sort((a, b) =>
      a.measuredAt.localeCompare(b.measuredAt) || a.id.localeCompare(b.id),
    )
    .map((entry) => ({
      entryId: entry.id,
      localDate: entry.localDate,
      measuredAt: entry.measuredAt,
      weightKg: entry.weightKg,
      bmi: calculateBmi(entry.weightKg, heightCm),
    }));

  const starting = points[0] ?? null;
  const current = points.at(-1) ?? null;
  const changeKg = starting && current ? current.weightKg - starting.weightKg : null;
  const changePercent =
    changeKg !== null && starting && starting.weightKg > 0
      ? (changeKg / starting.weightKg) * 100
      : null;
  const bmiChange =
    starting?.bmi !== null && starting?.bmi !== undefined &&
    current?.bmi !== null && current?.bmi !== undefined
      ? current.bmi - starting.bmi
      : null;

  return {
    points,
    startingWeightKg: starting?.weightKg ?? null,
    currentWeightKg: current?.weightKg ?? null,
    changeKg,
    changePercent,
    startingBmi: starting?.bmi ?? null,
    currentBmi: current?.bmi ?? null,
    bmiChange,
  };
}
