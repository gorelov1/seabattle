/**
 * SessionService — manages game sessions and invite-code flow.
 *
 * Designed for dependency injection: pass a `SessionQueries` interface in the
 * constructor so tests can use an in-memory store without touching the DB.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */

import { v4 as uuidv4 } from "uuid";
import { createEmptyBoard } from "@sea-battle/domain";
import { TurnPhase } from "@sea-battle/domain";
import type { SessionRow } from "./db.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionData {
  id: string;
  inviteCode: string | null;
  playerA: string;
  playerB: string | null;
  boardA: string; // JSON-serialized Board
  boardB: string; // JSON-serialized Board
  turnState: string; // JSON-serialized TurnState
  status: "WaitingForPlayers" | "Placement" | "Shooting" | "Finished";
  disconnected: Record<string, string>; // playerId → ISO timestamp
  createdAt: string;
}

export type SessionError = "InvalidInviteCode" | "SessionFull" | "SessionNotFound";

export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// ---------------------------------------------------------------------------
// SessionQueries interface (for dependency injection)
// ---------------------------------------------------------------------------

export interface SessionQueries {
  insert(row: SessionRow): unknown;
  findById(id: string): SessionRow | undefined;
  findByInviteCode(code: string): SessionRow | undefined;
  update(row: SessionRow): unknown;
  delete(id: string): unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generates a 6-character alphanumeric invite code (uppercase). */
function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Serializes a Board to a JSON string.
 * The Board uses a Map for cells, so we convert it to a plain object first.
 */
function serializeBoard(board: ReturnType<typeof createEmptyBoard>): string {
  return JSON.stringify({
    ownerId: board.ownerId,
    cells: Object.fromEntries(board.cells),
    ships: board.ships,
    ready: board.ready,
  });
}

/** Converts a SessionRow to SessionData. */
function rowToSessionData(row: SessionRow): SessionData {
  return {
    id: row.id,
    inviteCode: row.invite_code,
    playerA: row.player_a,
    playerB: row.player_b,
    boardA: row.board_a,
    boardB: row.board_b,
    turnState: row.turn_state,
    status: row.status as SessionData["status"],
    disconnected: JSON.parse(row.disconnected) as Record<string, string>,
    createdAt: row.created_at,
  };
}

/** Converts a SessionData to a SessionRow for persistence. */
function sessionDataToRow(session: SessionData): SessionRow {
  return {
    id: session.id,
    invite_code: session.inviteCode,
    player_a: session.playerA,
    player_b: session.playerB,
    board_a: session.boardA,
    board_b: session.boardB,
    turn_state: session.turnState,
    status: session.status,
    disconnected: JSON.stringify(session.disconnected),
    created_at: session.createdAt,
  };
}

// ---------------------------------------------------------------------------
// SessionService
// ---------------------------------------------------------------------------

export class SessionService {
  private readonly queries: SessionQueries;

  constructor(queries: SessionQueries) {
    this.queries = queries;
  }

  /**
   * Creates a new session for playerA.
   *
   * - Generates a UUID sessionId and 6-char alphanumeric inviteCode
   * - Creates empty boards for both players (playerB board uses placeholder id)
   * - Sets status to 'WaitingForPlayers'
   * - Persists to DB
   * - Returns SessionData
   */
  createSession(playerA: string): SessionData {
    const sessionId = uuidv4();
    const inviteCode = generateInviteCode();
    const createdAt = new Date().toISOString();

    const boardA = createEmptyBoard(playerA);
    const boardB = createEmptyBoard(""); // placeholder until playerB joins

    const initialTurnState = {
      activePlayer: playerA,
      phase: TurnPhase.Placement,
    };

    const session: SessionData = {
      id: sessionId,
      inviteCode,
      playerA,
      playerB: null,
      boardA: serializeBoard(boardA),
      boardB: serializeBoard(boardB),
      turnState: JSON.stringify(initialTurnState),
      status: "WaitingForPlayers",
      disconnected: {},
      createdAt,
    };

    this.queries.insert(sessionDataToRow(session));
    return session;
  }

  /**
   * Joins an existing session using an invite code.
   *
   * - Looks up open session by invite code
   * - Rejects with InvalidInviteCode if not found
   * - Rejects with SessionFull if playerB already set
   * - Sets playerB, transitions status to 'Placement'
   * - Persists updated session
   * - Returns updated SessionData
   */
  joinSession(
    inviteCode: string,
    playerB: string
  ): Result<SessionData, SessionError> {
    const row = this.queries.findByInviteCode(inviteCode);

    if (row === undefined) {
      return { ok: false, error: "InvalidInviteCode" };
    }

    if (row.player_b !== null) {
      return { ok: false, error: "SessionFull" };
    }

    // Create a proper empty board for playerB now that we know their id
    const boardB = createEmptyBoard(playerB);

    const updatedSession: SessionData = {
      ...rowToSessionData(row),
      playerB,
      boardB: serializeBoard(boardB),
      status: "Placement",
    };

    this.queries.update(sessionDataToRow(updatedSession));
    return { ok: true, value: updatedSession };
  }

  /**
   * Looks up a session by sessionId.
   * Returns undefined if not found.
   */
  getSession(sessionId: string): SessionData | undefined {
    const row = this.queries.findById(sessionId);
    if (row === undefined) return undefined;
    return rowToSessionData(row);
  }

  /**
   * Persists an updated session to the DB.
   */
  updateSession(session: SessionData): void {
    this.queries.update(sessionDataToRow(session));
  }
}

// ---------------------------------------------------------------------------
// Factory helper — creates a SessionService backed by the real DB.
// ---------------------------------------------------------------------------

export async function createDefaultSessionService(): Promise<SessionService> {
  const { sessionQueries } = await import("./db.js");
  return new SessionService(sessionQueries);
}
