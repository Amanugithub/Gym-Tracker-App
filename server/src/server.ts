import express from "express";
import cors from "cors";

import { requireAuth } from "./auth/auth-middleware";
import { createDatabase } from "./db/client";
import { loadConfig } from "./config";
import { createSyncRouter } from "./routes/sync-routes";

export function createApp(
  database: ReturnType<typeof createDatabase>,
  developmentUserId: string | null,
) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.use(
    "/v1/sync",
    requireAuth(developmentUserId),
    createSyncRouter(database),
  );

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof Error && error.name === "ZodError") {
      response.status(400).json({ error: "Invalid sync payload", details: error.message });
      return;
    }
    console.error(error);
    response.status(500).json({ error: "Internal server error" });
  });

  return app;
}

const config = loadConfig();
const database = createDatabase(config.databaseUrl);
const app = createApp(database, config.developmentAuthUserId);

app.listen(config.port, () => {
  console.log(`Gym Tracker API listening on http://localhost:${config.port}`);
});
