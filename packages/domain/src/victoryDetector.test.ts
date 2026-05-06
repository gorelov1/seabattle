/**
 * Unit tests for VictoryDetector.check
 * Requirements: 9.1, 9.2, 9.3
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { check } from "./victoryDetector.js";
import { createEmptyBoard, placeShip, autoPlace } from "./placementEngine.js";
import { processShot } from "./shotEngine.js";
import {
  Column,
  Orientation,
  ShipType,
  type Board,
  type Coordinate,
  FLEET_SPEC,
} from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sinks a ship by firing at all of its cell coordinates in sequence.
 * Returns the updated board after all shots.
 */
function sinkShip(board: Board, coords: Coordinate[]): Board {
  let current = board;
  for (const coord of coords) {
    const result = processShot(current, coord);
    if (!result.ok) throw new Error(`processShot failed: ${result.error}`);
    current = result.value.updatedBoard;
  }
  return current;
}

/**
 * Builds a fully-placed board with the standard fleet using autoPlace,
 * then sinks every ship by shooting all their cells.
 * Returns the board with all 20 segments sunk.
 */
function buildAllSunkBoard(ownerId: string): Board {
  const empty = createEmptyBoard(ownerId);
  const placed = autoPlace(empty, FLEET_SPEC);

  let board = placed;
  for (const ship of placed.ships) {
    board = sinkShip(board, ship.cells);
  }
  return board;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("check (VictoryDetector)", () => {
  // -------------------------------------------------------------------------
  // Empty board — no ships, no sunk segments
  // -------------------------------------------------------------------------
  it("returns none for an empty board (no ships)", () => {
    const board = createEmptyBoard("player1");
    const result = check(board);
    expect(result.some).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Some ships sunk but not all 20 segments
  // -------------------------------------------------------------------------
  it("returns none when some ships are sunk but total sunk segments < 20", () => {
    // Place only a PatrolBoat (1 segment) and sink it — far from 20
    const empty = createEmptyBoard("player1");
    const placed = placeShip(empty, {
      type: ShipType.PatrolBoat,
      origin: { col: Column.E, row: 5 },
      orientation: Orientation.Horizontal,
    });
    if (!placed.ok) throw new Error("placeShip failed");

    const afterSink = sinkShip(placed.value, [{ col: Column.E, row: 5 }]);
    const result = check(afterSink);
    expect(result.some).toBe(false);
  });

  it("returns none when 19 segments are sunk (one short of victory)", () => {
    // Build a full fleet board and sink all ships except one PatrolBoat cell
    const empty = createEmptyBoard("player1");
    const placed = autoPlace(empty, FLEET_SPEC);

    // Sink all ships except the last PatrolBoat
    const patrolBoats = placed.ships.filter((s) => s.type === ShipType.PatrolBoat);
    const shipsToSink = placed.ships.filter((s) => s !== patrolBoats[patrolBoats.length - 1]);

    let board = placed;
    for (const ship of shipsToSink) {
      board = sinkShip(board, ship.cells);
    }

    // Verify we have 19 sunk segments (20 - 1 PatrolBoat = 19)
    const sunkSegments = board.ships
      .filter((s) => s.sunk)
      .reduce((sum, s) => sum + s.cells.length, 0);
    expect(sunkSegments).toBe(19);

    const result = check(board);
    expect(result.some).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Exactly 20 segments sunk — victory
  // -------------------------------------------------------------------------
  it("returns winner when exactly 20 segments are sunk", () => {
    const board = buildAllSunkBoard("player1");

    // Verify all 20 segments are sunk
    const sunkSegments = board.ships
      .filter((s) => s.sunk)
      .reduce((sum, s) => sum + s.cells.length, 0);
    expect(sunkSegments).toBe(20);

    const result = check(board);
    expect(result.some).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Winner's playerId matches board.ownerId
  // -------------------------------------------------------------------------
  it("winner's playerId matches board.ownerId", () => {
    const ownerId = "alice";
    const board = buildAllSunkBoard(ownerId);

    const result = check(board);
    expect(result.some).toBe(true);
    if (!result.some) return;
    expect(result.value.playerId).toBe(ownerId);
  });

  it("winner's playerId matches board.ownerId for a different owner", () => {
    const ownerId = "bob";
    const board = buildAllSunkBoard(ownerId);

    const result = check(board);
    expect(result.some).toBe(true);
    if (!result.some) return;
    expect(result.value.playerId).toBe(ownerId);
  });

  // -------------------------------------------------------------------------
  // Board with ships placed but none sunk
  // -------------------------------------------------------------------------
  it("returns none when all ships are placed but none are sunk", () => {
    const empty = createEmptyBoard("player1");
    const placed = autoPlace(empty, FLEET_SPEC);
    const result = check(placed);
    expect(result.some).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Partial sinking — multiple ships sunk but not all
  // -------------------------------------------------------------------------
  it("returns none when Battleship (4 segments) is sunk but rest are intact", () => {
    const empty = createEmptyBoard("player1");
    const placed = autoPlace(empty, FLEET_SPEC);

    const battleship = placed.ships.find((s) => s.type === ShipType.Battleship);
    if (!battleship) throw new Error("No battleship found");

    const board = sinkShip(placed, battleship.cells);
    const result = check(board);
    expect(result.some).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

// Feature: sea-battle-game, Property 10: Victory is declared if and only if all 20 segments are sunk
describe("Property 10: Victory declared iff all 20 segments sunk", () => {
  // Validates: Requirements 9.1, 9.2

  /**
   * Sinks all cells of a ship by firing at each coordinate in sequence.
   * Returns the updated board after all shots.
   */
  function sinkShipOnBoard(board: Board, coords: Coordinate[]): Board {
    let current = board;
    for (const coord of coords) {
      const result = processShot(current, coord);
      if (!result.ok) throw new Error(`processShot failed: ${result.error}`);
      current = result.value.updatedBoard;
    }
    return current;
  }

  /**
   * Counts the total number of sunk segments across all ships on the board.
   */
  function countSunkSegments(board: Board): number {
    return board.ships
      .filter((ship) => ship.sunk)
      .reduce((sum, ship) => sum + ship.cells.length, 0);
  }

  it(
    "check returns Some(winner) iff total sunk segments equals exactly 20, None otherwise",
    () => {
      // Arbitraries
      // Generate a number of ships to sink: 0 to 10 (the full fleet has 10 ships)
      const arbShipsToSink = fc.integer({ min: 0, max: 10 });

      fc.assert(
        fc.property(
          arbShipsToSink,
          (numShipsToSink) => {
            // 1. Generate a board with a full fleet via autoPlace
            const board = autoPlace(createEmptyBoard("player1"), FLEET_SPEC);

            // 2. Sink exactly numShipsToSink ships (chosen from the start of the ships array)
            let currentBoard = board;
            for (let i = 0; i < numShipsToSink; i++) {
              // Use the ship coordinates from the original placed board
              // (ships are ordered consistently; we sink them one by one)
              const shipToSink = board.ships[i];
              currentBoard = sinkShipOnBoard(currentBoard, shipToSink.cells);
            }

            // 3. Count total sunk segments on the resulting board
            const sunkSegments = countSunkSegments(currentBoard);

            // 4. Call check and verify the iff condition
            const result = check(currentBoard);

            if (sunkSegments === 20) {
              // All 20 segments sunk → must return Some(winner)
              if (!result.some) return false;
              // Winner's playerId must match board.ownerId
              if (result.value.playerId !== currentBoard.ownerId) return false;
            } else {
              // Fewer than 20 segments sunk → must return None
              if (result.some) return false;
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "check returns None for any board where sunk segments < 20",
    () => {
      // Sink 0 to 9 ships (guaranteed < 20 segments since at least 1 PatrolBoat = 1 segment remains)
      const arbShipsToSink = fc.integer({ min: 0, max: 9 });

      fc.assert(
        fc.property(
          arbShipsToSink,
          (numShipsToSink) => {
            const board = autoPlace(createEmptyBoard("player1"), FLEET_SPEC);

            let currentBoard = board;
            for (let i = 0; i < numShipsToSink; i++) {
              currentBoard = sinkShipOnBoard(currentBoard, board.ships[i].cells);
            }

            const sunkSegments = countSunkSegments(currentBoard);

            // With 0–9 ships sunk, total sunk segments is at most 19
            // (worst case: sink Battleship(4) + 2×Cruiser(3) + 3×Destroyer(2) + 3×PatrolBoat(1) = 4+6+6+3 = 19)
            // so check must return None
            const result = check(currentBoard);

            // Verify the invariant: sunk < 20 → None
            if (sunkSegments >= 20) {
              // This should not happen when sinking 0–9 ships, but guard for safety
              return true;
            }

            return !result.some;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "check returns Some(winner) when all 10 ships are sunk (all 20 segments)",
    () => {
      fc.assert(
        fc.property(
          fc.constant(null),
          (_) => {
            const board = autoPlace(createEmptyBoard("player2"), FLEET_SPEC);

            // Sink all 10 ships
            let currentBoard = board;
            for (const ship of board.ships) {
              currentBoard = sinkShipOnBoard(currentBoard, ship.cells);
            }

            const sunkSegments = countSunkSegments(currentBoard);
            if (sunkSegments !== 20) return false;

            const result = check(currentBoard);
            if (!result.some) return false;
            if (result.value.playerId !== "player2") return false;

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
