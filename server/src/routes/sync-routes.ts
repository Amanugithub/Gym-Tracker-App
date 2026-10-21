import { Router } from "express";
import type { Pool } from "pg";

import type { AuthenticatedRequest } from "../auth/auth-middleware";
import { syncPushSchema } from "../sync/contracts";
import { pullSync, pushSync } from "../sync/sync-service";

export function createSyncRouter(database: Pool): Router {
  const router = Router();

  router.post("/push", async (request, response, next) => {
    try {
      const payload = syncPushSchema.parse(request.body);
      const userId = (request as AuthenticatedRequest).user.id;
      response.json(await pushSync(database, userId, payload));
    } catch (error) {
      next(error);
    }
  });

  router.get("/pull", async (request, response, next) => {
    try {
      const since = typeof request.query.since === "string" ? request.query.since : null;
      const userId = (request as AuthenticatedRequest).user.id;
      response.json(await pullSync(database, userId, since));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
