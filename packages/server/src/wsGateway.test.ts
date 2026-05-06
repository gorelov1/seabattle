/**
 * Integration tests for WsGateway — WebSocket session lifecycle.
 *
 * Tests cover:
 *   - Two clients connecting, completing fleet placement, firing shots
 *   - ShotResult events broadcast to both clients
 *   - OpponentDisconnected event sent when one client disconnects
 *   - SessionRestored event sent on reconnect within timeout
 *   - MatchEnded event sent when reconnect timeout expires
 *
 * Uses in-memory stores (no SQLite), real HTTP server, and the `ws` package
 * for WebSocket clients. Fake timers (vi.useFakeTimers) control the 60-second
 * timeout without actually waiting.
 *
 * Requirements: 13.5, 13.6, 14.5, 14.6, 14.7
 */

import * as http from "http";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import {
  Column,
  Orientation,
  ShipType,
  TurnPhase,
  createEmptyBoard,
  placeShip,
  type Board,
  type Coordinate,
  type Row,
} from "@sea-battle/domain";
import { WsGateway, type GameEvent } from "./wsGateway.js";
import { GameService, serializeBoard } from "./gameService.js";
import { SessionService, type SessionQueries, type SessionData } from "./sessionService.js";
import type { SessionRow } from "./db.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const JWT_SECRET = "test-secret-for-integration-tests";
const SHORT_DISCONNECT_TIMEOUT_MS = 50; // Short timeout for testing

// ---------------------------------------------------------------------------
// In-memory SessionQueries
// ---------------------------------------------------------------------------

function createInMemorySessionQueries(): SessionQueries & {
  _store: Map<string, SessionRow>;
} {
  const store = new Map<string, SessionRow>();
  return {
    _store: store,
    insert(row: SessionRow) {
      store.set(row.id, { ...row });
    },
    findById(id: string): SessionRow | undefined {
      const row = store.get(id);
      return row ? { ...row } : undefined;
    },
    findByInviteCode(code: string): SessionRow | undefined {
      for (const row of store.values()) {
        if (row.invite_code === code) return { ...row };
      }
      return undefined;
    },
    update(row: SessionRow) {
      if (store.has(row.id)) {
        store.set(row.id, { ...row });
      }
    },
    delete(id: string) {
      store.delete(id);
    },
  };
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

function makeToken(playerId: string): string {
  return jwt.sign({ accountId: playerId, tokenId: uuidv4() }, JWT_SECRET);
}

// ---------------------------------------------------------------------------
// Board building helpers
// ---------------------------------------------------------------------------

function coord(col: Column, row: Row): Coordinate {
  return { col, row };
}

/**
 * Builds a fully-placed board with 10 ships in a deterministic layout.
 *
 * Layout:
 *   Row 1:  Battleship  A1-D1 (horizontal)
 *   Row 3:  Cruiser     A3-C3 (horizontal)
 *   Row 3:  Cruiser     E3-G3 (horizontal)
 *   Row 5:  Destroyer   A5-B5 (horizontal)
 *   Row 5:  Destroyer   D5-E5 (horizontal)
 *   Row 5:  Destroyer   G5-H5 (horizontal)
 *   Row 7:  PatrolBoat  A7    (horizontal)
 *   Row 7:  PatrolBoat  C7    (horizontal)
 *   Row 7:  PatrolBoat  E7    (horizontal)
 *   Row 10: PatrolBoat  J10   (horizontal)
 */
function buildFullBoard(ownerId: string): Board {
  const placements = [
    { type: ShipType.Battleship, origin: coord(Column.A, 1),  orientation: Orientation.Horizontal },
    { type: ShipType.Cruiser,    origin: coord(Column.A, 3),  orientation: Orientation.Horizontal },
    { type: ShipType.Cruiser,    origin: coord(Column.E, 3),  orientation: Orientation.Horizontal },
    { type: ShipType.Destroyer,  origin: coord(Column.A, 5),  orientation: Orientation.Horizontal },
    { type: ShipType.Destroyer,  origin: coord(Column.D, 5),  orientation: Orientation.Horizontal },
    { type: ShipType.Destroyer,  origin: coord(Column.G, 5),  orientation: Orientation.Horizontal },
    { type: ShipType.PatrolBoat, origin: coord(Column.A, 7),  orientation: Orientation.Horizontal },
    { type: ShipType.PatrolBoat, origin: coord(Column.C, 7),  orientation: Orientation.Horizontal },
    { type: ShipType.PatrolBoat, origin: coord(Column.E, 7),  orientation: Orientation.Horizontal },
    { type: ShipType.PatrolBoat, origin: coord(Column.J, 10), orientation: Orientation.Horizontal },
  ];

  let board = createEmptyBoard(ownerId);
  for (const p of placements) {
    const r = placeShip(board, p);
    if (!r.ok) throw new Error(`Failed to place ship: ${r.error}`);
    board = r.value;
  }
  return board;
}

// ---------------------------------------------------------------------------
// Session factory — creates a Shooting-phase session directly in the store
// ---------------------------------------------------------------------------

function createShootingSession(
  sessionService: SessionService,
  playerA: string,
  playerB: string
): SessionData {
  // Create session for playerA
  const session = sessionService.createSession(playerA);

  // Join as playerB
  const joinResult = sessionService.joinSession(session.inviteCode!, playerB);
  if (!joinResult.ok) throw new Error("Failed to join session");

  // Build full boards
  const boardA = buildFullBoard(playerA);
  const boardB = buildFullBoard(playerB);

  // Transition directly to Shooting phase
  const shootingSession: SessionData = {
    ...joinResult.value,
    boardA: serializeBoard(boardA),
    boardB: serializeBoard(boardB),
    status: "Shooting",
    turnState: JSON.stringify({ activePlayer: playerA, phase: TurnPhase.Shooting }),
  };
  sessionService.updateSession(shootingSession);
  return shootingSession;
}

// ---------------------------------------------------------------------------
// WebSocket test helpers
// ---------------------------------------------------------------------------

/**
 * Opens a WebSocket connection to the given URL and resolves once the
 * connection is open. Also returns a promise for the first message.
 */
function connectWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

/**
 * Opens a WebSocket connection and returns both the socket and a promise
 * for the first message (registered before the connection opens to avoid
 * race conditions with messages sent immediately on connect).
 */
function connectWsWithFirstMessage(url: string): { ws: WebSocket; firstMessage: Promise<GameEvent> } {
  const ws = new WebSocket(url);
  const firstMessage = new Promise<GameEvent>((resolve, reject) => {
    ws.once("message", (data) => resolve(JSON.parse(data.toString()) as GameEvent));
    ws.once("error", reject);
    ws.once("close", (code, reason) => {
      if (code !== 1000) {
        reject(new Error(`WebSocket closed with code ${code}: ${reason.toString()}`));
      }
    });
  });
  return { ws, firstMessage };
}

/**
 * Waits for the next message from a WebSocket and parses it as JSON.
 */
function nextMessage(ws: WebSocket): Promise<GameEvent> {
  return new Promise((resolve, reject) => {
    const onMessage = (data: WebSocket.RawData) => {
      ws.off("error", onError);
      resolve(JSON.parse(data.toString()) as GameEvent);
    };
    const onError = (err: Error) => {
      ws.off("message", onMessage);
      reject(err);
    };
    ws.once("message", onMessage);
    ws.once("error", onError);
  });
}

/**
 * Collects the next N messages from a WebSocket.
 */
function collectMessages(ws: WebSocket, count: number): Promise<GameEvent[]> {
  return new Promise((resolve, reject) => {
    const messages: GameEvent[] = [];
    const onMessage = (data: WebSocket.RawData) => {
      messages.push(JSON.parse(data.toString()) as GameEvent);
      if (messages.length === count) {
        ws.off("message", onMessage);
        ws.off("error", onError);
        resolve(messages);
      }
    };
    const onError = (err: Error) => {
      ws.off("message", onMessage);
      reject(err);
    };
    ws.on("message", onMessage);
    ws.once("error", onError);
  });
}

/**
 * Waits for a WebSocket close event.
 */
function waitForClose(ws: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    ws.once("close", (code, reason) => resolve({ code, reason: reason.toString() }));
  });
}

// ---------------------------------------------------------------------------
// Test suite setup
// ---------------------------------------------------------------------------

describe("WsGateway integration tests", () => {
  let server: http.Server;
  let sessionService: SessionService;
  let gameService: GameService;
  let gateway: WsGateway;
  let port: number;

  beforeEach(async () => {
    // Create in-memory services
    const queries = createInMemorySessionQueries();
    sessionService = new SessionService(queries);
    gameService = new GameService();

    // Create HTTP server and attach WsGateway
    server = http.createServer();
    gateway = new WsGateway(server, gameService, sessionService, JWT_SECRET, SHORT_DISCONNECT_TIMEOUT_MS);

    // Start listening on a random available port
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const addr = server.address() as { port: number };
    port = addr.port;
  });

  afterEach(async () => {
    // Close the server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // -------------------------------------------------------------------------
  // Helper: build WS URL for a session + player
  // -------------------------------------------------------------------------

  function wsUrl(sessionId: string, playerId: string): string {
    const token = makeToken(playerId);
    return `ws://127.0.0.1:${port}/sessions/${sessionId}?token=${encodeURIComponent(token)}`;
  }

  // -------------------------------------------------------------------------
  // Test 1: Connection rejected with invalid JWT
  // -------------------------------------------------------------------------

  it("rejects connection with invalid JWT (close code 4001)", async () => {
    const session = sessionService.createSession("alice");
    const url = `ws://127.0.0.1:${port}/sessions/${session.id}?token=invalid.jwt.token`;

    const ws = new WebSocket(url);
    const { code } = await waitForClose(ws);
    expect(code).toBe(4001);
  });

  // -------------------------------------------------------------------------
  // Test 2: Connection rejected for unknown session
  // -------------------------------------------------------------------------

  it("rejects connection for unknown session (close code 4004)", async () => {
    const token = makeToken("alice");
    const url = `ws://127.0.0.1:${port}/sessions/nonexistent-session-id?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(url);
    const { code } = await waitForClose(ws);
    expect(code).toBe(4004);
  });

  // -------------------------------------------------------------------------
  // Test 3: SessionRestored sent on connect
  // -------------------------------------------------------------------------

  it("sends SessionRestored event immediately on connect", async () => {
    const playerA = "alice";
    const playerB = "bob";
    const session = createShootingSession(sessionService, playerA, playerB);

    const { ws: wsA, firstMessage } = connectWsWithFirstMessage(wsUrl(session.id, playerA));
    try {
      const event = await firstMessage;
      expect(event.type).toBe("SessionRestored");
      if (event.type === "SessionRestored") {
        expect(typeof event.boardA).toBe("string");
        expect(typeof event.boardB).toBe("string");
        expect(typeof event.turnState).toBe("string");
        expect(event.status).toBe("Shooting");
      }
    } finally {
      wsA.close();
    }
  });

  // -------------------------------------------------------------------------
  // Test 4: Two clients connect, fire shots, ShotResult broadcast to both
  // -------------------------------------------------------------------------

  it("broadcasts ShotResult to both clients when a shot is fired", async () => {
    const playerA = "alice";
    const playerB = "bob";
    const session = createShootingSession(sessionService, playerA, playerB);

    // Connect both clients, capturing first messages (SessionRestored) before open
    const { ws: wsA, firstMessage: firstMsgA } = connectWsWithFirstMessage(wsUrl(session.id, playerA));
    const { ws: wsB, firstMessage: firstMsgB } = connectWsWithFirstMessage(wsUrl(session.id, playerB));

    try {
      // Consume SessionRestored events for both clients
      await firstMsgA;
      await firstMsgB;

      // Set up listeners for the next messages on both clients
      // playerA fires at A1 (Battleship is at A1 on bob's board — will be a Hit)
      const aliceNextMessages = collectMessages(wsA, 2); // ShotResult + TurnChanged (or MatchEnded)
      const bobNextMessages = collectMessages(wsB, 2);   // ShotResult + TurnChanged (or MatchEnded)

      wsA.send(JSON.stringify({ type: "fire_shot", coord: "A1" }));

      const aliceMessages = await aliceNextMessages;
      const bobMessages = await bobNextMessages;

      // Both should receive a ShotResult
      const aliceShotResult = aliceMessages.find((m) => m.type === "ShotResult");
      const bobShotResult = bobMessages.find((m) => m.type === "ShotResult");

      expect(aliceShotResult).toBeDefined();
      expect(bobShotResult).toBeDefined();

      if (aliceShotResult?.type === "ShotResult") {
        expect(aliceShotResult.shooter).toBe(playerA);
        expect(aliceShotResult.coord).toBe("A1");
      }
      if (bobShotResult?.type === "ShotResult") {
        expect(bobShotResult.shooter).toBe(playerA);
        expect(bobShotResult.coord).toBe("A1");
      }
    } finally {
      wsA.close();
      wsB.close();
    }
  });

  // -------------------------------------------------------------------------
  // Test 5: Disconnect sends OpponentDisconnected to remaining client
  // -------------------------------------------------------------------------

  it("sends OpponentDisconnected to remaining client when one disconnects", async () => {
    const playerA = "alice";
    const playerB = "bob";
    const session = createShootingSession(sessionService, playerA, playerB);

    const { ws: wsA, firstMessage: firstMsgA } = connectWsWithFirstMessage(wsUrl(session.id, playerA));
    const { ws: wsB, firstMessage: firstMsgB } = connectWsWithFirstMessage(wsUrl(session.id, playerB));

    // Consume SessionRestored events
    await firstMsgA;
    await firstMsgB;

    // Set up listener for bob's next message before alice disconnects
    const bobNextMessage = nextMessage(wsB);

    // Alice disconnects
    wsA.close();

    // Bob should receive OpponentDisconnected
    const event = await bobNextMessage;
    expect(event.type).toBe("OpponentDisconnected");
    if (event.type === "OpponentDisconnected") {
      expect(event.timeout).toBe(60);
    }

    wsB.close();
  });

  // -------------------------------------------------------------------------
  // Test 6: Reconnect within timeout — SessionRestored sent, OpponentReconnected
  //         sent to the other client
  // -------------------------------------------------------------------------

  it("sends SessionRestored to reconnecting client and OpponentReconnected to other client", async () => {
    const playerA = "alice";
    const playerB = "bob";
    const session = createShootingSession(sessionService, playerA, playerB);

    // Connect both clients
    const { ws: wsA, firstMessage: firstMsgA } = connectWsWithFirstMessage(wsUrl(session.id, playerA));
    const { ws: wsB, firstMessage: firstMsgB } = connectWsWithFirstMessage(wsUrl(session.id, playerB));

    // Consume SessionRestored events
    await firstMsgA;
    await firstMsgB;

    // Listen for bob's OpponentDisconnected before alice disconnects
    const bobDisconnectMsg = nextMessage(wsB);

    // Alice disconnects
    wsA.close();

    // Bob receives OpponentDisconnected
    const disconnectEvent = await bobDisconnectMsg;
    expect(disconnectEvent.type).toBe("OpponentDisconnected");

    // Alice reconnects within the timeout (timer has NOT fired yet — 60s hasn't elapsed)
    const bobReconnectMsg = nextMessage(wsB);
    const { ws: wsA2, firstMessage: restoredMsg } = connectWsWithFirstMessage(wsUrl(session.id, playerA));

    // Alice should receive SessionRestored
    const restoredEvent = await restoredMsg;
    expect(restoredEvent.type).toBe("SessionRestored");
    if (restoredEvent.type === "SessionRestored") {
      expect(restoredEvent.status).toBe("Shooting");
    }

    // Bob should receive OpponentReconnected
    const reconnectedEvent = await bobReconnectMsg;
    expect(reconnectedEvent.type).toBe("OpponentReconnected");

    wsA2.close();
    wsB.close();
  });

  // -------------------------------------------------------------------------
  // Test 7: Reconnect after timeout — MatchEnded sent to remaining client
  // -------------------------------------------------------------------------

  it("sends MatchEnded to remaining client when reconnect timeout expires", async () => {
    const playerA = "alice";
    const playerB = "bob";
    const session = createShootingSession(sessionService, playerA, playerB);

    // Connect both clients
    const { ws: wsA, firstMessage: firstMsgA } = connectWsWithFirstMessage(wsUrl(session.id, playerA));
    const { ws: wsB, firstMessage: firstMsgB } = connectWsWithFirstMessage(wsUrl(session.id, playerB));

    // Consume SessionRestored events
    await firstMsgA;
    await firstMsgB;

    // Listen for bob's OpponentDisconnected
    const bobDisconnectMsg = nextMessage(wsB);

    // Alice disconnects
    wsA.close();

    // Bob receives OpponentDisconnected
    const disconnectEvent = await bobDisconnectMsg;
    expect(disconnectEvent.type).toBe("OpponentDisconnected");

    // Wait for the short timeout to expire (50ms + buffer)
    const bobMatchEndedMsg = nextMessage(wsB);

    // Bob should receive MatchEnded with bob as winner after timeout
    const matchEndedEvent = await bobMatchEndedMsg;
    expect(matchEndedEvent.type).toBe("MatchEnded");
    if (matchEndedEvent.type === "MatchEnded") {
      expect(matchEndedEvent.winner).toBe(playerB);
    }

    wsB.close();
  });

  // -------------------------------------------------------------------------
  // Test 8: Reconnect after timeout — late reconnect does NOT restore session
  // -------------------------------------------------------------------------

  it("does not send OpponentReconnected after timeout has expired", async () => {
    const playerA = "alice";
    const playerB = "bob";
    const session = createShootingSession(sessionService, playerA, playerB);

    const { ws: wsA, firstMessage: firstMsgA } = connectWsWithFirstMessage(wsUrl(session.id, playerA));
    const { ws: wsB, firstMessage: firstMsgB } = connectWsWithFirstMessage(wsUrl(session.id, playerB));

    // Consume SessionRestored events
    await firstMsgA;
    await firstMsgB;

    // Listen for bob's OpponentDisconnected
    const bobDisconnectMsg = nextMessage(wsB);

    // Alice disconnects
    wsA.close();
    await bobDisconnectMsg; // OpponentDisconnected

    // Wait for MatchEnded (timeout fires after SHORT_DISCONNECT_TIMEOUT_MS)
    const bobMatchEndedMsg = nextMessage(wsB);
    const matchEndedEvent = await bobMatchEndedMsg;
    expect(matchEndedEvent.type).toBe("MatchEnded");

    // Alice tries to reconnect after timeout — she still gets SessionRestored
    // (the gateway sends it on connect), but bob should NOT get OpponentReconnected
    // because the match is already finished.
    // We verify by checking that no further messages arrive on bob's socket
    // within a short window.
    const unexpectedBobMessage = new Promise<GameEvent | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 200);
      wsB.once("message", (data) => {
        clearTimeout(timer);
        resolve(JSON.parse(data.toString()) as GameEvent);
      });
    });

    const { ws: wsA2, firstMessage: aliceRestoredMsg } = connectWsWithFirstMessage(wsUrl(session.id, playerA));
    // Alice gets SessionRestored (session is Finished now)
    await aliceRestoredMsg;

    const unexpectedMsg = await unexpectedBobMessage;
    // Bob should NOT receive OpponentReconnected after the match ended
    expect(unexpectedMsg).toBeNull();

    wsA2.close();
    wsB.close();
  });

  // -------------------------------------------------------------------------
  // Test 9: Ping/pong
  // -------------------------------------------------------------------------

  it("responds to ping with pong", async () => {
    const playerA = "alice";
    const session = sessionService.createSession(playerA);

    const { ws: wsA, firstMessage } = connectWsWithFirstMessage(wsUrl(session.id, playerA));

    // Consume SessionRestored
    await firstMessage;

    wsA.send(JSON.stringify({ type: "ping" }));
    const pong = await nextMessage(wsA);
    expect(pong.type).toBe("pong");

    wsA.close();
  });

  // -------------------------------------------------------------------------
  // Test 10: Fleet placement via WebSocket — PlacementAck and MatchStarted
  // -------------------------------------------------------------------------

  it("sends PlacementAck and MatchStarted when both fleets are placed via WebSocket", async () => {
    const playerA = "alice";
    const playerB = "bob";

    // Create a Placement-phase session (not Shooting)
    const session = sessionService.createSession(playerA);
    const joinResult = sessionService.joinSession(session.inviteCode!, playerB);
    if (!joinResult.ok) throw new Error("Failed to join");
    const placementSession = joinResult.value;

    const { ws: wsA, firstMessage: firstMsgA } = connectWsWithFirstMessage(wsUrl(placementSession.id, playerA));
    const { ws: wsB, firstMessage: firstMsgB } = connectWsWithFirstMessage(wsUrl(placementSession.id, playerB));

    // Consume SessionRestored events
    await firstMsgA;
    await firstMsgB;

    // Ship placements for playerA
    const placements = [
      { type: ShipType.Battleship, origin: { col: Column.A, row: 1 },  orientation: Orientation.Horizontal },
      { type: ShipType.Cruiser,    origin: { col: Column.A, row: 3 },  orientation: Orientation.Horizontal },
      { type: ShipType.Cruiser,    origin: { col: Column.E, row: 3 },  orientation: Orientation.Horizontal },
      { type: ShipType.Destroyer,  origin: { col: Column.A, row: 5 },  orientation: Orientation.Horizontal },
      { type: ShipType.Destroyer,  origin: { col: Column.D, row: 5 },  orientation: Orientation.Horizontal },
      { type: ShipType.Destroyer,  origin: { col: Column.G, row: 5 },  orientation: Orientation.Horizontal },
      { type: ShipType.PatrolBoat, origin: { col: Column.A, row: 7 },  orientation: Orientation.Horizontal },
      { type: ShipType.PatrolBoat, origin: { col: Column.C, row: 7 },  orientation: Orientation.Horizontal },
      { type: ShipType.PatrolBoat, origin: { col: Column.E, row: 7 },  orientation: Orientation.Horizontal },
      { type: ShipType.PatrolBoat, origin: { col: Column.J, row: 10 }, orientation: Orientation.Horizontal },
    ];

    // Place all ships for playerA — collect 10 PlacementAck messages
    const aliceAcks = collectMessages(wsA, 10);
    for (const p of placements) {
      wsA.send(JSON.stringify({ type: "place_ship", placement: p }));
    }
    const ackMessages = await aliceAcks;
    expect(ackMessages.every((m) => m.type === "PlacementAck")).toBe(true);

    // Last ack should have boardReady = true
    const lastAck = ackMessages[ackMessages.length - 1];
    if (lastAck?.type === "PlacementAck") {
      expect(lastAck.boardReady).toBe(true);
    }

    // Place all ships for playerB — after this, MatchStarted should be broadcast
    // Collect 10 PlacementAck + 1 MatchStarted for bob, and 1 MatchStarted for alice
    const bobAcksAndMatch = collectMessages(wsB, 11); // 10 acks + 1 MatchStarted
    const aliceMatchStarted = collectMessages(wsA, 1); // 1 MatchStarted

    for (const p of placements) {
      wsB.send(JSON.stringify({ type: "place_ship", placement: p }));
    }

    const bobMessages = await bobAcksAndMatch;
    const aliceMessages = await aliceMatchStarted;

    const matchStartedForBob = bobMessages.find((m) => m.type === "MatchStarted");
    const matchStartedForAlice = aliceMessages.find((m) => m.type === "MatchStarted");

    expect(matchStartedForBob).toBeDefined();
    expect(matchStartedForAlice).toBeDefined();

    if (matchStartedForBob?.type === "MatchStarted") {
      expect(typeof matchStartedForBob.firstPlayer).toBe("string");
    }

    wsA.close();
    wsB.close();
  });

  // -------------------------------------------------------------------------
  // Test 11: Non-active player shot is rejected (no event broadcast)
  // -------------------------------------------------------------------------

  it("does not broadcast events when non-active player fires a shot", async () => {
    const playerA = "alice";
    const playerB = "bob";
    // playerA is active in this session
    const session = createShootingSession(sessionService, playerA, playerB);

    const { ws: wsA, firstMessage: firstMsgA } = connectWsWithFirstMessage(wsUrl(session.id, playerA));
    const { ws: wsB, firstMessage: firstMsgB } = connectWsWithFirstMessage(wsUrl(session.id, playerB));

    // Consume SessionRestored events
    await firstMsgA;
    await firstMsgB;

    // Bob (non-active) fires a shot — should be silently rejected
    wsB.send(JSON.stringify({ type: "fire_shot", coord: "A1" }));

    // Neither client should receive any event within a short window
    const unexpectedAlice = new Promise<GameEvent | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 100);
      wsA.once("message", (data) => {
        clearTimeout(timer);
        resolve(JSON.parse(data.toString()) as GameEvent);
      });
    });
    const unexpectedBob = new Promise<GameEvent | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 100);
      wsB.once("message", (data) => {
        clearTimeout(timer);
        resolve(JSON.parse(data.toString()) as GameEvent);
      });
    });

    expect(await unexpectedAlice).toBeNull();
    expect(await unexpectedBob).toBeNull();

    wsA.close();
    wsB.close();
  });
});

// ---------------------------------------------------------------------------
// Disconnection timeout integration tests
// Requirements: 14.6
// ---------------------------------------------------------------------------

describe("WsGateway disconnection timeout integration tests", () => {
  let server: http.Server;
  let sessionService: SessionService;
  let gameService: GameService;
  let gateway: WsGateway;
  let port: number;

  beforeEach(async () => {
    // Create in-memory services
    const queries = createInMemorySessionQueries();
    sessionService = new SessionService(queries);
    gameService = new GameService();

    // Create HTTP server and attach WsGateway with SHORT_DISCONNECT_TIMEOUT_MS
    server = http.createServer();
    gateway = new WsGateway(server, gameService, sessionService, JWT_SECRET, SHORT_DISCONNECT_TIMEOUT_MS);

    // Start listening on a random available port
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const addr = server.address() as { port: number };
    port = addr.port;
  });

  afterEach(async () => {
    // Close the server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  function wsUrl(sessionId: string, playerId: string): string {
    const token = makeToken(playerId);
    return `ws://127.0.0.1:${port}/sessions/${sessionId}?token=${encodeURIComponent(token)}`;
  }

  // -------------------------------------------------------------------------
  // Test: Full disconnection timeout flow
  //   1. Connect two clients to a shooting-phase session
  //   2. Disconnect one client
  //   3. Verify OpponentDisconnected is sent to the remaining client with timeout=60
  //   4. Wait for the short timeout (50ms) to expire
  //   5. Verify MatchEnded is sent to the remaining client with the correct winner
  //   6. Verify the session status is "Finished" in the session store
  // -------------------------------------------------------------------------

  it("ends match and declares winner after disconnection timeout elapses without reconnection", async () => {
    const playerA = "alice";
    const playerB = "bob";
    const session = createShootingSession(sessionService, playerA, playerB);

    // Step 1: Connect both clients to the shooting-phase session
    const { ws: wsA, firstMessage: firstMsgA } = connectWsWithFirstMessage(wsUrl(session.id, playerA));
    const { ws: wsB, firstMessage: firstMsgB } = connectWsWithFirstMessage(wsUrl(session.id, playerB));

    // Consume SessionRestored events for both clients
    const restoredA = await firstMsgA;
    const restoredB = await firstMsgB;
    expect(restoredA.type).toBe("SessionRestored");
    expect(restoredB.type).toBe("SessionRestored");

    // Step 2: Disconnect playerA (alice)
    const bobDisconnectMsg = nextMessage(wsB);
    wsA.close();

    // Step 3: Verify OpponentDisconnected is sent to bob with timeout=60
    const disconnectEvent = await bobDisconnectMsg;
    expect(disconnectEvent.type).toBe("OpponentDisconnected");
    if (disconnectEvent.type === "OpponentDisconnected") {
      expect(disconnectEvent.timeout).toBe(60);
    }

    // Step 4 & 5: Wait for the short timeout (50ms) to expire and verify MatchEnded
    // Do NOT reconnect — let the timer fire naturally
    const bobMatchEndedMsg = nextMessage(wsB);
    const matchEndedEvent = await bobMatchEndedMsg;

    expect(matchEndedEvent.type).toBe("MatchEnded");
    if (matchEndedEvent.type === "MatchEnded") {
      // playerB (bob) is the winner because playerA (alice) disconnected and did not reconnect
      expect(matchEndedEvent.winner).toBe(playerB);
    }

    // Step 6: Verify the session status is "Finished" in the session store
    const finishedSession = sessionService.getSession(session.id);
    expect(finishedSession).toBeDefined();
    expect(finishedSession!.status).toBe("Finished");

    wsB.close();
  });
});
