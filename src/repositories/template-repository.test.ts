import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../db/types";
import { TemplateRepository } from "./template-repository";

function fakeDatabase(): DatabaseClient {
  return {
    execAsync: vi.fn(),
    runAsync: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
    getFirstAsync: vi.fn(),
    getAllAsync: vi.fn(),
    withTransactionAsync: vi.fn(async (task) => task()),
  };
}

const templateRow = {
  id: "system-push-day",
  name: "Push Day",
  source: "system" as const,
  created_at: "2026-10-21T10:00:00.000Z",
  updated_at: "2026-10-21T10:00:00.000Z",
  deleted_at: null,
};

const exerciseRow = {
  exercise_id: "barbell-bench-press",
  position: 0,
  name: "Barbell Bench Press",
  equipment: "barbell" as const,
  kind: "weighted" as const,
};

describe("TemplateRepository", () => {
  it("loads active templates with ordered exercise details", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getAllAsync)
      .mockResolvedValueOnce([templateRow])
      .mockResolvedValueOnce([exerciseRow]);

    const templates = await new TemplateRepository(db).listTemplates();

    expect(templates).toEqual([
      {
        id: "system-push-day",
        name: "Push Day",
        source: "system",
        createdAt: "2026-10-21T10:00:00.000Z",
        updatedAt: "2026-10-21T10:00:00.000Z",
        deletedAt: null,
        exercises: [
          {
            exerciseId: "barbell-bench-press",
            position: 0,
            name: "Barbell Bench Press",
            equipment: "barbell",
            kind: "weighted",
          },
        ],
      },
    ]);
  });

  it("creates a custom template and preserves exercise order", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getAllAsync)
      .mockResolvedValueOnce([
        { id: "barbell-bench-press" },
        { id: "cable-triceps-pushdown" },
      ])
      .mockResolvedValueOnce([
        { ...exerciseRow },
        {
          ...exerciseRow,
          exercise_id: "cable-triceps-pushdown",
          position: 1,
          name: "Cable Triceps Pushdown",
          equipment: "cable",
        },
      ]);
    vi.mocked(db.getFirstAsync).mockResolvedValue({
      ...templateRow,
      id: "custom-upper",
      name: "Upper Focus",
      source: "custom",
    });

    const template = await new TemplateRepository(db).createTemplate({
      id: "custom-upper",
      name: "  Upper Focus  ",
      exerciseIds: ["barbell-bench-press", "cable-triceps-pushdown"],
    });

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("source, created_at, updated_at"),
      ["custom-upper", "Upper Focus", expect.any(String), expect.any(String)],
    );
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR IGNORE INTO sync_outbox"),
      ["template", "custom-upper", expect.any(String)],
    );
    expect(template).toMatchObject({ id: "custom-upper", name: "Upper Focus", source: "custom" });
  });

  it("does not allow editing or deleting system templates", async () => {
    const db = fakeDatabase();
    vi.mocked(db.getFirstAsync).mockResolvedValue(templateRow);
    vi.mocked(db.getAllAsync).mockResolvedValue([{ id: "barbell-bench-press" }]);

    await expect(
      new TemplateRepository(db).updateTemplate({
        id: "system-push-day",
        name: "Changed",
        exerciseIds: ["barbell-bench-press"],
      }),
    ).rejects.toThrow("Only a custom template can be updated");

    vi.mocked(db.runAsync).mockResolvedValue({ changes: 0, lastInsertRowId: 0 });
    await expect(new TemplateRepository(db).deleteTemplate("system-push-day")).rejects.toThrow(
      "Only an active custom template can be deleted",
    );
  });
});
