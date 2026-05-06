/**
 * WsGateway — WebSocket gateway for Sea Battle game sessions.
 *
 * Manages WebSocket connections, validates JWTs, routes client messages to
 * GameService, and broadcasts GameEvents to connected clients.
 *
 * Requirements: 13.5, 13.6, 13.7, 14.5, 14.7
 */

import * as http from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { parse as parseCoord } from "@sea-battle/domain";
import type { ShipPlacement } from "@sea-battle/domain";
import { deserializeBoard, type GameService } from "./gameService.js";
import type { SessionService } from "./sessionService.js";

// ---------------------------------------------------------------------------
// GameEvent union — server → client messages
// ---------------------------------------------------------------------------

export type GameEvent =
  | { type: "SessionRestored"; boardA: string; boardB: string; turnState: string; status: string }
  | { type: "PlacementAck"; playerId: string; boardReady: boolean }
  | { type: "MatchStarted"; firstPlayer: string }
  | { type: "ShotResult"; shooter: string; coord: string; outcome: string; autoMarked: string[]; winner?: string }
  | { type: "TurnChanged"; activePlayer: string }
  | { type: "MatchEnded"; winner: string }
  | { type: "OpponentDisconnected"; timeout: number }
  | { type: "OpponentReconnected" }
  | { type: "pong" };

// ---------------------------------------------------------------------------
// JWT payload shape
// ---------------------------------------------------------------------------

interface JwtPayload {
  accountId: string;
  tokenId: string;
}

// ---------------------------------------------------------------------------
// Disconnection timeout (seconds)
// ---------------------------------------------------------------------------

const DISCONNECT_TIMEOUT_SECONDS = 60;

// ---------------------------------------------------------------------------
// WsGateway
// ---------------------------------------------------------------------------

export class WsGateway {
  private readonly wss: WebSocketServer;
  private readonly gameService: GameService;
  private readonly sessionService: SessionService;
  private readonly jwtSecret: string;
  private readonly disconnectTimeoutMs: number;

  /**
   * Map from sessionId → Map<playerId, WebSocket>
   * Tracks all currently connected clients per session.
   */
  private readonly clients: Map<string, Map<string, WebSocket>> = new Map();

  /**
   * Map from sessionId → Map<playerId, NodeJS.Timeout>
   * Tracks pending disconnection timers.
   */
  private readonly disconnectTimers: Map<string, Map<string, ReturnType<typeof setTimeout>>> = new Map();

  constructor(
    server: http.Server,
    gameService: GameService,
    sessionService: SessionService,
    jwtSecret: string,
    disconnectTimeoutMs: number = DISCONNECT_TIMEOUT_SECONDS * 1000
  ) {
    this.gameService = gameService;
    this.sessionService = sessionService;
    this.jwtSecret = jwtSecret;
    this.disconnectTimeoutMs = disconnectTimeoutMs;

    // Create WebSocket server attached to the HTTP server
    this.wss = new WebSocketServer({ server });

    this.wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
      this.handleConnection(ws, req);
    });
  }

  // ---------------------------------------------------------------------------
  // Connection handling
  // ---------------------------------------------------------------------------

  private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const url = req.url ?? "";

    // Parse sessionId from path: /sessions/:sessionId
    const pathMatch = /^\/sessions\/([^/?]+)/.exec(url);
    if (!pathMatch) {
      ws.close(4004, "Session not found");
      return;
    }
    const sessionId = pathMatch[1];

    // Parse token from query string: ?token=<jwt>
    const queryMatch = /[?&]token=([^&]+)/.exec(url);
    const token = queryMatch ? decodeURIComponent(queryMatch[1]) : null;

    // Validate JWT
    if (!token) {
      ws.close(4001, "Unauthorized");
      return;
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
    } catch {
      ws.close(4001, "Unauthorized");
      return;
    }

    const playerId = payload.accountId;

    // Validate session exists
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      ws.close(4004, "Session not found");
      return;
    }

    // Register client
    if (!this.clients.has(sessionId)) {
      this.clients.set(sessionId, new Map());
    }
    this.clients.get(sessionId)!.set(playerId, ws);

    // Cancel any pending disconnect timer for this player (reconnection)
    const sessionTimers = this.disconnectTimers.get(sessionId);
    if (sessionTimers?.has(playerId)) {
      clearTimeout(sessionTimers.get(playerId)!);
      sessionTimers.delete(playerId);

      // Notify the other client that the opponent reconnected
      this.broadcastToOthers(sessionId, playerId, { type: "OpponentReconnected" });
    }

    // Send SessionRestored to the connecting client
    const freshSession = this.sessionService.getSession(sessionId)!;
    this.send(ws, {
      type: "SessionRestored",
      boardA: freshSession.boardA,
      boardB: freshSession.boardB,
      turnState: freshSession.turnState,
      status: freshSession.status,
    });

    // Handle incoming messages
    ws.on("message", (data: Buffer | string) => {
      this.handleMessage(ws, sessionId, playerId, data.toString());
    });

    // Handle disconnection
    ws.on("close", () => {
      this.handleDisconnect(sessionId, playerId);
    });
  }

  // ---------------------------------------------------------------------------
  // Message handling
  // ---------------------------------------------------------------------------

  private handleMessage(
    ws: WebSocket,
    sessionId: string,
    playerId: string,
    raw: string
  ): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // Ignore malformed messages
      return;
    }

    const type = msg["type"];

    if (type === "ping") {
      this.send(ws, { type: "pong" });
      return;
    }

    if (type === "place_ship") {
      this.handlePlaceShip(sessionId, playerId, msg["placement"] as ShipPlacement);
      return;
    }

    if (type === "fire_shot") {
      this.handleFireShot(sessionId, playerId, msg["coord"] as string);
      return;
    }
  }

  // ---------------------------------------------------------------------------
  // place_ship handler
  // ---------------------------------------------------------------------------

  private handlePlaceShip(
    sessionId: string,
    playerId: string,
    placement: ShipPlacement
  ): void {
    const session = this.sessionService.getSession(sessionId);
    if (!session) return;

    const result = this.gameService.handlePlacement(session, playerId, placement);
    if (!result.ok) {
      // Send error back to the placing player only
      const playerWs = this.clients.get(sessionId)?.get(playerId);
      if (playerWs) {
        this.send(playerWs, { type: "PlacementAck", playerId, boardReady: false });
      }
      return;
    }

    const updatedSession = result.value;
    this.sessionService.updateSession(updatedSession);

    // Determine if this player's fleet is now ready
    const playerBoardJson =
      session.playerA === playerId ? updatedSession.boardA : updatedSession.boardB;
    const playerBoard = deserializeBoard(playerBoardJson);
    const boardReady = playerBoard.ready;

    // Send PlacementAck to the placing player
    const playerWs = this.clients.get(sessionId)?.get(playerId);
    if (playerWs) {
      this.send(playerWs, { type: "PlacementAck", playerId, boardReady });
    }

    // If both fleets are ready, broadcast MatchStarted to both clients
    if (updatedSession.status === "Shooting") {
      const turnState = JSON.parse(updatedSession.turnState) as { activePlayer: string };
      this.broadcastToSession(sessionId, {
        type: "MatchStarted",
        firstPlayer: turnState.activePlayer,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // fire_shot handler
  // ---------------------------------------------------------------------------

  private handleFireShot(
    sessionId: string,
    playerId: string,
    coordStr: string
  ): void {
    const session = this.sessionService.getSession(sessionId);
    if (!session) return;

    // Parse coordinate
    const coordResult = parseCoord(coordStr);
    if (!coordResult.ok) return;

    const result = this.gameService.handleShot(session, playerId, coordResult.value);
    if (!result.ok) return;

    const { session: updatedSession, event } = result.value;
    this.sessionService.updateSession(updatedSession);

    // Broadcast ShotResult to both clients
    this.broadcastToSession(sessionId, {
      type: "ShotResult",
      shooter: event.shooter,
      coord: event.coord,
      outcome: event.outcome,
      autoMarked: event.autoMarked,
      winner: event.winner,
    });

    // If there's a winner, broadcast MatchEnded
    if (event.winner !== undefined) {
      this.broadcastToSession(sessionId, {
        type: "MatchEnded",
        winner: event.winner,
      });
    } else {
      // Broadcast TurnChanged
      const newTurnState = JSON.parse(updatedSession.turnState) as { activePlayer: string };
      this.broadcastToSession(sessionId, {
        type: "TurnChanged",
        activePlayer: newTurnState.activePlayer,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Disconnection handling
  // ---------------------------------------------------------------------------

  private handleDisconnect(sessionId: string, playerId: string): void {
    // Remove from active clients
    this.clients.get(sessionId)?.delete(playerId);

    // Record disconnect timestamp in session
    const session = this.sessionService.getSession(sessionId);
    if (!session) return;

    const updatedSession = {
      ...session,
      disconnected: {
        ...session.disconnected,
        [playerId]: new Date().toISOString(),
      },
    };
    this.sessionService.updateSession(updatedSession);

    // Notify remaining client
    this.broadcastToOthers(sessionId, playerId, {
      type: "OpponentDisconnected",
      timeout: DISCONNECT_TIMEOUT_SECONDS,
    });

    // Start reconnection timer
    if (!this.disconnectTimers.has(sessionId)) {
      this.disconnectTimers.set(sessionId, new Map());
    }

    const timer = setTimeout(() => {
      this.handleDisconnectTimeout(sessionId, playerId);
    }, this.disconnectTimeoutMs);

    this.disconnectTimers.get(sessionId)!.set(playerId, timer);
  }

  private handleDisconnectTimeout(sessionId: string, playerId: string): void {
    // Clean up timer
    this.disconnectTimers.get(sessionId)?.delete(playerId);

    // Determine the remaining (winning) player
    const session = this.sessionService.getSession(sessionId);
    if (!session) return;

    const remainingPlayer =
      session.playerA === playerId ? session.playerB : session.playerA;

    if (!remainingPlayer) return;

    // End the match
    const finishedSession = {
      ...session,
      status: "Finished" as const,
    };
    this.sessionService.updateSession(finishedSession);

    // Notify remaining client
    this.broadcastToSession(sessionId, {
      type: "MatchEnded",
      winner: remainingPlayer,
    });
  }

  // ---------------------------------------------------------------------------
  // Broadcast helpers
  // ---------------------------------------------------------------------------

  /** Sends a GameEvent to all clients in a session. */
  private broadcastToSession(sessionId: string, event: GameEvent): void {
    const sessionClients = this.clients.get(sessionId);
    if (!sessionClients) return;

    const payload = JSON.stringify(event);
    for (const ws of sessionClients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  /** Sends a GameEvent to all clients in a session except the specified player. */
  private broadcastToOthers(
    sessionId: string,
    excludePlayerId: string,
    event: GameEvent
  ): void {
    const sessionClients = this.clients.get(sessionId);
    if (!sessionClients) return;

    const payload = JSON.stringify(event);
    for (const [pid, ws] of sessionClients.entries()) {
      if (pid !== excludePlayerId && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  /** Sends a GameEvent to a single WebSocket. */
  private send(ws: WebSocket, event: GameEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }
}
