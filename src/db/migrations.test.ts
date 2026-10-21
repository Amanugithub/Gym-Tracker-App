import { describe, expect, it, vi } from "vitest";

import { CURRENT_SCHEMA_VERSION, migrateDatabase } from "./migrations";
import type { DatabaseClient } from "./types";

function fakeDatabase(version: number): DatabaseClient {
  return {
    execAsync: vi.fn(),
    runAsync: vi.fn(),
    getFirstAsync: vi.fn().mockResolvedValue({ user_version: version }),
    getAllAsync: vi.fn(),
    withTransactionAsync: vi.fn(),
  } as unknown as DatabaseClient;
}

describe("migrateDatabase", () => {
  it("runs migrations after the stored version", async () => {
    const db = fakeDatabase(0);

    await migrateDatabase(db);

    expect(db.execAsync).toHaveBeenCalledTimes(CURRENT_SCHEMA_VERSION);
    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS exercises"),
    );
  });

  it("does nothing when the database is current", async () => {
    const db = fakeDatabase(CURRENT_SCHEMA_VERSION);

    await migrateDatabase(db);

    expect(db.execAsync).not.toHaveBeenCalled();
  });

  it("adds templates and enforces one active workout on the current upgrade", async () => {
    const db = fakeDatabase(CURRENT_SCHEMA_VERSION - 1);

    await migrateDatabase(db);

    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS workout_templates"),
    );
    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_workout"),
    );
  });

  it("rejects a database created by a newer app version", async () => {
    const db = fakeDatabase(CURRENT_SCHEMA_VERSION + 1);

    await expect(migrateDatabase(db)).rejects.toThrow("newer than supported");
  });
});
