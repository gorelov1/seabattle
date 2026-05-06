/**
 * AIOpponent — computer-controlled player for single-player mode.
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 * v2 — axis-locked targeting
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
    // Group hit cells into connected components (each = one partially-hit ship)
    const groups = groupConnectedHits(hitCells);

    // Sort groups: largest first (most hits = most information, closest to sunk)
    const sortedGroups = [...groups].sort((a, b) => b.length - a.length);

    // Debug: log what the AI is considering
    if (hitCells.length >= 2) {
      console.log('[AI] hits:', hitCells.map(c => c.col + c.row), '| groups:', groups.map(g => g.map(c => c.col + c.row)), '| activeGroup:', sortedGroups[0]?.map(c => c.col + c.row));
    }

    // Try each group in order until we find valid candidates
    for (const group of sortedGroups) {
      const axisLocked = group.length >= 2
        ? getAxisLockedCandidates(group, opponentBoard)
        : null;

      const candidates =
        (axisLocked !== null && axisLocked.length > 0)
          ? axisLocked
          : getOrthogonalUnshotNeighbors(group, opponentBoard);

      if (candidates.length > 0) {
        if (hitCells.length >= 2) {
          console.log('[AI] targeting group:', group.map(c => c.col + c.row), '| axisLocked:', axisLocked?.map(c => c.col + c.row) ?? 'null', '| candidates:', candidates.map(c => c.col + c.row));
        }
        return pickRandom(candidates);
      }
      // This group is fully surrounded — try the next one
    }
    // All groups exhausted — fall through to hunt
  }

  // HUNT phase: pick a random Unshot cell
  return pickRandom(unshotCells);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Groups hit cells into connected components based on orthogonal adjacency.
 * Each group represents a single partially-hit ship.
 */
function groupConnectedHits(hitCells: Coordinate[]): Coordinate[][] {
  const COLUMN_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;
  type Col = typeof COLUMN_ORDER[number];

  const remaining = new Set(hitCells.map(c => c.col + c.row));
  const groups: Coordinate[][] = [];

  for (const start of hitCells) {
    const key = start.col + start.row;
    if (!remaining.has(key)) continue;

    // BFS to find all orthogonally connected hit cells
    const group: Coordinate[] = [];
    const queue: Coordinate[] = [start];
    remaining.delete(key);

    while (queue.length > 0) {
      const current = queue.shift()!;
      group.push(current);

      const colIdx = COLUMN_ORDER.indexOf(current.col as Col);
      const neighbors: Coordinate[] = [];
      if (colIdx > 0) neighbors.push({ col: COLUMN_ORDER[colIdx - 1] as Coordinate['col'], row: current.row });
      if (colIdx < 9) neighbors.push({ col: COLUMN_ORDER[colIdx + 1] as Coordinate['col'], row: current.row });
      if (current.row > 1) neighbors.push({ col: current.col, row: (current.row - 1) as Coordinate['row'] });
      if (current.row < 10) neighbors.push({ col: current.col, row: (current.row + 1) as Coordinate['row'] });

      for (const n of neighbors) {
        const nKey = n.col + n.row;
        if (remaining.has(nKey)) {
          remaining.delete(nKey);
          queue.push(n);
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * When 2+ Hit cells exist, determines the ship's axis (horizontal or vertical)
 * and returns only the Unshot cells at the two ends of the hit run along that axis.
 *
 * If the hits span both axes (shouldn't happen in a valid game but guard anyway),
 * returns null so the caller falls back to the general neighbor search.
 */
function getAxisLockedCandidates(
  hitCells: Coordinate[],
  board: Board
): Coordinate[] | null {
  const COLUMN_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;
  type Col = typeof COLUMN_ORDER[number];

  // Check if all hits share the same row (horizontal ship)
  const allSameRow = hitCells.every((c) => c.row === hitCells[0].row);
  // Check if all hits share the same column (vertical ship)
  const allSameCol = hitCells.every((c) => c.col === hitCells[0].col);

  if (!allSameRow && !allSameCol) {
    // Hits are scattered — can't determine axis; fall back
    return null;
  }

  const candidates: Coordinate[] = [];

  if (allSameRow) {
    const row = hitCells[0].row;
    const colIndices = hitCells.map((c) => COLUMN_ORDER.indexOf(c.col as Col));
    const minCol = Math.min(...colIndices);
    const maxCol = Math.max(...colIndices);

    if (minCol > 0) {
      const leftCoord = { col: COLUMN_ORDER[minCol - 1] as Coordinate['col'], row };
      const cell = board.cells.get(serialize(leftCoord));
      if (cell?.status === CellStatus.Unshot) candidates.push(leftCoord);
    }
    if (maxCol < 9) {
      const rightCoord = { col: COLUMN_ORDER[maxCol + 1] as Coordinate['col'], row };
      const cell = board.cells.get(serialize(rightCoord));
      if (cell?.status === CellStatus.Unshot) candidates.push(rightCoord);
    }
  } else {
    const col = hitCells[0].col;
    const rows = hitCells.map((c) => c.row);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);

    if (minRow > 1) {
      const upCoord = { col, row: (minRow - 1) as Coordinate['row'] };
      const cell = board.cells.get(serialize(upCoord));
      if (cell?.status === CellStatus.Unshot) candidates.push(upCoord);
    }
    if (maxRow < 10) {
      const downCoord = { col, row: (maxRow + 1) as Coordinate['row'] };
      const cell = board.cells.get(serialize(downCoord));
      if (cell?.status === CellStatus.Unshot) candidates.push(downCoord);
    }
  }

  return candidates;
}

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
