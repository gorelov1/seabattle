/**
 * Production entry point — creates the HTTP server, attaches the Express app
 * and the WsGateway, then starts listening.
 *
 * This file is separate from index.ts so that tests can import createApp
 * without triggering a real server start or DB connection.
 */

import * as http from "http";
import { getDefaultApp } from "./index.js";
import { WsGateway } from "./wsGateway.js";
import { GameService } from "./gameService.js";
import { createDefaultSessionService } from "./sessionService.js";

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);
const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret-change-in-production";

async function main(): Promise<void> {
  const app = await getDefaultApp();
  const sessionService = await createDefaultSessionService();
  const gameService = new GameService();

  const server = http.createServer(app);

  // Attach WebSocket gateway to the same HTTP server
  new WsGateway(server, gameService, sessionService, JWT_SECRET);

  server.listen(PORT, () => {
    console.log(`Sea Battle server listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
