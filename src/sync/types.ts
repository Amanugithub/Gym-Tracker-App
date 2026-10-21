import type { Profile, BodyWeightEntry, Workout } from "../db/types";

export type SyncPullResponse = {
  cursor: string;
  profile: (Omit<Profile, "id" | "updatedAt"> & {
    clientUpdatedAt: string;
    updatedAt: string;
  }) | null;
  bodyWeightEntries: (BodyWeightEntry & {
    clientUpdatedAt: string;
    updatedAt: string;
  })[];
  workouts: (Omit<Workout, "exercises" | "sets"> & {
    clientUpdatedAt: string;
    updatedAt: string;
  })[];
  workoutExercises: {
    workoutId: string;
    exerciseId: string;
    position: number;
  }[];
  sets: (Workout["sets"][number] & {
    clientUpdatedAt: string;
    updatedAt: string;
  })[];
};

export type SyncPushResponse = {
  serverTime: string;
  acceptedWorkoutIds: string[];
};
