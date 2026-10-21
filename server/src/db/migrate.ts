import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { createDatabase } from "./client";
import { loadConfig } from "../config";

const config = loadConfig();
const database = createDatabase(config.databaseUrl);
const migrationDirectory = path.resolve(process.cwd(), "db/migrations");

async function main(): Promise<void> {
  try {
    const migrationFiles = (await readdir(migrationDirectory))
      .filter((file) => /^\d+_.*\.sql$/.test(file))
      .sort();

    for (const migrationFile of migrationFiles) {
      await database.query(await readFile(path.join(migrationDirectory, migrationFile), "utf8"));
    }
    console.log("Database migration complete.");
  } finally {
    await database.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
