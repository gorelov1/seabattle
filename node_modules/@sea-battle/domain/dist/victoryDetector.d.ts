/**
 * VictoryDetector — checks whether a board's owner has won the game.
 * Requirements: 9.1, 9.2, 9.3
 */
import { type Board, type Option, type Winner } from "./types.js";
/**
 * Checks whether all 20 ship segments on the board have been sunk.
 *
 * Returns `{ some: true, value: { playerId: board.ownerId } }` when the total
 * number of sunk segments across all ships equals exactly 20.
 * Returns `{ some: false }` otherwise.
 *
 * "Sunk segments" = sum of `cells.length` for all ships where `sunk === true`.
 *
 * @param board The board to inspect (typically the opponent's board).
 * @returns An Option<Winner> indicating whether the board's owner has been defeated.
 *
 * Requirements: 9.1, 9.2, 9.3
 */
export declare function check(board: Board): Option<Winner>;
//# sourceMappingURL=victoryDetector.d.ts.map