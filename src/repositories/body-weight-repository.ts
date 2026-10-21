import type {
  AddBodyWeightInput,
  BodyWeightEntry,
  DatabaseClient,
} from "../db/types";

type BodyWeightRow = {
  id: string;
  weight_kg: number;
  measured_at: string;
  timezone_id: string;
  local_date: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const BODY_WEIGHT_FIELDS = `
  SELECT id, weight_kg, measured_at, timezone_id, local_date,
         created_at, updated_at, deleted_at
  FROM body_weight_entries
`;

function mapEntry(row: BodyWeightRow): BodyWeightEntry {
  return {
    id: row.id,
    weightKg: row.weight_kg,
    measuredAt: row.measured_at,
    timezoneId: row.timezone_id,
    localDate: row.local_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class BodyWeightRepository {
  constructor(private readonly db: DatabaseClient) {}

  async listEntries(limit = 365): Promise<BodyWeightEntry[]> {
    const safeLimit = Math.max(1, Math.floor(limit));
    const rows = await this.db.getAllAsync<BodyWeightRow>(
      `${BODY_WEIGHT_FIELDS}
       WHERE deleted_at IS NULL
       ORDER BY measured_at DESC, id DESC
       LIMIT ?`,
      [safeLimit],
    );
    return rows.reverse().map(mapEntry);
  }

  async getLatestEntry(): Promise<BodyWeightEntry | null> {
    const row = await this.db.getFirstAsync<BodyWeightRow>(
      `${BODY_WEIGHT_FIELDS}
       WHERE deleted_at IS NULL
       ORDER BY measured_at DESC, id DESC
       LIMIT 1`,
      [],
    );
    return row ? mapEntry(row) : null;
  }

  async recordIfChanged(input: AddBodyWeightInput): Promise<BodyWeightEntry | null> {
    const latest = await this.getLatestEntry();
    if (latest?.weightKg === input.weightKg) {
      await this.refreshProfileCurrentWeight();
      return latest;
    }
    return this.addEntry(input);
  }

  async addEntry(input: AddBodyWeightInput): Promise<BodyWeightEntry> {
    const now = new Date().toISOString();
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO body_weight_entries
          (id, weight_kg, measured_at, timezone_id, local_date,
           created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          input.id,
          input.weightKg,
          input.measuredAt,
          input.timezoneId,
          input.localDate,
          now,
          now,
        ],
      );
      await this.db.runAsync(
        `UPDATE profile
         SET bodyweight_kg = ?, updated_at = ?
         WHERE id = 1`,
        [input.weightKg, now],
      );
    });

    const entry = await this.db.getFirstAsync<BodyWeightRow>(
      `${BODY_WEIGHT_FIELDS} WHERE id = ?`,
      [input.id],
    );
    if (!entry) throw new Error("Bodyweight entry was not available after saving");
    return mapEntry(entry);
  }

  async deleteEntry(id: string): Promise<void> {
    const now = new Date().toISOString();
    const result = await this.db.runAsync(
      `UPDATE body_weight_entries
       SET deleted_at = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [now, now, id],
    );
    if (result.changes !== 1) throw new Error("Bodyweight entry was not found");
    await this.refreshProfileCurrentWeight();
  }

  async refreshProfileCurrentWeight(): Promise<void> {
    const latest = await this.getLatestEntry();
    await this.db.runAsync(
      `UPDATE profile
       SET bodyweight_kg = ?, updated_at = ?
       WHERE id = 1`,
      [latest?.weightKg ?? null, new Date().toISOString()],
    );
  }
}
