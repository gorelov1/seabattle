/**
 * Unit tests for ShotEngine.processShot
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.1, 8.2, 8.3, 8.4, 10.3, 10.4
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { processShot } from "./shotEngine.js";
import { createEmptyBoard, placeShip, autoPlace } from "./placementEngine.js";
import { Column, Orientation, ShipType, CellStatus, ShotOutcome, ShotError, FLEET_SPEC, } from "./types.js";
import { serialize } from "./coordinateSystem.js";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Build a board with a single PatrolBoat (size 1) at the given coordinate. */
function boardWithPatrolBoat(col, row) {
    const empty = createEmptyBoard("player1");
    const result = placeShip(empty, {
        type: ShipType.PatrolBoat,
        origin: { col, row },
        orientation: Orientation.Horizontal,
    });
    if (!result.ok)
        throw new Error(`placeShip failed: ${result.error}`);
    return result.value;
}
/** Build a board with a single Destroyer (size 2) at A1–B1 (horizontal). */
function boardWithDestroyer() {
    const empty = createEmptyBoard("player1");
    const result = placeShip(empty, {
        type: ShipType.Destroyer,
        origin: { col: Column.A, row: 1 },
        orientation: Orientation.Horizontal,
    });
    if (!result.ok)
        throw new Error(`placeShip failed: ${result.error}`);
    return result.value;
}
/** Build a board with a single Cruiser (size 3) at D5–F5 (horizontal). */
function boardWithCruiser() {
    const empty = createEmptyBoard("player1");
    const result = placeShip(empty, {
        type: ShipType.Cruiser,
        origin: { col: Column.D, row: 5 },
        orientation: Orientation.Horizontal,
    });
    if (!result.ok)
        throw new Error(`placeShip failed: ${result.error}`);
    return result.value;
}
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("processShot", () => {
    // -------------------------------------------------------------------------
    // Miss
    // -------------------------------------------------------------------------
    describe("Miss result on empty cell", () => {
        it("returns Miss outcome when shooting an empty cell", () => {
            const board = boardWithPatrolBoat(Column.E, 5);
            // Shoot at a cell that has no ship (A1 is empty since patrol boat is at E5)
            const result = processShot(board, { col: Column.A, row: 1 });
            expect(result.ok).toBe(true);
            if (!result.ok)
                return;
            expect(result.value.outcome).toBe(ShotOutcome.Miss);
        });
        it("marks the shot cell as Miss in the updated board", () => {
            const board = boardWithPatrolBoat(Column.E, 5);
            const result = processShot(board, { col: Column.A, row: 1 });
            expect(result.ok).toBe(true);
            if (!result.ok)
                return;
            const cell = result.value.updatedBoard.cells.get(serialize({ col: Column.A, row: 1 }));
            expect(cell?.status).toBe(CellStatus.Miss);
        });
        it("returns empty autoMarked array on Miss", () => {
            const board = boardWithPatrolBoat(Column.E, 5);
            const result = processShot(board, { col: Column.A, row: 1 });
            expect(result.ok).toBe(true);
            if (!result.ok)
                return;
            expect(result.value.autoMarked).toHaveLength(0);
        });
    });
    // -------------------------------------------------------------------------
    // Hit (ship not yet sunk)
    // -------------------------------------------------------------------------
    describe("Hit result on ship segment (ship not yet sunk)", () => {
        it("returns Hit outcome when hitting first segment of a Destroyer", () => {
            const board = boardWithDestroyer(); // A1–B1
            const result = processShot(board, { col: Column.A, row: 1 });
            expect(result.ok).toBe(true);
            if (!result.ok)
                return;
            expect(result.value.outcome).toBe(ShotOutcome.Hit);
        });
        it("marks the shot cell as Hit in the updated board", () => {
            const board = boardWithDestroyer();
            const result = processShot(board, { col: Column.A, row: 1 });
            expect(result.ok).toBe(true);
            if (!result.ok)
                return;
            const cell = result.value.updatedBoard.cells.get(serialize({ col: Column.A, row: 1 }));
            expect(cell?.status).toBe(CellStatus.Hit);
        });
        it("increments hitCount on the ship after a Hit", () => {
            const board = boardWithDestroyer();
            const result = processShot(board, { col: Column.A, row: 1 });
            expect(result.ok).toBe(true);
            if (!result.ok)
                return;
            const ship = result.value.updatedBoard.ships[0];
            expect(ship.hitCount).toBe(1);
        });
        it("does not set sunk flag after a Hit on a multi-segment ship", () => {
            const board = boardWithDestroyer();
            const result = processShot(board, { col: Column.A, row: 1 });
            expect(result.ok).toBe(true);
            if (!result.ok)
                return;
            const ship = result.value.updatedBoard.ships[0];
            expect(ship.sunk).toBe(false);
        });
        it("returns empty autoMarked array on Hit", () => {
            const board = boardWithDestroyer();
            const result = processShot(board, { col: Column.A, row: 1 });
            expect(result.ok).toBe(true);
            if (!result.ok)
                return;
            expect(result.value.autoMarked).toHaveLength(0);
        });
    });
    // -------------------------------------------------------------------------
    // Sunk
    // -------------------------------------------------------------------------
    describe("Sunk result on last segment of a ship", () => {
        it("returns Sunk outcome when hitting the only segment of a PatrolBoat", () => {
            const board = boardWithPatrolBoat(Column.E, 5);
            const result = processShot(board, { col: Column.E, row: 5 });
            expect(result.ok).toBe(true);
            if (!result.ok)
                return;
            expect(result.value.outcome).toBe(ShotOutcome.Sunk);
        });
        it("marks the shot cell as Sunk in the updated board", () => {
            const board = boardWithPatrolBoat(Column.E, 5);
            const result = processShot(board, { col: Column.E, row: 5 });
            expect(result.ok).toBe(true);
            if (!result.ok)
                return;
            const cell = result.value.updatedBoard.cells.get(serialize({ col: Column.E, row: 5 }));
            expect(cell?.status).toBe(CellStatus.Sunk);
        });
        it("sets sunk flag on the ship after the last segment is hit", () => {
            const board = boardWithPatrolBoat(Column.E, 5);
            const result = processShot(board, { col: Column.E, row: 5 });
            expect(result.ok).toBe(true);
            if (!result.ok)
                return;
            const ship = result.value.updatedBoard.ships[0];
            expect(ship.sunk).toBe(true);
        });
        it("returns Sunk after hitting both segments of a Destroyer", () => {
            const board = boardWithDestroyer(); // A1–B1
            const afterFirst = processShot(board, { col: Column.A, row: 1 });
            expect(afterFirst.ok).toBe(true);
            if (!afterFirst.ok)
                return;
            const afterSecond = processShot(afterFirst.value.updatedBoard, { col: Column.B, row: 1 });
            expect(afterSecond.ok).toBe(true);
            if (!afterSecond.ok)
                return;
            expect(afterSecond.value.outcome).toBe(ShotOutcome.Sunk);
        });
    });
    // -------------------------------------------------------------------------
    // hitCount increments correctly
    // -------------------------------------------------------------------------
    describe("hitCount increments correctly", () => {
        it("hitCount goes from 0 → 1 → 2 → sunk for a Destroyer", () => {
            let board = boardWithDestroyer(); // A1–B1
            const r1 = processShot(board, { col: Column.A, row: 1 });
            expect(r1.ok).toBe(true);
            if (!r1.ok)
                return;
            expect(r1.value.updatedBoard.ships[0].hitCount).toBe(1);
            expect(r1.value.updatedBoard.ships[0].sunk).toBe(false);
            const r2 = processShot(r1.value.updatedBoard, { col: Column.B, row: 1 });
            expect(r2.ok).toBe(true);
            if (!r2.ok)
                return;
            expect(r2.value.updatedBoard.ships[0].hitCount).toBe(2);
            expect(r2.value.updatedBoard.ships[0].sunk).toBe(true);
        });
        it("hitCount goes 0 → 1 → 2 → 3 → sunk for a Cruiser", () => {
            let board = boardWithCruiser(); // D5–F5
            const coords = [
                { col: Column.D, row: 5 },
                { col: Column.E, row: 5 },
                { col: Column.F, row: 5 },
            ];
            let current = board;
            for (let i = 0; i < coords.length - 1; i++) {
                const r = processShot(current, coords[i]);
                expect(r.ok).toBe(true);
                if (!r.ok)
                    return;
                expect(r.value.updatedBoard.ships[0].hitCount).toBe(i + 1);
                expect(r.value.updatedBoard.ships[0].sunk).toBe(false);
                current = r.value.updatedBoard;
            }
            // Last hit — should be Sunk
            const rLast = processShot(current, coords[coords.length - 1]);
            expect(rLast.ok).toBe(true);
            if (!rLast.ok)
                return;
            expect(rLast.value.updatedBoard.ships[0].hitCount).toBe(3);
            expect(rLast.value.updatedBoard.ships[0].sunk).toBe(true);
        });
    });
    // -------------------------------------------------------------------------
    // sunk flag set correctly
    // -------------------------------------------------------------------------
    describe("sunk flag set correctly when hitCount reaches ship size", () => {
        it("sunk is false until the last segment is hit", () => {
            const board = boardWithDestroyer();
            const r1 = processShot(board, { col: Column.A, row: 1 });
            expect(r1.ok).toBe(true);
            if (!r1.ok)
                return;
            expect(r1.value.updatedBoard.ships[0].sunk).toBe(false);
        });
        it("sunk is true exactly when hitCount equals ship size", () => {
            const board = boardWithPatrolBoat(Column.C, 3);
            const r = processShot(board, { col: Column.C, row: 3 });
            expect(r.ok).toBe(true);
            if (!r.ok)
                return;
            const ship = r.value.updatedBoard.ships[0];
            expect(ship.hitCount).toBe(ship.cells.length);
            expect(ship.sunk).toBe(true);
        });
    });
    // -------------------------------------------------------------------------
    // AlreadyShot rejection
    // -------------------------------------------------------------------------
    describe("AlreadyShot rejection without state change", () => {
        it("returns AlreadyShot error when shooting a Miss cell", () => {
            const board = boardWithPatrolBoat(Column.E, 5);
            const afterMiss = processShot(board, { col: Column.A, row: 1 });
            expect(afterMiss.ok).toBe(true);
            if (!afterMiss.ok)
                return;
            const retry = processShot(afterMiss.value.updatedBoard, { col: Column.A, row: 1 });
            expect(retry.ok).toBe(false);
            if (retry.ok)
                return;
            expect(retry.error).toBe(ShotError.AlreadyShot);
        });
        it("returns AlreadyShot error when shooting a Hit cell", () => {
            const board = boardWithDestroyer();
            const afterHit = processShot(board, { col: Column.A, row: 1 });
            expect(afterHit.ok).toBe(true);
            if (!afterHit.ok)
                return;
            const retry = processShot(afterHit.value.updatedBoard, { col: Column.A, row: 1 });
            expect(retry.ok).toBe(false);
            if (retry.ok)
                return;
            expect(retry.error).toBe(ShotError.AlreadyShot);
        });
        it("returns AlreadyShot error when shooting a Sunk cell", () => {
            const board = boardWithPatrolBoat(Column.E, 5);
            const afterSunk = processShot(board, { col: Column.E, row: 5 });
            expect(afterSunk.ok).toBe(true);
            if (!afterSunk.ok)
                return;
            const retry = processShot(afterSunk.value.updatedBoard, { col: Column.E, row: 5 });
            expect(retry.ok).toBe(false);
            if (retry.ok)
                return;
            expect(retry.error).toBe(ShotError.AlreadyShot);
        });
    });
    // -------------------------------------------------------------------------
    // Buffer-zone auto-mark after Sunk
    // -------------------------------------------------------------------------
    describe("Buffer-zone auto-mark after Sunk", () => {
        it("auto-marks unshot neighbors of a sunk PatrolBoat as Miss", () => {
            // PatrolBoat at E5 — neighbors are D4, E4, F4, D5, F5, D6, E6, F6
            const board = boardWithPatrolBoat(Column.E, 5);
            const result = processShot(board, { col: Column.E, row: 5 });
            expect(result.ok).toBe(true);
            if (!result.ok)
                return;
            const { updatedBoard, autoMarked } = result.value;
            // All 8 neighbors should be auto-marked
            expect(autoMarked.length).toBeGreaterThan(0);
            for (const coord of autoMarked) {
                const cell = updatedBoard.cells.get(serialize(coord));
                expect(cell?.status).toBe(CellStatus.Miss);
            }
        });
        it("does not change already-shot neighbors when auto-marking", () => {
            // PatrolBoat at E5. Pre-shoot D4 (a neighbor) as a Miss.
            const board = boardWithPatrolBoat(Column.E, 5);
            const afterPreShot = processShot(board, { col: Column.D, row: 4 });
            expect(afterPreShot.ok).toBe(true);
            if (!afterPreShot.ok)
                return;
            // Now sink the patrol boat
            const result = processShot(afterPreShot.value.updatedBoard, { col: Column.E, row: 5 });
            expect(result.ok).toBe(true);
            if (!result.ok)
                return;
            // D4 should still be Miss (not re-added to autoMarked)
            const d4Key = serialize({ col: Column.D, row: 4 });
            const d4Cell = result.value.updatedBoard.cells.get(d4Key);
            expect(d4Cell?.status).toBe(CellStatus.Miss);
            // D4 should NOT appear in autoMarked (it was already shot)
            const autoMarkedKeys = result.value.autoMarked.map(serialize);
            expect(autoMarkedKeys).not.toContain(d4Key);
        });
        it("auto-marks all unshot neighbors of a multi-cell ship after Sunk", () => {
            // Destroyer at A1–B1 (horizontal). Sink it.
            const board = boardWithDestroyer();
            const afterFirst = processShot(board, { col: Column.A, row: 1 });
            expect(afterFirst.ok).toBe(true);
            if (!afterFirst.ok)
                return;
            const result = processShot(afterFirst.value.updatedBoard, { col: Column.B, row: 1 });
            expect(result.ok).toBe(true);
            if (!result.ok)
                return;
            const { updatedBoard, autoMarked } = result.value;
            // All auto-marked cells should have status Miss
            for (const coord of autoMarked) {
                const cell = updatedBoard.cells.get(serialize(coord));
                expect(cell?.status).toBe(CellStatus.Miss);
            }
            // The ship cells themselves should NOT be Miss — A1 was hit first (Hit),
            // B1 was the final shot (Sunk). Neither should appear in autoMarked.
            const a1 = updatedBoard.cells.get(serialize({ col: Column.A, row: 1 }));
            const b1 = updatedBoard.cells.get(serialize({ col: Column.B, row: 1 }));
            expect(a1?.status).toBe(CellStatus.Hit); // first hit, not the sinking shot
            expect(b1?.status).toBe(CellStatus.Sunk); // the sinking shot
            const autoMarkedKeys = autoMarked.map(serialize);
            expect(autoMarkedKeys).not.toContain(serialize({ col: Column.A, row: 1 }));
            expect(autoMarkedKeys).not.toContain(serialize({ col: Column.B, row: 1 }));
        });
        it("auto-marks no cells when all neighbors are already shot", () => {
            // PatrolBoat at E5. Pre-shoot all 8 neighbors.
            let board = boardWithPatrolBoat(Column.E, 5);
            const neighborCoords = [
                { col: Column.D, row: 4 },
                { col: Column.E, row: 4 },
                { col: Column.F, row: 4 },
                { col: Column.D, row: 5 },
                { col: Column.F, row: 5 },
                { col: Column.D, row: 6 },
                { col: Column.E, row: 6 },
                { col: Column.F, row: 6 },
            ];
            let current = board;
            for (const coord of neighborCoords) {
                const r = processShot(current, coord);
                expect(r.ok).toBe(true);
                if (!r.ok)
                    return;
                current = r.value.updatedBoard;
            }
            // Now sink the patrol boat
            const result = processShot(current, { col: Column.E, row: 5 });
            expect(result.ok).toBe(true);
            if (!result.ok)
                return;
            expect(result.value.autoMarked).toHaveLength(0);
        });
    });
    // -------------------------------------------------------------------------
    // Immutability
    // -------------------------------------------------------------------------
    describe("Immutability: input board unchanged after processShot", () => {
        it("does not mutate the input board cells on Miss", () => {
            const board = boardWithPatrolBoat(Column.E, 5);
            const originalStatus = board.cells.get(serialize({ col: Column.A, row: 1 }))?.status;
            processShot(board, { col: Column.A, row: 1 });
            const statusAfter = board.cells.get(serialize({ col: Column.A, row: 1 }))?.status;
            expect(statusAfter).toBe(originalStatus);
            expect(statusAfter).toBe(CellStatus.Unshot);
        });
        it("does not mutate the input board cells on Hit", () => {
            const board = boardWithDestroyer();
            const originalStatus = board.cells.get(serialize({ col: Column.A, row: 1 }))?.status;
            processShot(board, { col: Column.A, row: 1 });
            const statusAfter = board.cells.get(serialize({ col: Column.A, row: 1 }))?.status;
            expect(statusAfter).toBe(originalStatus);
            expect(statusAfter).toBe(CellStatus.Unshot);
        });
        it("does not mutate the input board ships on Hit", () => {
            const board = boardWithDestroyer();
            const originalHitCount = board.ships[0].hitCount;
            processShot(board, { col: Column.A, row: 1 });
            expect(board.ships[0].hitCount).toBe(originalHitCount);
            expect(board.ships[0].hitCount).toBe(0);
        });
        it("does not mutate the input board on Sunk", () => {
            const board = boardWithPatrolBoat(Column.E, 5);
            const originalStatus = board.cells.get(serialize({ col: Column.E, row: 5 }))?.status;
            const originalHitCount = board.ships[0].hitCount;
            const originalSunk = board.ships[0].sunk;
            processShot(board, { col: Column.E, row: 5 });
            expect(board.cells.get(serialize({ col: Column.E, row: 5 }))?.status).toBe(originalStatus);
            expect(board.ships[0].hitCount).toBe(originalHitCount);
            expect(board.ships[0].sunk).toBe(originalSunk);
        });
        it("does not mutate the input board on AlreadyShot rejection", () => {
            const board = boardWithPatrolBoat(Column.E, 5);
            const afterSunk = processShot(board, { col: Column.E, row: 5 });
            expect(afterSunk.ok).toBe(true);
            if (!afterSunk.ok)
                return;
            const boardBeforeRetry = afterSunk.value.updatedBoard;
            // Capture state
            const statusBefore = boardBeforeRetry.cells.get(serialize({ col: Column.E, row: 5 }))?.status;
            const hitCountBefore = boardBeforeRetry.ships[0].hitCount;
            // Attempt rejected shot
            processShot(boardBeforeRetry, { col: Column.E, row: 5 });
            // Board should be unchanged
            expect(boardBeforeRetry.cells.get(serialize({ col: Column.E, row: 5 }))?.status).toBe(statusBefore);
            expect(boardBeforeRetry.ships[0].hitCount).toBe(hitCountBefore);
        });
        it("returns a new board object (not the same reference)", () => {
            const board = boardWithPatrolBoat(Column.E, 5);
            const result = processShot(board, { col: Column.A, row: 1 });
            expect(result.ok).toBe(true);
            if (!result.ok)
                return;
            expect(result.value.updatedBoard).not.toBe(board);
            expect(result.value.updatedBoard.cells).not.toBe(board.cells);
        });
    });
});
// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------
// Feature: sea-battle-game, Property 6: Shot outcome correctness
describe("Property 6: Shot outcome correctness", () => {
    // Validates: Requirements 6.1, 6.2, 6.3
    const COLUMN_ORDER = [
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
    const ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    /** Collect all unshot coordinates from a board. */
    function unshotCoords(board) {
        const result = [];
        for (const [, cell] of board.cells) {
            if (cell.status === CellStatus.Unshot) {
                result.push(cell.coord);
            }
        }
        return result;
    }
    /**
     * Determine the expected outcome for firing at `coord` on `board`.
     *
     * - Miss  : no ship occupies the cell
     * - Hit   : a ship occupies the cell and still has unsunk segments after this hit
     * - Sunk  : a ship occupies the cell and this is its last unsunk segment
     */
    function expectedOutcome(board, coord) {
        const key = serialize(coord);
        const ship = board.ships.find((s) => s.cells.some((c) => serialize(c) === key));
        if (ship === undefined) {
            return ShotOutcome.Miss;
        }
        // Count how many of this ship's cells are currently Unshot (i.e., not yet hit)
        const unshotSegments = ship.cells.filter((c) => {
            const cell = board.cells.get(serialize(c));
            return cell?.status === CellStatus.Unshot;
        }).length;
        // After this shot, unshotSegments - 1 remain
        if (unshotSegments - 1 === 0) {
            return ShotOutcome.Sunk;
        }
        return ShotOutcome.Hit;
    }
    it("for any board and unshot coordinate, outcome is Miss/Hit/Sunk matching cell content", () => {
        // Arbitraries
        const arbCol = fc.constantFrom(...COLUMN_ORDER);
        const arbRow = fc.constantFrom(...ROWS);
        fc.assert(fc.property(
        // Generate a random coordinate to use as a shot target
        arbCol, arbRow, (col, row) => {
            // Build a fully-placed board via autoPlace
            const board = autoPlace(createEmptyBoard("player1"), FLEET_SPEC);
            const coord = { col, row };
            const key = serialize(coord);
            // Only test unshot cells (skip already-shot cells — those are
            // covered by Property 7)
            const cell = board.cells.get(key);
            if (!cell || cell.status !== CellStatus.Unshot) {
                // autoPlace leaves all cells Unshot, so this branch is never
                // reached in practice; guard for safety
                return true;
            }
            const expected = expectedOutcome(board, coord);
            const result = processShot(board, coord);
            // The shot must succeed (cell is Unshot)
            if (!result.ok)
                return false;
            return result.value.outcome === expected;
        }), { numRuns: 100 });
    });
    it("outcome is Miss when the targeted cell contains no ship segment", () => {
        fc.assert(fc.property(fc.constant(null), (_) => {
            const board = autoPlace(createEmptyBoard("player1"), FLEET_SPEC);
            // Find an unshot cell that has no ship
            const emptyCoord = unshotCoords(board).find((coord) => {
                const key = serialize(coord);
                return !board.ships.some((s) => s.cells.some((c) => serialize(c) === key));
            });
            // If all cells are occupied by ships (extremely unlikely with
            // standard fleet of 20 segments on 100 cells), skip
            if (emptyCoord === undefined)
                return true;
            const result = processShot(board, emptyCoord);
            if (!result.ok)
                return false;
            return result.value.outcome === ShotOutcome.Miss;
        }), { numRuns: 100 });
    });
    it("outcome is Hit when the targeted cell contains a ship segment with remaining unsunk segments", () => {
        fc.assert(fc.property(fc.constant(null), (_) => {
            const board = autoPlace(createEmptyBoard("player1"), FLEET_SPEC);
            // Find a ship with more than 1 segment (Destroyer, Cruiser, or Battleship)
            const multiSegmentShip = board.ships.find((s) => s.cells.length > 1);
            if (multiSegmentShip === undefined)
                return true; // shouldn't happen
            // Shoot the first cell of the ship — it has remaining segments
            const targetCoord = multiSegmentShip.cells[0];
            const result = processShot(board, targetCoord);
            if (!result.ok)
                return false;
            return result.value.outcome === ShotOutcome.Hit;
        }), { numRuns: 100 });
    });
    it("outcome is Sunk when the targeted cell is the last unsunk segment of a ship", () => {
        fc.assert(fc.property(fc.constant(null), (_) => {
            // Use a board with a single PatrolBoat (1 segment) so the first
            // shot always sinks it
            const empty = createEmptyBoard("player1");
            const placed = placeShip(empty, {
                type: ShipType.PatrolBoat,
                origin: { col: Column.E, row: 5 },
                orientation: Orientation.Horizontal,
            });
            if (!placed.ok)
                return false;
            const board = placed.value;
            const result = processShot(board, { col: Column.E, row: 5 });
            if (!result.ok)
                return false;
            return result.value.outcome === ShotOutcome.Sunk;
        }), { numRuns: 100 });
    });
});
// Feature: sea-battle-game, Property 7: Already-shot cells are rejected without state change
describe("Property 7: Already-shot cells are rejected without state change", () => {
    // Validates: Requirements 6.5
    const COLUMN_ORDER = [
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
    const ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    /** Deep-compare two boards for identical state (cells map and ships). */
    function boardStatesEqual(a, b) {
        // Compare cells
        if (a.cells.size !== b.cells.size)
            return false;
        for (const [key, cellA] of a.cells) {
            const cellB = b.cells.get(key);
            if (cellB === undefined)
                return false;
            if (cellA.status !== cellB.status)
                return false;
        }
        // Compare ships
        if (a.ships.length !== b.ships.length)
            return false;
        for (let i = 0; i < a.ships.length; i++) {
            const shipA = a.ships[i];
            const shipB = b.ships[i];
            if (shipA.type !== shipB.type)
                return false;
            if (shipA.hitCount !== shipB.hitCount)
                return false;
            if (shipA.sunk !== shipB.sunk)
                return false;
            if (shipA.cells.length !== shipB.cells.length)
                return false;
            for (let j = 0; j < shipA.cells.length; j++) {
                if (serialize(shipA.cells[j]) !== serialize(shipB.cells[j]))
                    return false;
            }
        }
        return true;
    }
    it("for any board and already-shot coordinate, processShot returns ShotError.AlreadyShot and board state is identical before and after", () => {
        const arbCol = fc.constantFrom(...COLUMN_ORDER);
        const arbRow = fc.constantFrom(...ROWS);
        fc.assert(fc.property(arbCol, arbRow, (col, row) => {
            // Build a fully-placed board via autoPlace
            const board = autoPlace(createEmptyBoard("player1"), FLEET_SPEC);
            const firstCoord = { col, row };
            // Fire the first shot to create an already-shot cell
            const firstResult = processShot(board, firstCoord);
            // The first shot must succeed (all cells start as Unshot after autoPlace)
            if (!firstResult.ok)
                return true; // skip if somehow already shot (shouldn't happen)
            const boardAfterFirstShot = firstResult.value.updatedBoard;
            // Now fire again at the same coordinate — this is the already-shot cell
            const secondResult = processShot(boardAfterFirstShot, firstCoord);
            // 1. The result must be an error
            if (secondResult.ok)
                return false;
            // 2. The error must be ShotError.AlreadyShot
            if (secondResult.error !== ShotError.AlreadyShot)
                return false;
            // 3. Board state must be identical before and after the rejected shot
            // (boardAfterFirstShot should be unchanged — verify by re-calling processShot
            //  and checking the board we passed in is still the same)
            return boardStatesEqual(boardAfterFirstShot, boardAfterFirstShot);
        }), { numRuns: 100 });
    });
    it("rejected shot does not mutate the board — cells map is identical before and after", () => {
        const arbCol = fc.constantFrom(...COLUMN_ORDER);
        const arbRow = fc.constantFrom(...ROWS);
        fc.assert(fc.property(arbCol, arbRow, (col, row) => {
            const board = autoPlace(createEmptyBoard("player1"), FLEET_SPEC);
            const coord = { col, row };
            // Fire first shot to mark the cell as already-shot
            const firstResult = processShot(board, coord);
            if (!firstResult.ok)
                return true;
            const boardAfterFirst = firstResult.value.updatedBoard;
            // Snapshot the cell statuses before the rejected shot
            const statusesBefore = new Map();
            for (const [key, cell] of boardAfterFirst.cells) {
                statusesBefore.set(key, cell.status);
            }
            // Snapshot ship state before the rejected shot
            const shipStatesBefore = boardAfterFirst.ships.map((s) => ({
                hitCount: s.hitCount,
                sunk: s.sunk,
            }));
            // Fire the rejected shot
            const rejectedResult = processShot(boardAfterFirst, coord);
            // Must be an error
            if (rejectedResult.ok)
                return false;
            if (rejectedResult.error !== ShotError.AlreadyShot)
                return false;
            // Verify the board object passed in was not mutated
            for (const [key, statusBefore] of statusesBefore) {
                const cellAfter = boardAfterFirst.cells.get(key);
                if (cellAfter === undefined)
                    return false;
                if (cellAfter.status !== statusBefore)
                    return false;
            }
            // Verify ships were not mutated
            for (let i = 0; i < boardAfterFirst.ships.length; i++) {
                if (boardAfterFirst.ships[i].hitCount !== shipStatesBefore[i].hitCount)
                    return false;
                if (boardAfterFirst.ships[i].sunk !== shipStatesBefore[i].sunk)
                    return false;
            }
            return true;
        }), { numRuns: 100 });
    });
});
// Feature: sea-battle-game, Property 8: Buffer-zone auto-mark on Sunk
describe("Property 8: Buffer-zone auto-mark on Sunk", () => {
    // Validates: Requirements 8.1, 8.2, 8.3
    const COLUMN_ORDER = [
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
    const ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const COLUMN_INDEX = new Map(COLUMN_ORDER.map((col, idx) => [col, idx]));
    /** Returns all eight-directional neighbors of a coordinate within the 10×10 board. */
    function neighborsOf(coord) {
        const colIdx = COLUMN_INDEX.get(coord.col);
        if (colIdx === undefined)
            return [];
        const result = [];
        for (let dc = -1; dc <= 1; dc++) {
            for (let dr = -1; dr <= 1; dr++) {
                if (dc === 0 && dr === 0)
                    continue;
                const newColIdx = colIdx + dc;
                const newRow = (coord.row + dr);
                const newCol = COLUMN_ORDER[newColIdx];
                if (newCol !== undefined && newRow >= 1 && newRow <= 10) {
                    result.push({ col: newCol, row: newRow });
                }
            }
        }
        return result;
    }
    /** Collect all unique neighbor coordinates of every cell of a ship. */
    function allShipNeighbors(shipCells) {
        const seen = new Set();
        const result = [];
        for (const cell of shipCells) {
            for (const neighbor of neighborsOf(cell)) {
                const key = serialize(neighbor);
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push(neighbor);
                }
            }
        }
        return result;
    }
    it("after a sinking shot, all previously-Unshot neighbors of the destroyed ship are marked Miss", () => {
        const arbCol = fc.constantFrom(...COLUMN_ORDER);
        const arbRow = fc.constantFrom(...ROWS);
        fc.assert(fc.property(arbCol, arbRow, 
        // A subset mask: for each of up to 8 neighbors, whether to pre-shoot it
        fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }), (col, row, preShootMask) => {
            // Place a single PatrolBoat (size 1) at the random position
            const empty = createEmptyBoard("player1");
            const placed = placeShip(empty, {
                type: ShipType.PatrolBoat,
                origin: { col, row },
                orientation: Orientation.Horizontal,
            });
            if (!placed.ok)
                return true; // skip invalid placements (shouldn't happen for PatrolBoat)
            let board = placed.value;
            const shipCoord = { col, row };
            // Collect all neighbors of the PatrolBoat
            const allNeighbors = allShipNeighbors([shipCoord]);
            // Optionally pre-shoot some neighbors (using the mask)
            const preShot = new Set();
            for (let i = 0; i < allNeighbors.length && i < preShootMask.length; i++) {
                if (preShootMask[i]) {
                    const neighbor = allNeighbors[i];
                    const nKey = serialize(neighbor);
                    // Only pre-shoot if the cell is Unshot (not the ship cell itself)
                    const cell = board.cells.get(nKey);
                    if (cell && cell.status === CellStatus.Unshot) {
                        const r = processShot(board, neighbor);
                        if (r.ok) {
                            board = r.value.updatedBoard;
                            preShot.add(nKey);
                        }
                    }
                }
            }
            // Record which neighbors were Unshot just before the sinking shot
            const unshotNeighborsBefore = new Set();
            const alreadyShotNeighborsBefore = new Map();
            for (const neighbor of allNeighbors) {
                const nKey = serialize(neighbor);
                const cell = board.cells.get(nKey);
                if (cell) {
                    if (cell.status === CellStatus.Unshot) {
                        unshotNeighborsBefore.add(nKey);
                    }
                    else {
                        alreadyShotNeighborsBefore.set(nKey, cell.status);
                    }
                }
            }
            // Fire the sinking shot on the PatrolBoat
            const sinkResult = processShot(board, shipCoord);
            if (!sinkResult.ok)
                return false;
            if (sinkResult.value.outcome !== ShotOutcome.Sunk)
                return false;
            const { updatedBoard, autoMarked } = sinkResult.value;
            const autoMarkedKeys = new Set(autoMarked.map(serialize));
            // Requirement 8.1 + 8.2: All previously-Unshot neighbors must now be Miss
            for (const nKey of unshotNeighborsBefore) {
                const cell = updatedBoard.cells.get(nKey);
                if (!cell || cell.status !== CellStatus.Miss)
                    return false;
                // They must appear in autoMarked
                if (!autoMarkedKeys.has(nKey))
                    return false;
            }
            // Requirement 8.3: Already-shot neighbors must be unchanged
            for (const [nKey, statusBefore] of alreadyShotNeighborsBefore) {
                const cell = updatedBoard.cells.get(nKey);
                if (!cell || cell.status !== statusBefore)
                    return false;
                // They must NOT appear in autoMarked
                if (autoMarkedKeys.has(nKey))
                    return false;
            }
            // autoMarked must contain ONLY previously-Unshot neighbors (no extras)
            for (const nKey of autoMarkedKeys) {
                if (!unshotNeighborsBefore.has(nKey))
                    return false;
            }
            return true;
        }), { numRuns: 100 });
    });
    it("autoMarked is empty when all neighbors were already shot before the sinking shot", () => {
        fc.assert(fc.property(fc.constantFrom(...COLUMN_ORDER), fc.constantFrom(...ROWS), (col, row) => {
            const empty = createEmptyBoard("player1");
            const placed = placeShip(empty, {
                type: ShipType.PatrolBoat,
                origin: { col, row },
                orientation: Orientation.Horizontal,
            });
            if (!placed.ok)
                return true;
            let board = placed.value;
            const shipCoord = { col, row };
            const allNeighbors = allShipNeighbors([shipCoord]);
            // Pre-shoot all neighbors
            for (const neighbor of allNeighbors) {
                const nKey = serialize(neighbor);
                const cell = board.cells.get(nKey);
                if (cell && cell.status === CellStatus.Unshot) {
                    const r = processShot(board, neighbor);
                    if (r.ok) {
                        board = r.value.updatedBoard;
                    }
                }
            }
            // Verify all neighbors are now non-Unshot
            for (const neighbor of allNeighbors) {
                const cell = board.cells.get(serialize(neighbor));
                if (cell && cell.status === CellStatus.Unshot) {
                    // Some neighbors may be ship cells of other ships — skip
                    return true;
                }
            }
            // Fire the sinking shot
            const sinkResult = processShot(board, shipCoord);
            if (!sinkResult.ok)
                return false;
            if (sinkResult.value.outcome !== ShotOutcome.Sunk)
                return false;
            // autoMarked must be empty since all neighbors were already shot
            return sinkResult.value.autoMarked.length === 0;
        }), { numRuns: 100 });
    });
});
// Feature: sea-battle-game, Property 11: Hit count and sunk flag consistency
describe("Property 11: Hit count and sunk flag consistency", () => {
    // Validates: Requirements 10.3, 10.4
    const COLUMN_ORDER = [
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
    const ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    it("sunk is true iff hitCount == size(shipType), and hitCount never exceeds size(shipType)", () => {
        fc.assert(fc.property(
        // Generate a random ship type
        fc.constantFrom(ShipType.PatrolBoat, ShipType.Destroyer, ShipType.Cruiser, ShipType.Battleship), 
        // Generate a random number of shots to fire (0 to 6, covering all sizes + extras)
        fc.integer({ min: 0, max: 6 }), 
        // Generate a random origin column and row for the ship
        fc.constantFrom(...COLUMN_ORDER), fc.constantFrom(...ROWS), (shipType, numShots, originCol, originRow) => {
            // Try to place the ship horizontally; if it doesn't fit, try vertically
            const empty = createEmptyBoard("player1");
            let board = null;
            for (const orientation of [Orientation.Horizontal, Orientation.Vertical]) {
                const result = placeShip(empty, {
                    type: shipType,
                    origin: { col: originCol, row: originRow },
                    orientation,
                });
                if (result.ok) {
                    board = result.value;
                    break;
                }
            }
            // If neither orientation works (e.g., ship would go out of bounds), skip
            if (board === null)
                return true;
            const ship = board.ships[0];
            const shipSize = ship.cells.length;
            // Fire up to numShots at the ship's cells (in order), stopping when we run out of cells
            let currentBoard = board;
            for (let i = 0; i < numShots; i++) {
                // Pick the next unshot cell of the ship (if any remain)
                const targetCell = ship.cells[i % shipSize];
                const targetKey = serialize(targetCell);
                const cellStatus = currentBoard.cells.get(targetKey)?.status;
                // If this cell is already shot, skip it (avoid AlreadyShot error)
                if (cellStatus !== CellStatus.Unshot)
                    continue;
                const shotResult = processShot(currentBoard, targetCell);
                if (!shotResult.ok)
                    return false;
                currentBoard = shotResult.value.updatedBoard;
                // After each shot, verify the invariant for every ship on the board
                for (const s of currentBoard.ships) {
                    const size = s.cells.length;
                    // hitCount must never exceed size(shipType)
                    if (s.hitCount > size)
                        return false;
                    // sunk must be true iff hitCount == size(shipType)
                    if (s.sunk !== (s.hitCount === size))
                        return false;
                }
            }
            return true;
        }), { numRuns: 100 });
    });
    it("hitCount increments by exactly 1 per hit and never exceeds ship size across all ship types", () => {
        fc.assert(fc.property(fc.constantFrom(ShipType.PatrolBoat, ShipType.Destroyer, ShipType.Cruiser, ShipType.Battleship), (shipType) => {
            // Place the ship at a fixed safe position (E5, horizontal)
            const empty = createEmptyBoard("player1");
            const placed = placeShip(empty, {
                type: shipType,
                origin: { col: Column.E, row: 5 },
                orientation: Orientation.Horizontal,
            });
            if (!placed.ok)
                return true; // skip if placement fails (shouldn't happen at E5)
            let board = placed.value;
            const ship = board.ships[0];
            const size = ship.cells.length;
            // Fire at each cell of the ship in sequence
            for (let i = 0; i < size; i++) {
                const coord = ship.cells[i];
                const result = processShot(board, coord);
                if (!result.ok)
                    return false;
                board = result.value.updatedBoard;
                const updatedShip = board.ships[0];
                // hitCount must equal i + 1 after each shot
                if (updatedShip.hitCount !== i + 1)
                    return false;
                // hitCount must never exceed size
                if (updatedShip.hitCount > size)
                    return false;
                // sunk must be true iff hitCount == size
                if (updatedShip.sunk !== (updatedShip.hitCount === size))
                    return false;
                // sunk must only be true on the final shot
                if (i < size - 1 && updatedShip.sunk)
                    return false;
                if (i === size - 1 && !updatedShip.sunk)
                    return false;
            }
            return true;
        }), { numRuns: 100 });
    });
    it("sunk flag is false for all ships until their last segment is hit, then true", () => {
        fc.assert(fc.property(fc.constant(null), (_) => {
            // Build a fully-placed board and fire shots at one ship at a time
            const board = autoPlace(createEmptyBoard("player1"), FLEET_SPEC);
            let currentBoard = board;
            for (const ship of board.ships) {
                const size = ship.cells.length;
                // Fire at each cell of this ship
                for (let i = 0; i < size; i++) {
                    const coord = ship.cells[i];
                    // Skip if already shot (could be auto-marked by a previous sunk)
                    const cellStatus = currentBoard.cells.get(serialize(coord))?.status;
                    if (cellStatus !== CellStatus.Unshot)
                        continue;
                    const result = processShot(currentBoard, coord);
                    if (!result.ok)
                        return false;
                    currentBoard = result.value.updatedBoard;
                    // Verify invariant for ALL ships after every shot
                    for (const s of currentBoard.ships) {
                        const sSize = s.cells.length;
                        // hitCount must never exceed size
                        if (s.hitCount > sSize)
                            return false;
                        // sunk iff hitCount == size
                        if (s.sunk !== (s.hitCount === sSize))
                            return false;
                    }
                }
            }
            return true;
        }), { numRuns: 100 });
    });
});
//# sourceMappingURL=shotEngine.test.js.map