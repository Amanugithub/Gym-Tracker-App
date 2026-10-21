import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../db/types";
import {
  clearSyncOutbox,
  enqueueSync,
  listSyncOutbox,
  markSyncAttempt,
  recordSyncError,
} from "./outbox";

function fakeDatabase(): DatabaseClient {
  return {
    execAsync: vi.fn(),
    runAsync: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
    getFirstAsync: vi.fn(),
    getAllAsync: vi.fn(),
    withTransactionAsync: vi.fn(async (task) => task()),
  };
}

const entry = {
  entityType: "workout" as const,
  entityId: "workout-1",
  createdAt: "2026-10-21T10:00:00.000Z",
  attempts: 0,
  lastAttemptAt: null,
  lastError: null,
};

describe("sync outbox", () => {
  it("queues each entity only once", async () => {
    const db = fakeDatabase();

    await enqueueSync(db, "workout", "workout-1");

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO sync_outbox"),
      ["workout", "workout-1", expect.any(String)],
    );
  });

  it("maps queued rows into sync entries", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getAllAsync).mockResolvedValueOnce([
      {
        entity_type: "body_weight",
        entity_id: "weight-1",
        created_at: "2026-10-21T10:00:00.000Z",
        attempts: 2,
        last_attempt_at: "2026-10-21T10:05:00.000Z",
        last_error: "Network unavailable",
      },
    ]);

    await expect(listSyncOutbox(db)).resolves.toEqual([
      {
        entityType: "body_weight",
        entityId: "weight-1",
        createdAt: "2026-10-21T10:00:00.000Z",
        attempts: 2,
        lastAttemptAt: "2026-10-21T10:05:00.000Z",
        lastError: "Network unavailable",
      },
    ]);
  });

  it("records attempts and clears only the captured entries", async () => {
    const db = fakeDatabase();

    await markSyncAttempt(db, [entry]);
    await recordSyncError(db, [entry], "Server unavailable");
    await clearSyncOutbox(db, [entry]);

    expect(db.runAsync).toHaveBeenCalledTimes(3);
    expect(db.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("attempts = attempts + 1"),
      [expect.any(String), "workout", "workout-1"],
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SET last_error = ?"),
      ["Server unavailable", "workout", "workout-1"],
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("DELETE FROM sync_outbox"),
      ["workout", "workout-1"],
    );
  });
});
