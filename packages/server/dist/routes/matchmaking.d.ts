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
import { MatchmakingService } from "../matchmakingService.js";
export declare function createMatchmakingRouter(matchmakingService: MatchmakingService, jwtSecret: string): Router;
//# sourceMappingURL=matchmaking.d.ts.map