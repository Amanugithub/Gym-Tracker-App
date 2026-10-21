import { readFile } from "node:fs/promises";
import path from "node:path";

import { createDatabase } from "./client";
import { loadConfig } from "../config";

const config = loadConfig();
const database = createDatabase(config.databaseUrl);
const migrationPath = path.resolve(process.cwd(), "db/migrations/001_initial.sql");

async function main(): Promise<void> {
  try {
    await database.query(await readFile(migrationPath, "utf8"));
    console.log("Database migration complete.");
  } finally {
    await database.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
