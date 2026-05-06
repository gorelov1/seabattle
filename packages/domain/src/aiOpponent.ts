/**
 * AIOpponent — computer-controlled player for single-player mode.
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { type Board, type Coordinate, CellStatus, type FleetSpec } from "./types.js";
import { createEmptyBoard, autoPlace } from "./placementEngine.js";
import { serialize } from "./coordinateSystem.js";

// ---------------------------------------------------------------------------
// placeFleet
// ---------------------------------------------------------------------------

/**
 * Creates a new board for the AI opponent and randomly places all ships
 * according to the given FleetSpec, satisfying all placement rules.
 *
 * Requirements: 12.2
 */
export function placeFleet(spec: FleetSpec): Board {
  const board = createEmptyBoard("ai");
  return autoPlace(board, spec);
}

// ---------------------------------------------------------------------------
// chooseShot — hunt-and-target strategy
// ---------------------------------------------------------------------------

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
export function chooseShot(opponentBoard: Board): Coordinate {
  // Collect all cells by status
  const unshotCells: Coordinate[] = [];
  const hitCells: Coordinate[] = [];

  for (const cell of opponentBoard.cells.values()) {
    if (cell.status === CellStatus.Unshot) {
      unshotCells.push(cell.coord);
    } else if (cell.status === CellStatus.Hit) {
      hitCells.push(cell.coord);
    }
  }

  // TARGET phase: if there are Hit cells, try to find orthogonal Unshot neighbors
  if (hitCells.length > 0) {
    const targetCandidates = getOrthogonalUnshotNeighbors(
      hitCells,
      opponentBoard
    );

    if (targetCandidates.length > 0) {
      return pickRandom(targetCandidates);
    }
    // Fall through to HUNT if no valid target neighbors found
  }

  // HUNT phase: pick a random Unshot cell
  // unshotCells is guaranteed non-empty when the game is still in progress
  return pickRandom(unshotCells);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns all orthogonal (up/down/left/right, not diagonal) neighbors of the
 * given Hit cells that have status Unshot on the board.
 */
function getOrthogonalUnshotNeighbors(
  hitCells: Coordinate[],
  board: Board
): Coordinate[] {
  const seen = new Set<string>();
  const candidates: Coordinate[] = [];

  for (const coord of hitCells) {
    for (const neighbor of orthogonalNeighbors(coord)) {
      const key = serialize(neighbor);
      if (seen.has(key)) continue;
      seen.add(key);

      const cell = board.cells.get(key);
      if (cell !== undefined && cell.status === CellStatus.Unshot) {
        candidates.push(neighbor);
      }
    }
  }

  return candidates;
}

/**
 * Returns the four orthogonal (non-diagonal) neighbors of a coordinate that
 * are within the valid 10×10 board.
 */
function orthogonalNeighbors(coord: Coordinate): Coordinate[] {
  const COLUMN_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;
  type Col = typeof COLUMN_ORDER[number];

  const colIdx = COLUMN_ORDER.indexOf(coord.col as Col);
  if (colIdx === -1) return [];

  const neighbors: Coordinate[] = [];

  // Left
  if (colIdx > 0) {
    neighbors.push({ col: COLUMN_ORDER[colIdx - 1] as typeof coord.col, row: coord.row });
  }
  // Right
  if (colIdx < 9) {
    neighbors.push({ col: COLUMN_ORDER[colIdx + 1] as typeof coord.col, row: coord.row });
  }
  // Up
  if (coord.row > 1) {
    neighbors.push({ col: coord.col, row: (coord.row - 1) as typeof coord.row });
  }
  // Down
  if (coord.row < 10) {
    neighbors.push({ col: coord.col, row: (coord.row + 1) as typeof coord.row });
  }

  return neighbors;
}

/** Picks a uniformly random element from a non-empty array. */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
