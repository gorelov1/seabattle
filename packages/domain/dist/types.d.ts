/**
 * Core TypeScript types and enums for the Sea Battle game domain.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 10.1, 10.2
 */
/** Unique identifier for a player. */
export type PlayerId = string;
/** Column labels A through J (left to right). */
export declare enum Column {
    A = "A",
    B = "B",
    C = "C",
    D = "D",
    E = "E",
    F = "F",
    G = "G",
    H = "H",
    I = "I",
    J = "J"
}
/** Row numbers 1 through 10 (top to bottom). */
export type Row = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
/** A position on the board identified by column and row. */
export interface Coordinate {
    col: Column;
    row: Row;
}
/** The shot status of a single cell on the board. */
export declare enum CellStatus {
    Unshot = "Unshot",
    Miss = "Miss",
    Hit = "Hit",
    Sunk = "Sunk"
}
/** The type of a ship, which determines its size. */
export declare enum ShipType {
    Battleship = "Battleship",// 4 segments
    Cruiser = "Cruiser",// 3 segments
    Destroyer = "Destroyer",// 2 segments
    PatrolBoat = "PatrolBoat"
}
/** Returns the number of segments (cells) for a given ship type. */
export declare function shipSize(type: ShipType): number;
/** A single cell on the board. */
export interface Cell {
    coord: Coordinate;
    status: CellStatus;
}
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
export declare const FLEET_SPEC: FleetSpec;
/** The current phase of the game. */
export declare enum TurnPhase {
    Placement = "Placement",
    Shooting = "Shooting",
    Finished = "Finished"
}
/** The current turn state. */
export interface TurnState {
    activePlayer: PlayerId;
    phase: TurnPhase;
}
/** The outcome of a single shot. */
export declare enum ShotOutcome {
    Miss = "Miss",
    Hit = "Hit",
    Sunk = "Sunk"
}
/** The result returned by ShotEngine.processShot on success. */
export interface ShotResult {
    outcome: ShotOutcome;
    updatedBoard: Board;
    /** Coordinates auto-marked as Miss after a Sunk result. */
    autoMarked: Coordinate[];
}
/** Errors that can occur during ship placement. */
export declare enum PlacementError {
    OutOfBounds = "OutOfBounds",
    AdjacencyViolation = "AdjacencyViolation",
    QuotaExceeded = "QuotaExceeded",
    Overlap = "Overlap",
    InvalidOrientation = "InvalidOrientation"
}
/** Errors that can occur when processing a shot. */
export declare enum ShotError {
    AlreadyShot = "AlreadyShot",
    NotYourTurn = "NotYourTurn"
}
/** Error returned when parsing a coordinate string fails. */
export interface ParseError {
    message: string;
}
/** A discriminated union representing success or failure. */
export type Result<T, E> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: E;
};
/** A discriminated union representing an optional value. */
export type Option<T> = {
    some: true;
    value: T;
} | {
    some: false;
};
/** Identifies the winner of a match. */
export interface Winner {
    playerId: PlayerId;
}
/** Orientation of a ship placement. */
export declare enum Orientation {
    Horizontal = "Horizontal",
    Vertical = "Vertical"
}
/** Input describing a ship to be placed on the board. */
export interface ShipPlacement {
    type: ShipType;
    /** The top-left (or first) cell of the ship. */
    origin: Coordinate;
    orientation: Orientation;
}
//# sourceMappingURL=types.d.ts.map