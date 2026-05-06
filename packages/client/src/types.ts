/**
 * Client-side type definitions for the Sea Battle game.
 *
 * Re-exports relevant domain types and defines client-specific types for
 * account management, authentication, and WebSocket game events.
 *
 * Requirements: 13.1, 13.5, 13.6, 14.5, 14.7
 */

// ---------------------------------------------------------------------------
// Re-export domain types used by the client
// ---------------------------------------------------------------------------

export type {
  Coordinate,
  Board,
  Cell,
  Ship,
  ShipPlacement,
  FleetSpec,
  TurnState,
  ShotResult,
  PlayerId,
  Winner,
} from '@sea-battle/domain';

export {
  Column,
  Row,
  CellStatus,
  ShipType,
  ShotOutcome,
  PlacementError,
  ShotError,
  TurnPhase,
  Orientation,
  FLEET_SPEC,
} from '@sea-battle/domain';

// ---------------------------------------------------------------------------
// Account and authentication types
// ---------------------------------------------------------------------------

/** A registered user account (client-visible fields only — no password hash). */
export interface UserAccount {
  id: string;
  email: string;
  pendingEmail?: string | null;
  displayName: string;
  profileIcon: string;
  verified: boolean;
  createdAt: string;
}

/** JWT authentication token returned after a successful login. */
export interface AuthToken {
  accountId: string;
  issuedAt: string;
  expiresAt: string;
  tokenId: string;
  /** The raw JWT string to include in Authorization headers. */
  jwt: string;
}

/** Fields that can be updated on a user profile. */
export interface ProfileUpdate {
  displayName?: string;
  profileIcon?: string;
  email?: string;
  newPassword?: {
    current: string;
    new: string;
  };
}

// ---------------------------------------------------------------------------
// GameEvent union — server → client WebSocket messages
// ---------------------------------------------------------------------------

/** All possible events the server can push to the client over WebSocket. */
export type GameEvent =
  | { type: 'SessionRestored'; boardA: string; boardB: string; turnState: string; status: string }
  | { type: 'PlacementAck'; playerId: string; boardReady: boolean }
  | { type: 'MatchStarted'; firstPlayer: string }
  | { type: 'ShotResult'; shooter: string; coord: string; outcome: string; autoMarked: string[]; winner?: string }
  | { type: 'TurnChanged'; activePlayer: string }
  | { type: 'MatchEnded'; winner: string }
  | { type: 'OpponentDisconnected'; timeout: number }
  | { type: 'OpponentReconnected' }
  | { type: 'pong' };
