import type { Workout, WorkoutExercise } from "../db/types";
import { detectPRs, e1rm } from "./prs";

export type WorkoutSummary = {
  workoutId: string;
  localDate: string;
  exerciseCount: number;
  setCount: number;
  workingSetCount: number;
  volumeKg: number;
  isQualified: boolean;
};

export type ExerciseProgress = {
  exerciseId: string;
  name: string;
  setCount: number;
  sessionCount: number;
  heaviestWeightKg: number;
  heaviestReps: number;
  mostReps: number;
  mostRepsWeightKg: number;
  bestE1rmKg: number | null;
  prCount: number;
  lastPerformedAt: string;
};

export type ProgressStats = {
  completedWorkoutCount: number;
  qualifyingWorkoutCount: number;
  totalSetCount: number;
  totalVolumeKg: number;
  trackedExerciseCount: number;
  workoutsThisWeek: number;
  trainingDayCount: number;
  currentStreak: number;
  longestStreak: number;
  weeklyTarget: number | null;
  lastWorkoutDate: string | null;
  exercises: ExerciseProgress[];
};

export type ProgressOptions = {
  currentLocalDate?: string;
  weeklyTarget?: number | null;
};

export type ConsistencySummary = {
  trainingDayCount: number;
  currentStreak: number;
  longestStreak: number;
  dates: string[];
};

function effectiveWeightKg(
  workout: Workout,
  exercise: WorkoutExercise | undefined,
  addedWeightKg: number,
): number {
  if (exercise?.kind === "bodyweight") {
    return (workout.bodyweightKg ?? 0) + addedWeightKg;
  }
  return addedWeightKg;
}

function startOfWeekLocalDate(localDate: string): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const daysFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return date.toISOString().slice(0, 10);
}

export function summarizeWorkout(workout: Workout): WorkoutSummary {
  const visibleSets = workout.sets.filter((set) => set.deletedAt === null);
  const workingSets = visibleSets.filter((set) => set.setType === "working");
  const volumeKg = workingSets.reduce((total, set) => {
    const exercise = workout.exercises.find(
      (candidate) => candidate.exerciseId === set.exerciseId,
    );
    return total + effectiveWeightKg(workout, exercise, set.weightKg) * set.reps;
  }, 0);

  return {
    workoutId: workout.id,
    localDate: workout.localDate,
    exerciseCount: workout.exercises.length,
    setCount: visibleSets.length,
    workingSetCount: workingSets.length,
    volumeKg,
    isQualified: workingSets.length >= 3,
  };
}

export function calculateProgressStats(
  workouts: Workout[],
  options: ProgressOptions = {},
): ProgressStats {
  const completedWorkouts = workouts.filter(
    (workout) => workout.status === "completed" && workout.deletedAt === null,
  );
  const exerciseMap = new Map<string, ExerciseProgress>();
  const weekStart = options.currentLocalDate
    ? startOfWeekLocalDate(options.currentLocalDate)
    : null;

  let totalSetCount = 0;
  let totalVolumeKg = 0;
  let workoutsThisWeek = 0;
  let qualifyingWorkoutCount = 0;
  const allSetLogs = completedWorkouts.flatMap((workout) =>
    workout.sets
      .filter((set) => set.deletedAt === null)
      .map((set) => ({
        id: set.id,
        exerciseId: set.exerciseId,
        setType: set.setType,
        weightKg: set.weightKg,
        reps: set.reps,
        performedAt: set.performedAt,
      })),
  );
  const prTypesBySetId = detectPRs(allSetLogs);

  for (const workout of completedWorkouts) {
    const summary = summarizeWorkout(workout);
    totalSetCount += summary.setCount;
    totalVolumeKg += summary.volumeKg;
    if (summary.isQualified) qualifyingWorkoutCount += 1;

    if (
      weekStart &&
      summary.isQualified &&
      workout.localDate >= weekStart &&
      workout.localDate <= options.currentLocalDate!
    ) {
      workoutsThisWeek += 1;
    }

    const sessionExerciseIds = new Set<string>();
    for (const set of workout.sets) {
      if (set.deletedAt !== null || set.setType !== "working") continue;
      const exercise = workout.exercises.find(
        (candidate) => candidate.exerciseId === set.exerciseId,
      );
      if (!exercise) continue;

      sessionExerciseIds.add(exercise.exerciseId);
      const current = exerciseMap.get(exercise.exerciseId);
      const recordTypes = (prTypesBySetId[set.id] ?? []).filter(
        (type) => type !== "e1rm" || exercise.kind !== "bodyweight",
      );

      if (!current) {
        exerciseMap.set(exercise.exerciseId, {
          exerciseId: exercise.exerciseId,
          name: exercise.name,
          setCount: 1,
          sessionCount: 0,
          heaviestWeightKg: set.weightKg,
          heaviestReps: set.reps,
          mostReps: set.reps,
          mostRepsWeightKg: set.weightKg,
          bestE1rmKg:
            exercise.kind === "bodyweight" ? null : e1rm(set.weightKg, set.reps),
          prCount: recordTypes.length,
          lastPerformedAt: set.performedAt,
        });
        continue;
      }

      current.setCount += 1;
      if (
        set.weightKg > current.heaviestWeightKg ||
        (set.weightKg === current.heaviestWeightKg &&
          set.reps > current.heaviestReps)
      ) {
        current.heaviestWeightKg = set.weightKg;
        current.heaviestReps = set.reps;
      }
      if (
        set.reps > current.mostReps ||
        (set.reps === current.mostReps &&
          set.weightKg > current.mostRepsWeightKg)
      ) {
        current.mostReps = set.reps;
        current.mostRepsWeightKg = set.weightKg;
      }
      if (exercise.kind !== "bodyweight") {
        const estimated1rm = e1rm(set.weightKg, set.reps);
        if (estimated1rm !== null) {
          current.bestE1rmKg = Math.max(current.bestE1rmKg ?? 0, estimated1rm);
        }
      }
      current.prCount += recordTypes.length;
      if (set.performedAt > current.lastPerformedAt) {
        current.lastPerformedAt = set.performedAt;
      }
    }

    for (const exerciseId of sessionExerciseIds) {
      const progress = exerciseMap.get(exerciseId);
      if (progress) progress.sessionCount += 1;
    }
  }

  const exercises = [...exerciseMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const consistency = calculateConsistencySummary(
    completedWorkouts,
    options.currentLocalDate,
  );

  return {
    completedWorkoutCount: completedWorkouts.length,
    qualifyingWorkoutCount,
    totalSetCount,
    totalVolumeKg,
    trackedExerciseCount: exercises.length,
    workoutsThisWeek,
    trainingDayCount: consistency.trainingDayCount,
    currentStreak: consistency.currentStreak,
    longestStreak: consistency.longestStreak,
    weeklyTarget: options.weeklyTarget ?? null,
    lastWorkoutDate: completedWorkouts
      .map((workout) => workout.localDate)
      .sort()
      .at(-1) ?? null,
    exercises,
  };
}

function dayDifference(later: string, earlier: string): number {
  const [laterYear, laterMonth, laterDay] = later.split("-").map(Number);
  const [earlierYear, earlierMonth, earlierDay] = earlier.split("-").map(Number);
  const laterUtc = Date.UTC(laterYear, laterMonth - 1, laterDay);
  const earlierUtc = Date.UTC(earlierYear, earlierMonth - 1, earlierDay);
  return Math.round((laterUtc - earlierUtc) / 86_400_000);
}

export function calculateConsistencySummary(
  workouts: Workout[],
  currentLocalDate?: string,
): ConsistencySummary {
  const dates = [...new Set(
    workouts
      .filter((workout) => workout.status === "completed" && workout.deletedAt === null)
      .filter((workout) => summarizeWorkout(workout).isQualified)
      .map((workout) => workout.localDate),
  )].sort();

  let longestStreak = 0;
  let runningStreak = 0;
  for (let index = 0; index < dates.length; index += 1) {
    runningStreak =
      index > 0 && dayDifference(dates[index], dates[index - 1]) === 1
        ? runningStreak + 1
        : 1;
    longestStreak = Math.max(longestStreak, runningStreak);
  }

  let currentStreak = 0;
  if (dates.length > 0) {
    const lastDate = dates[dates.length - 1];
    const streakIsCurrent =
      !currentLocalDate || dayDifference(currentLocalDate, lastDate) <= 1;
    if (streakIsCurrent) {
      currentStreak = 1;
      for (let index = dates.length - 1; index > 0; index -= 1) {
        if (dayDifference(dates[index], dates[index - 1]) !== 1) break;
        currentStreak += 1;
      }
    }
  }

  return {
    trainingDayCount: dates.length,
    currentStreak,
    longestStreak,
    dates,
  };
}
