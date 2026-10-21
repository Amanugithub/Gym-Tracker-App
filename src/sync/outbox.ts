import type { DatabaseClient } from "../db/types";

export type SyncEntityType = "profile" | "body_weight" | "workout" | "template";

export type SyncOutboxEntry = {
  entityType: SyncEntityType;
  entityId: string;
  createdAt: string;
  attempts: number;
  lastAttemptAt: string | null;
  lastError: string | null;
};

type SyncOutboxRow = {
  entity_type: SyncEntityType;
  entity_id: string;
  created_at: string;
  attempts: number;
  last_attempt_at: string | null;
  last_error: string | null;
};

function mapRow(row: SyncOutboxRow): SyncOutboxEntry {
  return {
    entityType: row.entity_type,
    entityId: row.entity_id,
    createdAt: row.created_at,
    attempts: row.attempts,
    lastAttemptAt: row.last_attempt_at,
    lastError: row.last_error,
  };
}

export async function enqueueSync(
  db: DatabaseClient,
  entityType: SyncEntityType,
  entityId: string,
): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO sync_outbox
      (entity_type, entity_id, created_at)
     VALUES (?, ?, ?)`,
    [entityType, entityId, new Date().toISOString()],
  );
}

export async function listSyncOutbox(db: DatabaseClient): Promise<SyncOutboxEntry[]> {
  const rows = await db.getAllAsync<SyncOutboxRow>(
    `SELECT entity_type, entity_id, created_at, attempts,
            last_attempt_at, last_error
     FROM sync_outbox
     ORDER BY created_at ASC, entity_type ASC, entity_id ASC`,
    [],
  );
  return rows.map(mapRow);
}

export async function markSyncAttempt(
  db: DatabaseClient,
  entries: readonly SyncOutboxEntry[],
): Promise<void> {
  const now = new Date().toISOString();
  for (const entry of entries) {
    await db.runAsync(
      `UPDATE sync_outbox
       SET attempts = attempts + 1, last_attempt_at = ?, last_error = NULL
       WHERE entity_type = ? AND entity_id = ?`,
      [now, entry.entityType, entry.entityId],
    );
  }
}

export async function recordSyncError(
  db: DatabaseClient,
  entries: readonly SyncOutboxEntry[],
  message: string,
): Promise<void> {
  for (const entry of entries) {
    await db.runAsync(
      `UPDATE sync_outbox
       SET last_error = ?
       WHERE entity_type = ? AND entity_id = ?`,
      [message, entry.entityType, entry.entityId],
    );
  }
}

export async function clearSyncOutbox(
  db: DatabaseClient,
  entries: readonly SyncOutboxEntry[],
): Promise<void> {
  for (const entry of entries) {
    await db.runAsync(
      `DELETE FROM sync_outbox
       WHERE entity_type = ? AND entity_id = ?`,
      [entry.entityType, entry.entityId],
    );
  }
}
