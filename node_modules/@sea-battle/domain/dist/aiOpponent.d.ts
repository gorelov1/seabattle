/**
 * AIOpponent — computer-controlled player for single-player mode.
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 * v2 — axis-locked targeting
 */
import { type Board, type Coordinate, type FleetSpec } from "./types.js";
/**
 * Creates a new board for the AI opponent and randomly places all ships
 * according to the given FleetSpec, satisfying all placement rules.
 *
 * Requirements: 12.2
 */
export declare function placeFleet(spec: FleetSpec): Board;
/**
 * Selects the next shot coordinate using a two-phase hunt-and-target strategy.
 *
 * HUNT phase: no Hit cells exist on the board → pick a random Unshot cell.
 * TARGET phase: Hit cells exist (ship partially hit but not yet sunk) →
 *   collect all orthogonal (non-diagonal) neighbors of Hit cells that are
 *   Unshot. If any exist, pick one at random. If none exist (all neighbors
 *   already shot), fall back to HUNT mode.
 *
 * Always returns a cell with status Unshot.
 * Never returns a cell that has already been shot (Miss, Hit, or Sunk).
 *
 * Requirements: 12.3, 12.4, 12.5
 */
export declare function chooseShot(opponentBoard: Board): Coordinate;
//# sourceMappingURL=aiOpponent.d.ts.map