/**
 * Sea Battle server — Express app setup.
 *
 * The `app` is exported so it can be imported by tests (via supertest) without
 * starting an actual HTTP server.  The server is only started when this module
 * is run directly (i.e. `node dist/index.js`).
 */

import express from "express";
import cors from "cors";
import { createAccountsRouter } from "./routes/accounts.js";
import { createSessionsRouter } from "./routes/sessions.js";
import { createMatchmakingRouter } from "./routes/matchmaking.js";
import { AccountManager } from "./accountManager.js";
import { SessionService } from "./sessionService.js";
import { MatchmakingService } from "./matchmakingService.js";

// ---------------------------------------------------------------------------
// JWT secret — read from environment; fall back to a dev-only default
// ---------------------------------------------------------------------------

const JWT_SECRET =
  process.env["JWT_SECRET"] ?? "dev-secret-change-in-production";

// ---------------------------------------------------------------------------
// Build the Express app
// ---------------------------------------------------------------------------

export function createApp(
  accountManager: AccountManager,
  sessionService: SessionService,
  matchmakingService: MatchmakingService,
  jwtSecret: string = JWT_SECRET
): express.Application {
  const app = express();

  // Allow requests from any origin (configure ALLOWED_ORIGIN env var in production)
  const allowedOrigin = process.env["ALLOWED_ORIGIN"] ?? "*";
  app.use(cors({ origin: allowedOrigin, credentials: allowedOrigin !== "*" }));

  app.use(express.json());

  // Mount account routes at /accounts
  app.use("/accounts", createAccountsRouter(accountManager, jwtSecret));

  // Mount session routes at /sessions
  app.use("/sessions", createSessionsRouter(sessionService, jwtSecret));

  // Mount matchmaking routes at /matchmaking
  app.use("/matchmaking", createMatchmakingRouter(matchmakingService, jwtSecret));

  return app;
}

// ---------------------------------------------------------------------------
// Default app instance backed by the real database
// (lazy-loaded so tests that import createApp don't trigger DB migrations)
// ---------------------------------------------------------------------------

let _defaultApp: express.Application | undefined;

export async function getDefaultApp(): Promise<express.Application> {
  if (_defaultApp !== undefined) return _defaultApp;

  const { createDefaultAccountManager } = await import("./accountManager.js");
  const { createDefaultSessionService } = await import("./sessionService.js");
  const { createDefaultMatchmakingService } = await import("./matchmakingService.js");

  const accountManager = await createDefaultAccountManager();
  const sessionService = await createDefaultSessionService();
  const matchmakingService = await createDefaultMatchmakingService();

  _defaultApp = createApp(accountManager, sessionService, matchmakingService, JWT_SECRET);
  return _defaultApp;
}

// ---------------------------------------------------------------------------
// Start the server only when run directly
// ---------------------------------------------------------------------------

const isMain =
  process.argv[1] !== undefined &&
  new URL(import.meta.url).pathname.endsWith(process.argv[1].replace(/\\/g, "/"));

if (isMain) {
  const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

  getDefaultApp().then((app) => {
    app.listen(PORT, () => {
      console.log(`Sea Battle server listening on port ${PORT}`);
    });
  });
}
