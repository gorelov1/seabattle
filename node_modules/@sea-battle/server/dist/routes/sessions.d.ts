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
import { SessionService } from "../sessionService.js";
export declare function createSessionsRouter(sessionService: SessionService, jwtSecret: string): Router;
//# sourceMappingURL=sessions.d.ts.map