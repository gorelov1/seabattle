/**
 * Core TypeScript types and enums for the Sea Battle game domain.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 10.1, 10.2
 */

// ---------------------------------------------------------------------------
// Primitive identifiers
// ---------------------------------------------------------------------------

/** Unique identifier for a player. */
export type PlayerId = string;

// ---------------------------------------------------------------------------
// Coordinate system (Requirement 1.2, 1.3, 1.4)
// ---------------------------------------------------------------------------

/** Column labels A through J (left to right). */
export enum Column {
  A = "A",
  B = "B",
  C = "C",
  D = "D",
  E = "E",
  F = "F",
  G = "G",
  H = "H",
  I = "I",
  J = "J",
}

/** Row numbers 1 through 10 (top to bottom). */
export type Row = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** A position on the board identified by column and row. */
export interface Coordinate {
  col: Column;
  row: Row;
}

// ---------------------------------------------------------------------------
// Cell status (Requirement 10.1)
// ---------------------------------------------------------------------------

/** The shot status of a single cell on the board. */
export enum CellStatus {
  Unshot = "Unshot",
  Miss = "Miss",
  Hit = "Hit",
  Sunk = "Sunk",
}

// ---------------------------------------------------------------------------
// Ship types and sizes (Requirement 2.1, 2.2)
// ---------------------------------------------------------------------------

/** The type of a ship, which determines its size. */
export enum ShipType {
  Battleship = "Battleship",   // 4 segments
  Cruiser = "Cruiser",         // 3 segments
  Destroyer = "Destroyer",     // 2 segments
  PatrolBoat = "PatrolBoat",   // 1 segment
}

/** Returns the number of segments (cells) for a given ship type. */
export function shipSize(type: ShipType): number {
  switch (type) {
    case ShipType.Battleship:
      return 4;
    case ShipType.Cruiser:
      return 3;
    case ShipType.Destroyer:
      return 2;
    case ShipType.PatrolBoat:
      return 1;
  }
}

// ---------------------------------------------------------------------------
// Cell (Requirement 10.1)
// ---------------------------------------------------------------------------

/** A single cell on the board. */
export interface Cell {
  coord: Coordinate;
  status: CellStatus;
}

// ---------------------------------------------------------------------------
// Ship (Requirement 10.2)
// ---------------------------------------------------------------------------

/** A ship placed on the board. */
export interface Ship {
  type: ShipType;
  /** Ordered list of occupied cell coordinates; length === shipSize(type). */
  cells: Coordinate[];
  /** Number of segments that have been hit; 0..shipSize(type). */
  hitCount: number;
  /** True iff hitCount === shipSize(type). */
  sunk: boolean;
}

// ---------------------------------------------------------------------------
// Board (Requirement 10.5)
// ---------------------------------------------------------------------------

/**
 * A player's 10×10 board.
 * The cells map uses serialized coordinate strings (e.g. "G7") as keys.
 */
export interface Board {
  ownerId: PlayerId;
  /** 100 entries keyed by serialized coordinate string. */
  cells: Map<string, Cell>;
  ships: Ship[];
  /** True after all 10 ships of the fleet have been placed. */
  ready: boolean;
}

// ---------------------------------------------------------------------------
// Fleet specification (Requirement 2.1, 2.2)
// ---------------------------------------------------------------------------

/**
 * The required fleet composition: 1 Battleship, 2 Cruisers, 3 Destroyers,
 * 4 Patrol Boats — 10 ships and 20 segments total.
 */
export interface FleetSpec {
  battleships: 1;
  cruisers: 2;
  destroyers: 3;
  patrolBoats: 4;
}

/** The canonical fleet specification used throughout the game. */
export const FLEET_SPEC: FleetSpec = {
  battleships: 1,
  cruisers: 2,
  destroyers: 3,
  patrolBoats: 4,
};

// ---------------------------------------------------------------------------
// Turn management
// ---------------------------------------------------------------------------

/** The current phase of the game. */
export enum TurnPhase {
  Placement = "Placement",
  Shooting = "Shooting",
  Finished = "Finished",
}

/** The current turn state. */
export interface TurnState {
  activePlayer: PlayerId;
  phase: TurnPhase;
}

// ---------------------------------------------------------------------------
// Shot outcomes and results
// ---------------------------------------------------------------------------

/** The outcome of a single shot. */
export enum ShotOutcome {
  Miss = "Miss",
  Hit = "Hit",
  Sunk = "Sunk",
}

/** The result returned by ShotEngine.processShot on success. */
export interface ShotResult {
  outcome: ShotOutcome;
  updatedBoard: Board;
  /** Coordinates auto-marked as Miss after a Sunk result. */
  autoMarked: Coordinate[];
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** Errors that can occur during ship placement. */
export enum PlacementError {
  OutOfBounds = "OutOfBounds",
  AdjacencyViolation = "AdjacencyViolation",
  QuotaExceeded = "QuotaExceeded",
  Overlap = "Overlap",
  InvalidOrientation = "InvalidOrientation",
}

/** Errors that can occur when processing a shot. */
export enum ShotError {
  AlreadyShot = "AlreadyShot",
  NotYourTurn = "NotYourTurn",
}

/** Error returned when parsing a coordinate string fails. */
export interface ParseError {
  message: string;
}

// ---------------------------------------------------------------------------
// Generic Result and Option types
// ---------------------------------------------------------------------------

/** A discriminated union representing success or failure. */
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/** A discriminated union representing an optional value. */
export type Option<T> =
  | { some: true; value: T }
  | { some: false };

// ---------------------------------------------------------------------------
// Victory
// ---------------------------------------------------------------------------

/** Identifies the winner of a match. */
export interface Winner {
  playerId: PlayerId;
}

// ---------------------------------------------------------------------------
// Ship placement input (used by PlacementEngine)
// ---------------------------------------------------------------------------

/** Orientation of a ship placement. */
export enum Orientation {
  Horizontal = "Horizontal",
  Vertical = "Vertical",
}

/** Input describing a ship to be placed on the board. */
export interface ShipPlacement {
  type: ShipType;
  /** The top-left (or first) cell of the ship. */
  origin: Coordinate;
  orientation: Orientation;
}
