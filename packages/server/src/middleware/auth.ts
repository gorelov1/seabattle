/**
 * JWT authentication middleware.
 *
 * Reads the `Authorization: Bearer <token>` header, verifies the JWT using
 * the same secret as AccountManager, and attaches `{ accountId, tokenId }`
 * to `req.user`.  Returns 401 if the token is missing or invalid.
 */

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// ---------------------------------------------------------------------------
// Augment Express Request to carry the decoded token payload
// ---------------------------------------------------------------------------

export interface AuthPayload {
  accountId: string;
  tokenId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

// ---------------------------------------------------------------------------
// Middleware factory — accepts the JWT secret so it can be injected in tests
// ---------------------------------------------------------------------------

export function createAuthMiddleware(jwtSecret: string) {
  return function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or malformed Authorization header" });
      return;
    }

    const token = authHeader.slice("Bearer ".length);

    try {
      const payload = jwt.verify(token, jwtSecret) as Record<string, unknown>;

      const accountId = payload["accountId"];
      const tokenId = payload["tokenId"];

      if (typeof accountId !== "string" || typeof tokenId !== "string") {
        res.status(401).json({ error: "Invalid token payload" });
        return;
      }

      req.user = { accountId, tokenId };
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}
