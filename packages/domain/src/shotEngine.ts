/**
 * ShotEngine — processes shots on a board and returns the updated state.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.1, 8.2, 8.3, 8.4, 10.3, 10.4
 */

import {
  type Board,
  type Cell,
  CellStatus,
  type Coordinate,
  type Result,
  type Ship,
  ShotError,
  ShotOutcome,
  type ShotResult,
  Column,
  type Row,
} from "./types.js";
import { serialize } from "./coordinateSystem.js";

// ---------------------------------------------------------------------------
// Column ordering (mirrors placementEngine.ts)
// ---------------------------------------------------------------------------

const COLUMN_ORDER: Column[] = [
  Column.A,
  Column.B,
  Column.C,
  Column.D,
  Column.E,
  Column.F,
  Column.G,
  Column.H,
  Column.I,
  Column.J,
];

const COLUMN_INDEX = new Map<Column, number>(
  COLUMN_ORDER.map((col, idx) => [col, idx])
);

/** Returns the Column at the given index (0–9), or undefined if out of range. */
function columnAt(index: number): Column | undefined {
  return COLUMN_ORDER[index];
}

// ---------------------------------------------------------------------------
// Adjacency helper
// ---------------------------------------------------------------------------

/**
 * Returns all eight-directional neighbors of a coordinate that are within
 * the valid 10×10 board.
 */
function neighbors(coord: Coordinate): Coordinate[] {
  const colIdx = COLUMN_INDEX.get(coord.col);
  if (colIdx === undefined) return [];

  const result: Coordinate[] = [];
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (dc === 0 && dr === 0) continue;
      const newColIdx = colIdx + dc;
      const newRow = (coord.row + dr) as Row;
      const newCol = columnAt(newColIdx);
      if (newCol !== undefined && newRow >= 1 && newRow <= 10) {
        result.push({ col: newCol, row: newRow });
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// processShot
// ---------------------------------------------------------------------------

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
export function processShot(
  board: Board,
  coord: Coordinate
): Result<ShotResult, ShotError> {
  const key = serialize(coord);
  const cell = board.cells.get(key);

  // Guard: cell must exist on the board
  if (cell === undefined) {
    // Treat out-of-bounds as AlreadyShot to keep the API simple; callers
    // should validate coordinates before calling processShot.
    return { ok: false, error: ShotError.AlreadyShot };
  }

  // Requirement 6.5: reject already-shot cells without mutating state
  if (cell.status !== CellStatus.Unshot) {
    return { ok: false, error: ShotError.AlreadyShot };
  }

  // Determine whether the coordinate belongs to a ship
  const hitShipIndex = board.ships.findIndex((ship) =>
    ship.cells.some((c) => serialize(c) === key)
  );

  if (hitShipIndex === -1) {
    // -----------------------------------------------------------------------
    // Miss — no ship at this coordinate
    // -----------------------------------------------------------------------
    const newCells = new Map(board.cells);
    newCells.set(key, { coord, status: CellStatus.Miss });

    const updatedBoard: Board = {
      ...board,
      cells: newCells,
    };

    return {
      ok: true,
      value: {
        outcome: ShotOutcome.Miss,
        updatedBoard,
        autoMarked: [],
      },
    };
  }

  // -------------------------------------------------------------------------
  // Hit or Sunk — there is a ship at this coordinate
  // -------------------------------------------------------------------------
  const hitShip = board.ships[hitShipIndex];
  const newHitCount = hitShip.hitCount + 1;
  const isSunk = newHitCount === hitShip.cells.length;

  // Build updated ship (immutably)
  const updatedShip: Ship = {
    ...hitShip,
    hitCount: newHitCount,
    sunk: isSunk,
  };

  // Build updated ships array (immutably)
  const newShips: Ship[] = board.ships.map((ship, idx) =>
    idx === hitShipIndex ? updatedShip : ship
  );

  // Mark the shot cell as Hit or Sunk
  const newCells = new Map(board.cells);
  newCells.set(key, { coord, status: isSunk ? CellStatus.Sunk : CellStatus.Hit });

  const autoMarked: Coordinate[] = [];

  if (isSunk) {
    // -----------------------------------------------------------------------
    // Sunk — auto-mark all eight-directional buffer-zone cells of the
    // destroyed ship as Miss (skip cells that already have a shot status).
    // Requirements: 8.1, 8.2, 8.3, 8.4
    // -----------------------------------------------------------------------

    // Collect all unique neighbor coordinates of every cell of the sunk ship
    const neighborKeys = new Set<string>();
    const neighborCoords = new Map<string, Coordinate>();

    for (const shipCell of updatedShip.cells) {
      for (const neighbor of neighbors(shipCell)) {
        const nKey = serialize(neighbor);
        if (!neighborKeys.has(nKey)) {
          neighborKeys.add(nKey);
          neighborCoords.set(nKey, neighbor);
        }
      }
    }

    // For each neighbor: if it is Unshot, mark it as Miss
    for (const [nKey, nCoord] of neighborCoords) {
      const existingCell = newCells.get(nKey);
      if (existingCell !== undefined && existingCell.status === CellStatus.Unshot) {
        newCells.set(nKey, { coord: nCoord, status: CellStatus.Miss });
        autoMarked.push(nCoord);
      }
    }
  }

  const updatedBoard: Board = {
    ...board,
    cells: newCells,
    ships: newShips,
  };

  return {
    ok: true,
    value: {
      outcome: isSunk ? ShotOutcome.Sunk : ShotOutcome.Hit,
      updatedBoard,
      autoMarked,
    },
  };
}
