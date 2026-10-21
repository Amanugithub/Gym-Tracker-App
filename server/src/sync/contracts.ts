import { z } from "zod";

const nullableIso = z.string().datetime({ offset: true }).nullable();
const iso = z.string().datetime({ offset: true });
const nullablePositive = z.number().finite().positive().nullable();

export const profileSyncSchema = z.object({
  displayName: z.string().nullable(),
  timezoneId: z.string().min(1),
  unit: z.enum(["kg", "lb"]),
  language: z.enum(["en", "am"]),
  weeklyTarget: z.number().int().min(1).max(7),
  bodyweightKg: nullablePositive,
  heightCm: nullablePositive,
  updatedAt: iso,
});

export const bodyWeightSyncSchema = z.object({
  id: z.string().min(1),
  weightKg: z.number().finite().positive(),
  measuredAt: iso,
  timezoneId: z.string().min(1),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updatedAt: iso,
  deletedAt: nullableIso,
});

export const workoutSetSyncSchema = z.object({
  id: z.string().min(1),
  exerciseId: z.string().min(1),
  setType: z.enum(["warmup", "working"]),
  weightKg: z.number().finite().nonnegative(),
  reps: z.number().int().min(1),
  rpe: z.number().finite().min(1).max(10).nullable(),
  performedAt: iso,
  timezoneId: z.string().min(1),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdAt: iso,
  updatedAt: iso,
  deletedAt: nullableIso,
});

export const workoutSyncSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["completed", "abandoned"]),
  startedAt: iso,
  endedAt: iso,
  timezoneId: z.string().min(1),
  bodyweightKg: nullablePositive,
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().nullable(),
  createdAt: iso,
  updatedAt: iso,
  deletedAt: nullableIso,
  exercises: z.array(
    z.object({
      exerciseId: z.string().min(1),
      position: z.number().int().nonnegative(),
    }),
  ),
  sets: z.array(workoutSetSyncSchema),
});

export const syncPushSchema = z.object({
  profile: profileSyncSchema.nullable(),
  bodyWeightEntries: z.array(bodyWeightSyncSchema),
  workouts: z.array(workoutSyncSchema),
});

export type SyncPush = z.infer<typeof syncPushSchema>;
