import type { DatabaseClient, Profile, SaveProfileInput } from "../db/types";
import { enqueueSync } from "../sync/outbox";

type ProfileRow = {
  id: number;
  display_name: string | null;
  timezone_id: string;
  unit: "kg" | "lb";
  language: "en" | "am";
  weekly_target: number;
  bodyweight_kg: number | null;
  height_cm: number | null;
  updated_at: string;
};

const PROFILE_QUERY = `
  SELECT id, display_name, timezone_id, unit, language,
         weekly_target, bodyweight_kg, updated_at
         , height_cm
  FROM profile
  WHERE id = 1
`;

function mapProfile(row: ProfileRow): Profile {
  return {
    id: 1,
    displayName: row.display_name,
    timezoneId: row.timezone_id,
    unit: row.unit,
    language: row.language,
    weeklyTarget: row.weekly_target,
    bodyweightKg: row.bodyweight_kg,
    heightCm: row.height_cm,
    updatedAt: row.updated_at,
  };
}

export class ProfileRepository {
  constructor(private readonly db: DatabaseClient) {}

  async getProfile(): Promise<Profile | null> {
    const row = await this.db.getFirstAsync<ProfileRow>(PROFILE_QUERY, []);
    return row ? mapProfile(row) : null;
  }

  async saveProfile(
    input: SaveProfileInput,
    options: { enqueue?: boolean } = {},
  ): Promise<Profile> {
    const updatedAt = input.updatedAt ?? new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO profile
        (id, display_name, timezone_id, unit, language,
         weekly_target, bodyweight_kg, height_cm, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         display_name = excluded.display_name,
         timezone_id = excluded.timezone_id,
         unit = excluded.unit,
         language = excluded.language,
         weekly_target = excluded.weekly_target,
         bodyweight_kg = excluded.bodyweight_kg,
         height_cm = excluded.height_cm,
         updated_at = excluded.updated_at`,
      [
        input.displayName,
        input.timezoneId,
        input.unit,
        input.language,
        input.weeklyTarget,
        input.bodyweightKg,
        input.heightCm,
        updatedAt,
      ],
    );
    if (options.enqueue !== false) await enqueueSync(this.db, "profile", "1");

    const profile = await this.getProfile();
    if (!profile) {
      throw new Error("Profile was not available after saving");
    }
    return profile;
  }
}
