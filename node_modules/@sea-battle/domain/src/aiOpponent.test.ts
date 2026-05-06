/**
 * Unit tests for AIOpponent.
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { placeFleet, chooseShot } from "./aiOpponent.js";
import { createEmptyBoard } from "./placementEngine.js";
import {
  FLEET_SPEC,
  ShipType,
  CellStatus,
  Column,
  type Row,
  type Coordinate,
  type Board,
} from "./types.js";
import { serialize } from "./coordinateSystem.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a board with specific cells set to a given status. */
function setBoardCellStatus(
  board: Board,
  coords: Coordinate[],
  status: CellStatus
): Board {
  const newCells = new Map(board.cells);
  for (const coord of coords) {
    const key = serialize(coord);
    const existing = newCells.get(key);
    if (existing) {
      newCells.set(key, { ...existing, status });
    }
  }
  return { ...board, cells: newCells };
}

/** Returns all coordinates on a board with the given status. */
function cellsWithStatus(board: Board, status: CellStatus): Coordinate[] {
  const result: Coordinate[] = [];
  for (const cell of board.cells.values()) {
    if (cell.status === status) result.push(cell.coord);
  }
  return result;
}

/** Returns the four orthogonal neighbors of a coordinate (within bounds). */
function orthogonalNeighborCoords(coord: Coordinate): Coordinate[] {
  const COLS = [
    Column.A, Column.B, Column.C, Column.D, Column.E,
    Column.F, Column.G, Column.H, Column.I, Column.J,
  ];
  const colIdx = COLS.indexOf(coord.col);
  const neighbors: Coordinate[] = [];
  if (colIdx > 0) neighbors.push({ col: COLS[colIdx - 1], row: coord.row });
  if (colIdx < 9) neighbors.push({ col: COLS[colIdx + 1], row: coord.row });
  if (coord.row > 1) neighbors.push({ col: coord.col, row: (coord.row - 1) as Row });
  if (coord.row < 10) neighbors.push({ col: coord.col, row: (coord.row + 1) as Row });
  return neighbors;
}

// ---------------------------------------------------------------------------
// placeFleet tests
// ---------------------------------------------------------------------------

describe("AIOpponent.placeFleet", () => {
  it("returns a board with ready=true after placing all ships", () => {
    const board = placeFleet(FLEET_SPEC);
    expect(board.ready).toBe(true);
  });

  it("returns a board with exactly 10 ships", () => {
    const board = placeFleet(FLEET_SPEC);
    expect(board.ships).toHaveLength(10);
  });

  it("satisfies fleet composition: 1 Battleship", () => {
    const board = placeFleet(FLEET_SPEC);
    const battleships = board.ships.filter((s) => s.type === ShipType.Battleship);
    expect(battleships).toHaveLength(1);
  });

  it("satisfies fleet composition: 2 Cruisers", () => {
    const board = placeFleet(FLEET_SPEC);
    const cruisers = board.ships.filter((s) => s.type === ShipType.Cruiser);
    expect(cruisers).toHaveLength(2);
  });

  it("satisfies fleet composition: 3 Destroyers", () => {
    const board = placeFleet(FLEET_SPEC);
    const destroyers = board.ships.filter((s) => s.type === ShipType.Destroyer);
    expect(destroyers).toHaveLength(3);
  });

  it("satisfies fleet composition: 4 PatrolBoats", () => {
    const board = placeFleet(FLEET_SPEC);
    const patrolBoats = board.ships.filter((s) => s.type === ShipType.PatrolBoat);
    expect(patrolBoats).toHaveLength(4);
  });

  it("returns a board with ownerId 'ai'", () => {
    const board = placeFleet(FLEET_SPEC);
    expect(board.ownerId).toBe("ai");
  });

  it("returns a board with exactly 100 cells", () => {
    const board = placeFleet(FLEET_SPEC);
    expect(board.cells.size).toBe(100);
  });

  it("produces different placements across multiple calls (randomness check)", () => {
    // Run 10 times; at least two should differ (probability of all identical is negligible)
    const serialized = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const board = placeFleet(FLEET_SPEC);
      const key = board.ships
        .flatMap((s) => s.cells)
        .map(serialize)
        .sort()
        .join(",");
      serialized.add(key);
    }
    expect(serialized.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// chooseShot tests
// ---------------------------------------------------------------------------

describe("AIOpponent.chooseShot", () => {
  it("always returns a cell with status Unshot", () => {
    const board = placeFleet(FLEET_SPEC);
    for (let i = 0; i < 20; i++) {
      const coord = chooseShot(board);
      const key = serialize(coord);
      const cell = board.cells.get(key);
      expect(cell).toBeDefined();
      expect(cell!.status).toBe(CellStatus.Unshot);
    }
  });

  it("hunt mode: returns an Unshot cell when no Hit cells exist", () => {
    const board = placeFleet(FLEET_SPEC);
    // No cells have been shot yet — pure hunt mode
    const coord = chooseShot(board);
    const key = serialize(coord);
    const cell = board.cells.get(key);
    expect(cell!.status).toBe(CellStatus.Unshot);
  });

  it("target mode: returns an orthogonal neighbor of a Hit cell when available", () => {
    let board = placeFleet(FLEET_SPEC);

    // Mark one cell as Hit (pick the first ship's first cell)
    const hitCoord = board.ships[0].cells[0];
    board = setBoardCellStatus(board, [hitCoord], CellStatus.Hit);

    // Run many times to confirm the result is always an orthogonal neighbor of the Hit cell
    const validNeighborKeys = new Set(
      orthogonalNeighborCoords(hitCoord).map(serialize)
    );

    // Run 30 iterations; every result must be an orthogonal neighbor of the Hit cell
    // (assuming those neighbors are all still Unshot, which they are on a fresh board)
    for (let i = 0; i < 30; i++) {
      const coord = chooseShot(board);
      const key = serialize(coord);
      const cell = board.cells.get(key);
      expect(cell!.status).toBe(CellStatus.Unshot);
      expect(validNeighborKeys.has(key)).toBe(true);
    }
  });

  it("falls back to hunt when all orthogonal neighbors of Hit cells are already shot", () => {
    let board = placeFleet(FLEET_SPEC);

    // Mark one cell as Hit
    const hitCoord: Coordinate = { col: Column.E, row: 5 };
    board = setBoardCellStatus(board, [hitCoord], CellStatus.Hit);

    // Mark all orthogonal neighbors as Miss (already shot)
    const neighbors = orthogonalNeighborCoords(hitCoord);
    board = setBoardCellStatus(board, neighbors, CellStatus.Miss);

    // Now chooseShot must fall back to hunt — result must be Unshot
    const coord = chooseShot(board);
    const key = serialize(coord);
    const cell = board.cells.get(key);
    expect(cell!.status).toBe(CellStatus.Unshot);

    // And it must NOT be one of the already-shot neighbors
    const neighborKeys = new Set(neighbors.map(serialize));
    expect(neighborKeys.has(key)).toBe(false);
  });

  it("works correctly when the board has many already-shot cells", () => {
    let board = createEmptyBoard("opponent");

    // Mark 95 out of 100 cells as Miss, leaving only 5 Unshot
    const allCoords: Coordinate[] = [];
    for (const cell of board.cells.values()) {
      allCoords.push(cell.coord);
    }

    const toShoot = allCoords.slice(0, 95);
    board = setBoardCellStatus(board, toShoot, CellStatus.Miss);

    const remaining = cellsWithStatus(board, CellStatus.Unshot);
    expect(remaining).toHaveLength(5);

    const remainingKeys = new Set(remaining.map(serialize));

    // chooseShot must always pick one of the 5 remaining Unshot cells
    for (let i = 0; i < 20; i++) {
      const coord = chooseShot(board);
      const key = serialize(coord);
      expect(remainingKeys.has(key)).toBe(true);
    }
  });

  it("never returns a cell with status Miss", () => {
    let board = placeFleet(FLEET_SPEC);

    // Mark a large portion of the board as Miss
    const allCoords: Coordinate[] = [];
    for (const cell of board.cells.values()) {
      allCoords.push(cell.coord);
    }
    const toMiss = allCoords.slice(0, 50);
    board = setBoardCellStatus(board, toMiss, CellStatus.Miss);

    for (let i = 0; i < 20; i++) {
      const coord = chooseShot(board);
      const key = serialize(coord);
      const cell = board.cells.get(key);
      expect(cell!.status).toBe(CellStatus.Unshot);
    }
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

// Feature: sea-battle-game, Property 19: AI placement satisfies all placement rules
describe("Property 19: AI placement satisfies all placement rules", () => {
  // Validates: Requirements 12.2

  const COLUMN_ORDER = [
    Column.A, Column.B, Column.C, Column.D, Column.E,
    Column.F, Column.G, Column.H, Column.I, Column.J,
  ] as const;
  const VALID_COLS = new Set<string>(COLUMN_ORDER);

  // -------------------------------------------------------------------------
  // Shared invariant helpers (mirrors Properties 3, 4, and 5)
  // -------------------------------------------------------------------------

  /**
   * Property 3 invariant: for every ship on the board,
   * - horizontal ships share the same row across all cells
   * - vertical ships share the same column across all cells
   * - all cells are within A–J × 1–10
   *
   * Because placeFleet / autoPlace does not store orientation on the Ship
   * object, we infer orientation from the cell layout:
   * - if all cells share the same row → horizontal
   * - if all cells share the same column → vertical
   * - single-cell ships (PatrolBoat) satisfy both trivially
   */
  function satisfiesOrientationInvariant(board: Board): boolean {
    for (const ship of board.ships) {
      for (const cell of ship.cells) {
        // All cells within A–J × 1–10
        if (!VALID_COLS.has(cell.col)) return false;
        if (cell.row < 1 || cell.row > 10) return false;
      }

      if (ship.cells.length > 1) {
        const firstRow = ship.cells[0].row;
        const firstCol = ship.cells[0].col;
        const allSameRow = ship.cells.every((c) => c.row === firstRow);
        const allSameCol = ship.cells.every((c) => c.col === firstCol);

        // Must be either purely horizontal or purely vertical
        if (!allSameRow && !allSameCol) return false;
      }
    }
    return true;
  }

  /**
   * Property 4 invariant: no two distinct ships have orthogonally or
   * diagonally adjacent cells (8-directional buffer zone).
   */
  function areAdjacent(
    a: { col: string; row: number },
    b: { col: string; row: number }
  ): boolean {
    const aColIdx = COLUMN_ORDER.indexOf(a.col as typeof COLUMN_ORDER[number]);
    const bColIdx = COLUMN_ORDER.indexOf(b.col as typeof COLUMN_ORDER[number]);
    const colDiff = Math.abs(aColIdx - bColIdx);
    const rowDiff = Math.abs(a.row - b.row);
    return colDiff <= 1 && rowDiff <= 1 && !(colDiff === 0 && rowDiff === 0);
  }

  function satisfiesAdjacencyInvariant(board: Board): boolean {
    const ships = board.ships;
    for (let i = 0; i < ships.length; i++) {
      for (let j = i + 1; j < ships.length; j++) {
        for (const cellA of ships[i].cells) {
          for (const cellB of ships[j].cells) {
            if (areAdjacent(cellA, cellB)) return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Property 5 invariant: exactly 1 Battleship, 2 Cruisers, 3 Destroyers,
   * 4 PatrolBoats — 10 ships and 20 segments total.
   */
  function satisfiesFleetCompositionInvariant(board: Board): boolean {
    if (!board.ready) return false;

    const battleships = board.ships.filter((s) => s.type === ShipType.Battleship).length;
    const cruisers = board.ships.filter((s) => s.type === ShipType.Cruiser).length;
    const destroyers = board.ships.filter((s) => s.type === ShipType.Destroyer).length;
    const patrolBoats = board.ships.filter((s) => s.type === ShipType.PatrolBoat).length;

    if (battleships !== 1) return false;
    if (cruisers !== 2) return false;
    if (destroyers !== 3) return false;
    if (patrolBoats !== 4) return false;
    if (board.ships.length !== 10) return false;

    const totalSegments = board.ships.reduce((sum, ship) => sum + ship.cells.length, 0);
    if (totalSegments !== 20) return false;

    return true;
  }

  it(
    "for any invocation of placeFleet, the resulting board satisfies the " +
      "orientation invariant (Property 3), adjacency rule (Property 4), and " +
      "fleet composition invariant (Property 5)",
    () => {
      fc.assert(
        fc.property(
          fc.constant(null), // placeFleet uses Math.random internally; no generator input needed
          (_) => {
            const board = placeFleet(FLEET_SPEC);

            // Property 3: orientation invariant
            if (!satisfiesOrientationInvariant(board)) return false;

            // Property 4: adjacency rule
            if (!satisfiesAdjacencyInvariant(board)) return false;

            // Property 5: fleet composition
            if (!satisfiesFleetCompositionInvariant(board)) return false;

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// Feature: sea-battle-game, Property 20: AI never fires at an already-shot cell
describe("Property 20: AI never fires at an already-shot cell", () => {
  // Validates: Requirements 12.3

  const COLUMNS = [
    Column.A, Column.B, Column.C, Column.D, Column.E,
    Column.F, Column.G, Column.H, Column.I, Column.J,
  ] as const;

  /**
   * Arbitrarily generates a number of cells to pre-shoot (0 to 80).
   * Returns a list of unique coordinate indices (0–99) to mark as Miss.
   */
  const preShootCountArb = fc.integer({ min: 0, max: 80 });

  it(
    "for any board state with 0–80 pre-shot cells, chooseShot always returns a coordinate with status Unshot",
    () => {
      fc.assert(
        fc.property(
          preShootCountArb,
          (preShootCount) => {
            // Step 1: Generate a board with a full fleet via placeFleet
            const board = placeFleet(FLEET_SPEC);

            // Step 2: Collect all 100 coordinates in a stable order
            const allCoords: Coordinate[] = [];
            for (const col of COLUMNS) {
              for (let row = 1; row <= 10; row++) {
                allCoords.push({ col, row: row as Row });
              }
            }

            // Step 3: Mark the first `preShootCount` cells as Miss
            // (using a deterministic slice so the test is reproducible)
            const toMiss = allCoords.slice(0, preShootCount);
            let testBoard = setBoardCellStatus(board, toMiss, CellStatus.Miss);

            // Step 4: Call chooseShot and verify the returned coordinate is Unshot
            const chosen = chooseShot(testBoard);
            const key = serialize(chosen);
            const cell = testBoard.cells.get(key);

            return cell !== undefined && cell.status === CellStatus.Unshot;
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
