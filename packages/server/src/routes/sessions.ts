/**
 * Express router for session setup endpoints.
 *
 * Routes:
 *   POST /sessions       → SessionService.createSession  (auth required)
 *   POST /sessions/join  → SessionService.joinSession    (auth required)
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */

import { Router } from "express";
import type { Request, Response } from "express";

import { SessionService } from "../sessionService.js";
import { createAuthMiddleware } from "../middleware/auth.js";

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createSessionsRouter(
  sessionService: SessionService,
  jwtSecret: string
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(jwtSecret);

  // -------------------------------------------------------------------------
  // POST /sessions  (auth required)
  // Creates a new invite-based session for the authenticated player.
  // Returns { sessionId, inviteCode } with status 201.
  // -------------------------------------------------------------------------
  router.post("/", requireAuth, (req: Request, res: Response) => {
    const playerA = req.user!.accountId;
    const session = sessionService.createSession(playerA);
    res.status(201).json({
      sessionId: session.id,
      inviteCode: session.inviteCode,
    });
  });

  // -------------------------------------------------------------------------
  // POST /sessions/join  (auth required)
  // Joins an existing session by invite code.
  // Returns { sessionId } with status 200.
  // 404 on InvalidInviteCode, 409 on SessionFull.
  // -------------------------------------------------------------------------
  router.post("/join", requireAuth, (req: Request, res: Response) => {
    const playerB = req.user!.accountId;
    const { inviteCode } = req.body as Record<string, unknown>;

    if (typeof inviteCode !== "string" || inviteCode.trim() === "") {
      res.status(400).json({ error: "inviteCode is required" });
      return;
    }

    const result = sessionService.joinSession(inviteCode.trim(), playerB);

    if (!result.ok) {
      if (result.error === "InvalidInviteCode") {
        res.status(404).json({ error: result.error });
      } else if (result.error === "SessionFull") {
        res.status(409).json({ error: result.error });
      } else {
        res.status(400).json({ error: result.error });
      }
      return;
    }

    res.status(200).json({ sessionId: result.value.id });
  });

  return router;
}
