import { OAuth2Client } from "google-auth-library";
import type { Pool } from "pg";
import type { NextFunction, Request, Response } from "express";

export type AuthenticatedRequest = Request & {
  user: {
    id: string;
    googleSubject: string | null;
  };
};

/**
 * Development-only identity bridge. Production must replace this with a
 * verifier for Google ID tokens before enabling the API publicly.
 */
export function requireAuth(
  database: Pool,
  developmentUserId: string | null,
  googleClientIds: string[],
  nodeEnv: string = process.env.NODE_ENV ?? "development",
) {
  const googleClient = new OAuth2Client();

  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const authRequest = request as AuthenticatedRequest;
    const bearer = request.header("authorization")?.replace(/^Bearer\s+/i, "");

    if (!bearer && developmentUserId && nodeEnv !== "production") {
      authRequest.user = { id: developmentUserId, googleSubject: null };
      next();
      return;
    }

    if (!bearer) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }

    if (googleClientIds.length === 0) {
      response.status(503).json({ error: "Google authentication is not configured" });
      return;
    }

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: bearer,
        audience: googleClientIds,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub) {
        response.status(401).json({ error: "Google token has no subject" });
        return;
      }

      await database.query(
        `INSERT INTO users (id, google_subject, email, display_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET
           google_subject = EXCLUDED.google_subject,
           email = EXCLUDED.email,
           display_name = EXCLUDED.display_name,
           updated_at = now()`,
        [payload.sub, payload.sub, payload.email ?? null, payload.name ?? null],
      );

      authRequest.user = { id: payload.sub, googleSubject: payload.sub };
      next();
    } catch (error) {
      console.error("Google token verification failed", error);
      response.status(401).json({ error: "Invalid Google token" });
    }
  };
}
