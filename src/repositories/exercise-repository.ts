import type {
  DatabaseClient,
  Exercise,
  Locale,
} from "../db/types";

type ExerciseRow = {
  id: string;
  equipment: Exercise["equipment"];
  kind: Exercise["kind"];
  is_active: number;
  sort_order: number;
  name: string;
};

const SELECT_EXERCISE_FIELDS = `
  SELECT e.id, e.equipment, e.kind, e.is_active, e.sort_order,
         COALESCE(requested.name, english.name) AS name
  FROM exercises e
  LEFT JOIN exercise_names requested
    ON requested.exercise_id = e.id AND requested.locale = ?
  LEFT JOIN exercise_names english
    ON english.exercise_id = e.id AND english.locale = 'en'
`;

function mapExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    equipment: row.equipment,
    kind: row.kind,
    isActive: row.is_active === 1,
    sortOrder: row.sort_order,
    name: row.name,
  };
}

export class ExerciseRepository {
  constructor(private readonly db: DatabaseClient) {}

  async listActiveExercises(locale: Locale = "en"): Promise<Exercise[]> {
    const rows = await this.db.getAllAsync<ExerciseRow>(
      `${SELECT_EXERCISE_FIELDS}
       WHERE e.is_active = 1
       ORDER BY e.sort_order ASC, e.id ASC`,
      [locale],
    );
    return rows.map(mapExercise);
  }

  async getExercise(id: string, locale: Locale = "en"): Promise<Exercise | null> {
    const row = await this.db.getFirstAsync<ExerciseRow>(
      `${SELECT_EXERCISE_FIELDS}
       WHERE e.id = ? AND e.is_active = 1`,
      [locale, id],
    );
    return row ? mapExercise(row) : null;
  }
}
