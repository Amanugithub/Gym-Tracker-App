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
export function requireAuth(developmentUserId: string | null) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const authRequest = request as AuthenticatedRequest;
    const bearer = request.header("authorization")?.replace(/^Bearer\s+/i, "");

    if (developmentUserId && process.env.NODE_ENV !== "production") {
      authRequest.user = { id: developmentUserId, googleSubject: null };
      next();
      return;
    }

    if (!bearer) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }

    response.status(501).json({
      error: "Google token verification is not configured yet",
    });
  };
}
