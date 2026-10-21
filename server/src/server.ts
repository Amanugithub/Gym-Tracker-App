import express from "express";
import cors from "cors";
import type { Server } from "node:http";

import { requireAuth } from "./auth/auth-middleware";
import { createDatabase } from "./db/client";
import { loadConfig } from "./config";
import { createSyncRouter } from "./routes/sync-routes";

export function createApp(
  database: ReturnType<typeof createDatabase>,
  developmentUserId: string | null,
  googleClientIds: string[],
  options: {
    nodeEnv?: string;
    corsOrigins?: string[];
  } = {},
) {
  const app = express();
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const corsOrigins = options.corsOrigins ?? [];

  app.disable("x-powered-by");
  app.use(
    cors({
      origin(origin, callback) {
        // React Native requests normally have no Origin header. Browser
        // requests are open in development unless an allowlist is supplied.
        if (!origin || (nodeEnv !== "production" && corsOrigins.length === 0)) {
          callback(null, true);
          return;
        }
        callback(
          corsOrigins.includes(origin) ? null : new Error("CORS origin not allowed"),
          corsOrigins.includes(origin),
        );
      },
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", async (_request, response) => {
    try {
      await database.query("SELECT 1");
      response.json({ ok: true, database: "ok" });
    } catch {
      response.status(503).json({ ok: false, database: "unavailable" });
    }
  });

  app.use(
    "/v1/sync",
    requireAuth(database, developmentUserId, googleClientIds, nodeEnv),
    createSyncRouter(database),
  );

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (
      error instanceof SyntaxError &&
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      error.type === "entity.parse.failed"
    ) {
      response.status(400).json({ error: "Request body must be valid JSON" });
      return;
    }
    if (error instanceof Error && error.name === "ZodError") {
      response.status(400).json({ error: "Invalid sync payload", details: error.message });
      return;
    }
    if (error instanceof Error && error.message === "CORS origin not allowed") {
      response.status(403).json({ error: "Origin is not allowed" });
      return;
    }
    console.error(error);
    response.status(500).json({ error: "Internal server error" });
  });

  return app;
}

function listen(app: express.Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.once("error", reject);
  });
}

async function startServer(): Promise<void> {
  const config = loadConfig();
  const database = createDatabase(config.databaseUrl);

  try {
    await database.query("SELECT 1");
    const app = createApp(database, config.developmentAuthUserId, config.googleClientIds, {
      nodeEnv: config.nodeEnv,
      corsOrigins: config.corsOrigins,
    });
    const server = await listen(app, config.port);
    console.log(`Gym Tracker API listening on http://localhost:${config.port}`);

    let shuttingDown = false;
    const shutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`Received ${signal}; shutting down.`);
      try {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
        await database.end();
      } catch (error) {
        console.error("Graceful shutdown failed", error);
        process.exitCode = 1;
      }
    };

    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (error) {
    console.error("Gym Tracker API could not start", error);
    await database.end();
    process.exitCode = 1;
  }
}

void startServer();
