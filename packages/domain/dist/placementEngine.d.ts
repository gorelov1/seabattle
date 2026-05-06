/**
 * PlacementEngine — validates and records ship placements on a board.
 * Requirements: 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.2
 */
import { type Board, type FleetSpec, PlacementError, type Result, type ShipPlacement } from "./types.js";
/** Creates a fresh empty 10×10 board for the given owner. */
export declare function createEmptyBoard(ownerId: string): Board;
/**
 * Validates and places a ship on the board.
 *
 * Validation order (per design):
 *   1. Orientation is Horizontal or Vertical.
 *   2. All cells are within A–J × 1–10.
 *   3. Ship-type quota is not exceeded.
 *   4. No cell overlaps an existing ship.
 *   5. No cell is within the eight-directional buffer zone of an existing ship.
 *
 * On success returns a new Board (immutable — input board is not mutated).
 */
export declare function placeShip(board: Board, placement: ShipPlacement): Result<Board, PlacementError>;
/**
 * Returns true when all 10 ships of the standard FleetSpec are placed.
 * Requirements: 5.2
 */
export declare function isFleetReady(board: Board): boolean;
/**
 * Randomly places all ships of the fleet on the board following all placement
 * rules. Used by the AI opponent.
 * Requirements: 5.2, 12.2
 */
export declare function autoPlace(board: Board, fleet: FleetSpec): Board;
//# sourceMappingURL=placementEngine.d.ts.map