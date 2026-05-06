/**
 * Express router for matchmaking endpoints.
 *
 * Routes:
 *   POST   /matchmaking/enqueue  → MatchmakingService.enqueue  (auth required)
 *   DELETE /matchmaking/enqueue  → MatchmakingService.dequeue  (auth required)
 *
 * Requirements: 14.1, 14.3, 14.4
 */
import { Router } from "express";
import { createAuthMiddleware } from "../middleware/auth.js";
// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------
export function createMatchmakingRouter(matchmakingService, jwtSecret) {
    const router = Router();
    const requireAuth = createAuthMiddleware(jwtSecret);
    // -------------------------------------------------------------------------
    // POST /matchmaking/enqueue  (auth required)
    // Adds the authenticated player to the matchmaking queue.
    // Returns { status: 'queued', queuedAt } with status 200.
    // -------------------------------------------------------------------------
    router.post("/enqueue", requireAuth, (req, res) => {
        const playerId = req.user.accountId;
        const ticket = matchmakingService.enqueue(playerId);
        res.status(200).json({ status: "queued", queuedAt: ticket.queuedAt });
    });
    // -------------------------------------------------------------------------
    // DELETE /matchmaking/enqueue  (auth required)
    // Removes the authenticated player from the matchmaking queue.
    // Returns { status: 'dequeued' } with status 200.
    // -------------------------------------------------------------------------
    router.delete("/enqueue", requireAuth, (req, res) => {
        const playerId = req.user.accountId;
        matchmakingService.dequeue(playerId);
        res.status(200).json({ status: "dequeued" });
    });
    return router;
}
//# sourceMappingURL=matchmaking.js.map