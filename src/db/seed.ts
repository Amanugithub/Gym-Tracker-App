import type { DatabaseClient } from "./types";

type ExerciseSeed = {
  id: string;
  equipment: "barbell" | "dumbbell" | "machine" | "cable" | "kettlebell" | "bodyweight";
  kind: "weighted" | "bodyweight";
  nameEn: string;
  sortOrder: number;
};

// English is intentionally the verified seed language for v0. Amharic rows
// can be added after the translations are reviewed instead of shipping guessed
// exercise names.
export const EXERCISE_SEED: readonly ExerciseSeed[] = [
  { id: "barbell-back-squat", equipment: "barbell", kind: "weighted", nameEn: "Barbell Back Squat", sortOrder: 10 },
  { id: "barbell-front-squat", equipment: "barbell", kind: "weighted", nameEn: "Barbell Front Squat", sortOrder: 20 },
  { id: "barbell-bench-press", equipment: "barbell", kind: "weighted", nameEn: "Barbell Bench Press", sortOrder: 30 },
  { id: "barbell-incline-bench-press", equipment: "barbell", kind: "weighted", nameEn: "Barbell Incline Bench Press", sortOrder: 40 },
  { id: "barbell-deadlift", equipment: "barbell", kind: "weighted", nameEn: "Barbell Deadlift", sortOrder: 50 },
  { id: "barbell-romanian-deadlift", equipment: "barbell", kind: "weighted", nameEn: "Barbell Romanian Deadlift", sortOrder: 60 },
  { id: "barbell-overhead-press", equipment: "barbell", kind: "weighted", nameEn: "Barbell Overhead Press", sortOrder: 70 },
  { id: "barbell-row", equipment: "barbell", kind: "weighted", nameEn: "Barbell Row", sortOrder: 80 },
  { id: "barbell-hip-thrust", equipment: "barbell", kind: "weighted", nameEn: "Barbell Hip Thrust", sortOrder: 90 },
  { id: "dumbbell-bench-press", equipment: "dumbbell", kind: "weighted", nameEn: "Dumbbell Bench Press", sortOrder: 100 },
  { id: "dumbbell-incline-bench-press", equipment: "dumbbell", kind: "weighted", nameEn: "Dumbbell Incline Bench Press", sortOrder: 110 },
  { id: "dumbbell-row", equipment: "dumbbell", kind: "weighted", nameEn: "Dumbbell Row", sortOrder: 120 },
  { id: "dumbbell-shoulder-press", equipment: "dumbbell", kind: "weighted", nameEn: "Dumbbell Shoulder Press", sortOrder: 130 },
  { id: "dumbbell-goblet-squat", equipment: "dumbbell", kind: "weighted", nameEn: "Dumbbell Goblet Squat", sortOrder: 140 },
  { id: "dumbbell-biceps-curl", equipment: "dumbbell", kind: "weighted", nameEn: "Dumbbell Biceps Curl", sortOrder: 150 },
  { id: "dumbbell-lateral-raise", equipment: "dumbbell", kind: "weighted", nameEn: "Dumbbell Lateral Raise", sortOrder: 160 },
  { id: "cable-lat-pulldown", equipment: "cable", kind: "weighted", nameEn: "Cable Lat Pulldown", sortOrder: 170 },
  { id: "cable-seated-row", equipment: "cable", kind: "weighted", nameEn: "Cable Seated Row", sortOrder: 180 },
  { id: "cable-triceps-pushdown", equipment: "cable", kind: "weighted", nameEn: "Cable Triceps Pushdown", sortOrder: 190 },
  { id: "machine-leg-press", equipment: "machine", kind: "weighted", nameEn: "Machine Leg Press", sortOrder: 200 },
  { id: "machine-leg-curl", equipment: "machine", kind: "weighted", nameEn: "Machine Leg Curl", sortOrder: 210 },
  { id: "machine-chest-press", equipment: "machine", kind: "weighted", nameEn: "Machine Chest Press", sortOrder: 220 },
  { id: "pull-up", equipment: "bodyweight", kind: "bodyweight", nameEn: "Pull-up", sortOrder: 230 },
  { id: "assisted-pull-up", equipment: "machine", kind: "bodyweight", nameEn: "Assisted Pull-up", sortOrder: 240 },
  { id: "push-up", equipment: "bodyweight", kind: "bodyweight", nameEn: "Push-up", sortOrder: 250 },
  { id: "dip", equipment: "bodyweight", kind: "bodyweight", nameEn: "Dip", sortOrder: 260 },
  { id: "assisted-dip", equipment: "machine", kind: "bodyweight", nameEn: "Assisted Dip", sortOrder: 270 },
];

export async function seedExercises(db: DatabaseClient): Promise<void> {
  for (const exercise of EXERCISE_SEED) {
    await db.runAsync(
      `INSERT OR IGNORE INTO exercises
        (id, equipment, kind, is_active, sort_order)
       VALUES (?, ?, ?, 1, ?)`,
      [exercise.id, exercise.equipment, exercise.kind, exercise.sortOrder],
    );

    await db.runAsync(
      `INSERT OR IGNORE INTO exercise_names (exercise_id, locale, name)
       VALUES (?, 'en', ?)`,
      [exercise.id, exercise.nameEn],
    );
  }
}
