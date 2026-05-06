/**
 * Sea Battle server — Express app setup.
 *
 * The `app` is exported so it can be imported by tests (via supertest) without
 * starting an actual HTTP server.  The server is only started when this module
 * is run directly (i.e. `node dist/index.js`).
 */
import express from "express";
import { AccountManager } from "./accountManager.js";
import { SessionService } from "./sessionService.js";
import { MatchmakingService } from "./matchmakingService.js";
export declare function createApp(accountManager: AccountManager, sessionService: SessionService, matchmakingService: MatchmakingService, jwtSecret?: string): express.Application;
export declare function getDefaultApp(): Promise<express.Application>;
//# sourceMappingURL=index.d.ts.map