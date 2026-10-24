import type { Workout } from "../db/types";
import { calculatePersonalRecords, type PRType } from "./prs";
import { summarizeWorkout } from "./progress";

export type WeeklyVolume = {
  key: string;
  label: string;
  volumeKg: number;
  sets: number;
};

export type ExerciseSession = {
  workoutId: string;
  localDate: string;
  sets: Workout["sets"];
  volumeKg: number;
};

export type RecordRow = {
  setId: string;
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  localDate: string;
  weightKg: number;
  reps: number;
  types: PRType[];
};

export function completedWorkouts(workouts: Workout[]): Workout[] {
  return workouts.filter((workout) => workout.status === "completed" && workout.deletedAt === null);
}

function dateToUtc(localDate: string): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function utcToDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dateDaysBefore(localDate: string, days: number): string {
  const date = dateToUtc(localDate);
  date.setUTCDate(date.getUTCDate() - days);
  return utcToDateString(date);
}

export function filterWorkoutsByDays(workouts: Workout[], currentLocalDate: string, days: number): Workout[] {
  const start = dateDaysBefore(currentLocalDate, days - 1);
  return completedWorkouts(workouts).filter((workout) => workout.localDate >= start && workout.localDate <= currentLocalDate);
}

function mondayOf(localDate: string): string {
  const date = dateToUtc(localDate);
  const daysFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return utcToDateString(date);
}

export function calculateWeeklyVolume(workouts: Workout[], currentLocalDate: string, days = 84): WeeklyVolume[] {
  const firstDate = dateDaysBefore(currentLocalDate, days - 1);
  const buckets = new Map<string, WeeklyVolume>();
  for (const workout of filterWorkoutsByDays(workouts, currentLocalDate, days)) {
    const week = mondayOf(workout.localDate);
    const current = buckets.get(week) ?? { key: week, label: week.slice(5), volumeKg: 0, sets: 0 };
    const summary = summarizeWorkout(workout);
    current.volumeKg += summary.volumeKg;
    current.sets += summary.workingSetCount;
    buckets.set(week, current);
  }
  const result: WeeklyVolume[] = [];
  const cursor = mondayOf(firstDate);
  const cursorDate = dateToUtc(cursor);
  const end = dateToUtc(currentLocalDate);
  while (cursorDate <= end) {
    const key = utcToDateString(cursorDate);
    result.push(buckets.get(key) ?? { key, label: key.slice(5), volumeKg: 0, sets: 0 });
    cursorDate.setUTCDate(cursorDate.getUTCDate() + 7);
  }
  return result;
}

export function exerciseSessions(workouts: Workout[], exerciseId: string): ExerciseSession[] {
  return completedWorkouts(workouts)
    .map((workout) => {
      const sets = workout.sets.filter((set) => set.exerciseId === exerciseId && set.deletedAt === null);
      return {
        workoutId: workout.id,
        localDate: workout.localDate,
        sets,
        volumeKg: summarizeWorkout({ ...workout, sets }).volumeKg,
      };
    })
    .filter((session) => session.sets.length > 0)
    .sort((a, b) => b.localDate.localeCompare(a.localDate));
}

export function recordRows(workouts: Workout[]): RecordRow[] {
  const completed = completedWorkouts(workouts);
  const records = new Map(calculatePersonalRecords(completed).map((record) => [record.setId, record.types]));
  return completed
    .flatMap((workout) => workout.sets.map((set) => {
      const exercise = workout.exercises.find((candidate) => candidate.exerciseId === set.exerciseId);
      return {
        setId: set.id,
        workoutId: workout.id,
        exerciseId: set.exerciseId,
        exerciseName: exercise?.name ?? set.exerciseId,
        localDate: workout.localDate,
        weightKg: set.weightKg,
        reps: set.reps,
        types: records.get(set.id) ?? [],
      };
    }))
    .filter((row) => row.types.length > 0)
    .sort((a, b) => b.localDate.localeCompare(a.localDate));
}

