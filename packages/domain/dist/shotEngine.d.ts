/**
 * ShotEngine — processes shots on a board and returns the updated state.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.1, 8.2, 8.3, 8.4, 10.3, 10.4
 */
import { type Board, type Coordinate, type Result, ShotError, type ShotResult } from "./types.js";
/**
 * Processes a shot at the given coordinate on the board.
 *
 * Rules:
 *   - If the cell has already been shot (status !== Unshot), return AlreadyShot error
 *     without mutating board state.
 *   - If the cell contains no ship segment → Miss.
 *   - If the cell contains a ship segment and the ship still has unsunk segments
 *     after this hit → Hit, increment ship hitCount.
 *   - If the cell contains the last unsunk segment of a ship → Sunk, increment
 *     hitCount, set ship.sunk = true, auto-mark all eight-directional buffer-zone
 *     cells of the destroyed ship as Miss (skip already-shot cells).
 *
 * The function is IMMUTABLE — the input board is never mutated.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.1, 8.2, 8.3, 8.4, 10.3, 10.4
 */
export declare function processShot(board: Board, coord: Coordinate): Result<ShotResult, ShotError>;
//# sourceMappingURL=shotEngine.d.ts.map