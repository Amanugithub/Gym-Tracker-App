import type {
  SQLiteBindParams,
  SQLiteDatabase,
  SQLiteRunResult,
} from "expo-sqlite";

/**
 * The small part of expo-sqlite used by our repositories.
 * Keeping this interface narrow makes repositories easy to test and keeps
 * SQLite details out of the feature layer.
 */
export interface DatabaseClient {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SQLiteBindParams): Promise<SQLiteRunResult>;
  getFirstAsync<T>(source: string, params: SQLiteBindParams): Promise<T | null>;
  getAllAsync<T>(source: string, params: SQLiteBindParams): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export type ExpoDatabase = SQLiteDatabase;

export type ExerciseEquipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "kettlebell"
  | "bodyweight"
  | "other";

export type ExerciseKind = "weighted" | "bodyweight";
export type Locale = "en" | "am";
export type Unit = "kg" | "lb";

export type Exercise = {
  id: string;
  equipment: ExerciseEquipment;
  kind: ExerciseKind;
  isActive: boolean;
  sortOrder: number;
  name: string;
};

export type Profile = {
  id: 1;
  displayName: string | null;
  timezoneId: string;
  unit: Unit;
  language: Locale;
  weeklyTarget: number;
  bodyweightKg: number | null;
  heightCm: number | null;
  updatedAt: string;
};

export type SaveProfileInput = Omit<Profile, "id" | "updatedAt"> & {
  updatedAt?: string;
};

export type BodyWeightEntry = {
  id: string;
  weightKg: number;
  measuredAt: string;
  timezoneId: string;
  localDate: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type AddBodyWeightInput = {
  id: string;
  weightKg: number;
  measuredAt: string;
  timezoneId: string;
  localDate: string;
};

export type WorkoutStatus = "active" | "completed" | "abandoned";
export type SetType = "warmup" | "working";
export type WorkoutTemplateSource = "system" | "custom";

export type WorkoutTemplateExercise = {
  exerciseId: string;
  position: number;
  name: string;
  equipment: ExerciseEquipment;
  kind: ExerciseKind;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  source: WorkoutTemplateSource;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  exercises: WorkoutTemplateExercise[];
};

export type CreateWorkoutTemplateInput = {
  id: string;
  name: string;
  exerciseIds: string[];
};

export type UpdateWorkoutTemplateInput = {
  id: string;
  name: string;
  exerciseIds: string[];
};

export type WorkoutSet = {
  id: string;
  workoutId: string;
  exerciseId: string;
  setType: SetType;
  weightKg: number;
  reps: number;
  rpe: number | null;
  performedAt: string;
  timezoneId: string;
  localDate: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type WorkoutExercise = {
  exerciseId: string;
  name: string;
  equipment: ExerciseEquipment;
  kind: ExerciseKind;
  sortOrder: number;
};

export type Workout = {
  id: string;
  status: WorkoutStatus;
  startedAt: string;
  endedAt: string | null;
  timezoneId: string;
  bodyweightKg: number | null;
  localDate: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  exercises: WorkoutExercise[];
  sets: WorkoutSet[];
};

export type CreateWorkoutInput = {
  id: string;
  startedAt: string;
  timezoneId: string;
  localDate: string;
  bodyweightKg: number | null;
  exerciseIds?: string[];
  templateId?: string;
};

export type AddSetInput = {
  id: string;
  workoutId: string;
  exerciseId: string;
  setType: SetType;
  weightKg: number;
  reps: number;
  rpe: number | null;
  performedAt: string;
  timezoneId: string;
  localDate: string;
};

export type UpdateSetInput = {
  id: string;
  workoutId: string;
  exerciseId: string;
  setType: SetType;
  weightKg: number;
  reps: number;
  rpe: number | null;
};
