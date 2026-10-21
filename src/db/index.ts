import * as SQLite from "expo-sqlite";

import { migrateDatabase } from "./migrations";
import { seedExercises } from "./seed";
import type { DatabaseClient, ExpoDatabase } from "./types";

export async function initializeGymDatabase(db: ExpoDatabase): Promise<void> {
  await migrateDatabase(db);
  await seedExercises(db);
}

export async function openGymDatabase(
  databaseName = "gym-tracker.db",
): Promise<ExpoDatabase> {
  const db = await SQLite.openDatabaseAsync(databaseName);
  await initializeGymDatabase(db);
  return db;
}

export async function resetGymDatabase(db: DatabaseClient): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM body_weight_entries", []);
    await db.runAsync("DELETE FROM sets", []);
    await db.runAsync("DELETE FROM workout_exercises", []);
    await db.runAsync("DELETE FROM workouts", []);
    await db.runAsync("DELETE FROM profile", []);
  });
}
