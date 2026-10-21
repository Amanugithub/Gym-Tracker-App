import type {
  CreateWorkoutTemplateInput,
  DatabaseClient,
  UpdateWorkoutTemplateInput,
  WorkoutTemplate,
  WorkoutTemplateExercise,
  WorkoutTemplateSource,
} from "../db/types";

type TemplateRow = {
  id: string;
  name: string;
  source: WorkoutTemplateSource;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type TemplateExerciseRow = {
  exercise_id: string;
  position: number;
  name: string;
  equipment: WorkoutTemplateExercise["equipment"];
  kind: WorkoutTemplateExercise["kind"];
};

const TEMPLATE_FIELDS = `
  SELECT id, name, source, created_at, updated_at, deleted_at
  FROM workout_templates
`;

const TEMPLATE_EXERCISE_FIELDS = `
  SELECT te.exercise_id, te.position, n.name, e.equipment, e.kind
  FROM template_exercises te
  JOIN exercises e ON e.id = te.exercise_id
  LEFT JOIN exercise_names n
    ON n.exercise_id = e.id AND n.locale = 'en'
`;

function mapTemplate(row: TemplateRow, exercises: WorkoutTemplateExercise[]): WorkoutTemplate {
  return {
    id: row.id,
    name: row.name,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    exercises,
  };
}

function mapExercise(row: TemplateExerciseRow): WorkoutTemplateExercise {
  return {
    exerciseId: row.exercise_id,
    position: row.position,
    name: row.name,
    equipment: row.equipment,
    kind: row.kind,
  };
}

function normalizeName(name: string): string {
  const normalized = name.trim();
  if (normalized.length === 0 || normalized.length > 80) {
    throw new Error("Template name must be between 1 and 80 characters");
  }
  return normalized;
}

function normalizeExerciseIds(exerciseIds: string[]): string[] {
  const uniqueIds = [...new Set(exerciseIds)];
  if (uniqueIds.length === 0) {
    throw new Error("A template needs at least one exercise");
  }
  return uniqueIds;
}

export class TemplateRepository {
  constructor(private readonly db: DatabaseClient) {}

  async listTemplates(): Promise<WorkoutTemplate[]> {
    const rows = await this.db.getAllAsync<TemplateRow>(
      `${TEMPLATE_FIELDS}
       WHERE deleted_at IS NULL
       ORDER BY CASE source WHEN 'system' THEN 0 ELSE 1 END,
                name COLLATE NOCASE ASC, id ASC`,
      [],
    );
    return Promise.all(rows.map((row) => this.loadTemplate(row)));
  }

  async getTemplate(id: string): Promise<WorkoutTemplate | null> {
    const row = await this.db.getFirstAsync<TemplateRow>(
      `${TEMPLATE_FIELDS}
       WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return row ? this.loadTemplate(row) : null;
  }

  async createTemplate(input: CreateWorkoutTemplateInput): Promise<WorkoutTemplate> {
    const name = normalizeName(input.name);
    const exerciseIds = normalizeExerciseIds(input.exerciseIds);
    await this.assertActiveExercises(exerciseIds);
    const now = new Date().toISOString();

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO workout_templates
          (id, name, source, created_at, updated_at, deleted_at)
         VALUES (?, ?, 'custom', ?, ?, NULL)`,
        [input.id, name, now, now],
      );
      await this.insertExercises(input.id, exerciseIds, now);
    });

    const template = await this.getTemplate(input.id);
    if (!template) throw new Error("Template was not available after creation");
    return template;
  }

  async updateTemplate(input: UpdateWorkoutTemplateInput): Promise<WorkoutTemplate> {
    const name = normalizeName(input.name);
    const exerciseIds = normalizeExerciseIds(input.exerciseIds);
    await this.assertActiveExercises(exerciseIds);

    const existing = await this.db.getFirstAsync<TemplateRow>(
      `${TEMPLATE_FIELDS}
       WHERE id = ? AND deleted_at IS NULL`,
      [input.id],
    );
    if (!existing || existing.source !== "custom") {
      throw new Error("Only a custom template can be updated");
    }

    const now = new Date().toISOString();
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `UPDATE workout_templates
         SET name = ?, updated_at = ?
         WHERE id = ? AND source = 'custom' AND deleted_at IS NULL`,
        [name, now, input.id],
      );
      await this.db.runAsync(
        "DELETE FROM template_exercises WHERE template_id = ?",
        [input.id],
      );
      await this.insertExercises(input.id, exerciseIds, now);
    });

    const template = await this.getTemplate(input.id);
    if (!template) throw new Error("Template was not available after updating");
    return template;
  }

  async deleteTemplate(id: string): Promise<void> {
    const now = new Date().toISOString();
    const result = await this.db.runAsync(
      `UPDATE workout_templates
       SET deleted_at = ?, updated_at = ?
       WHERE id = ? AND source = 'custom' AND deleted_at IS NULL`,
      [now, now, id],
    );
    if (result.changes !== 1) {
      throw new Error("Only an active custom template can be deleted");
    }
  }

  private async loadTemplate(row: TemplateRow): Promise<WorkoutTemplate> {
    const exerciseRows = await this.db.getAllAsync<TemplateExerciseRow>(
      `${TEMPLATE_EXERCISE_FIELDS}
       WHERE te.template_id = ?
       ORDER BY te.position ASC, te.exercise_id ASC`,
      [row.id],
    );
    return mapTemplate(row, exerciseRows.map(mapExercise));
  }

  private async assertActiveExercises(exerciseIds: string[]): Promise<void> {
    const placeholders = exerciseIds.map(() => "?").join(", ");
    const rows = await this.db.getAllAsync<{ id: string }>(
      `SELECT id FROM exercises
       WHERE is_active = 1 AND id IN (${placeholders})`,
      exerciseIds,
    );
    if (rows.length !== exerciseIds.length) {
      throw new Error("A template can only contain active exercises");
    }
  }

  private async insertExercises(
    templateId: string,
    exerciseIds: string[],
    createdAt: string,
  ): Promise<void> {
    for (const [position, exerciseId] of exerciseIds.entries()) {
      await this.db.runAsync(
        `INSERT INTO template_exercises
          (template_id, exercise_id, position, created_at)
         VALUES (?, ?, ?, ?)`,
        [templateId, exerciseId, position, createdAt],
      );
    }
  }
}
