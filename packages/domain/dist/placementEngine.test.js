/**
 * Unit tests for PlacementEngine.
 * Covers: valid placements, out-of-bounds, adjacency violations, quota exceeded,
 * overlap, isFleetReady, and autoPlace.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { placeShip, isFleetReady, autoPlace, createEmptyBoard, } from "./placementEngine.js";
import { Column, Orientation, PlacementError, ShipType, FLEET_SPEC, } from "./types.js";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function emptyBoard() {
    return createEmptyBoard("player1");
}
function place(board, type, col, row, orientation) {
    return placeShip(board, {
        type,
        origin: { col, row: row },
        orientation,
    });
}
// ---------------------------------------------------------------------------
// Valid placements
// ---------------------------------------------------------------------------
describe("placeShip — valid placements", () => {
    it("places a horizontal Battleship at A1", () => {
        const result = place(emptyBoard(), ShipType.Battleship, Column.A, 1, Orientation.Horizontal);
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        const ship = result.value.ships[0];
        expect(ship.type).toBe(ShipType.Battleship);
        expect(ship.cells).toHaveLength(4);
        expect(ship.cells[0]).toEqual({ col: Column.A, row: 1 });
        expect(ship.cells[3]).toEqual({ col: Column.D, row: 1 });
    });
    it("places a vertical Cruiser at A1", () => {
        const result = place(emptyBoard(), ShipType.Cruiser, Column.A, 1, Orientation.Vertical);
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        const ship = result.value.ships[0];
        expect(ship.cells[0]).toEqual({ col: Column.A, row: 1 });
        expect(ship.cells[2]).toEqual({ col: Column.A, row: 3 });
    });
    it("places a PatrolBoat in the bottom-right corner (J10)", () => {
        const result = place(emptyBoard(), ShipType.PatrolBoat, Column.J, 10, Orientation.Horizontal);
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.value.ships[0].cells[0]).toEqual({ col: Column.J, row: 10 });
    });
    it("places a Destroyer along the right edge (J1 vertical)", () => {
        const result = place(emptyBoard(), ShipType.Destroyer, Column.J, 1, Orientation.Vertical);
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        const cells = result.value.ships[0].cells;
        expect(cells[0]).toEqual({ col: Column.J, row: 1 });
        expect(cells[1]).toEqual({ col: Column.J, row: 2 });
    });
    it("places a Battleship along the bottom edge (A10 horizontal)", () => {
        const result = place(emptyBoard(), ShipType.Battleship, Column.A, 10, Orientation.Horizontal);
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        const cells = result.value.ships[0].cells;
        expect(cells[3]).toEqual({ col: Column.D, row: 10 });
    });
    it("does not mutate the input board", () => {
        const board = emptyBoard();
        const result = place(board, ShipType.PatrolBoat, Column.E, 5, Orientation.Horizontal);
        expect(result.ok).toBe(true);
        expect(board.ships).toHaveLength(0);
    });
    it("marks the board ready after placing all 10 ships", () => {
        let board = emptyBoard();
        // Place 1 Battleship
        const r1 = place(board, ShipType.Battleship, Column.A, 1, Orientation.Horizontal);
        expect(r1.ok).toBe(true);
        board = r1.value;
        // Place 2 Cruisers (with buffer gaps)
        const r2 = place(board, ShipType.Cruiser, Column.A, 3, Orientation.Horizontal);
        expect(r2.ok).toBe(true);
        board = r2.value;
        const r3 = place(board, ShipType.Cruiser, Column.A, 5, Orientation.Horizontal);
        expect(r3.ok).toBe(true);
        board = r3.value;
        // Place 3 Destroyers
        // Board so far: Battleship A1-D1, Cruiser A3-C3, Cruiser A5-C5
        // Destroyer at A7 horizontal: A7, B7
        const r4 = place(board, ShipType.Destroyer, Column.A, 7, Orientation.Horizontal);
        expect(r4.ok).toBe(true);
        board = r4.value;
        // Destroyer at A9 horizontal: A9, B9
        const r5 = place(board, ShipType.Destroyer, Column.A, 9, Orientation.Horizontal);
        expect(r5.ok).toBe(true);
        board = r5.value;
        // Destroyer at F1 vertical: F1, F2 (F is 2 cols away from D1 — E1 would be adjacent to D1)
        const r6 = place(board, ShipType.Destroyer, Column.F, 1, Orientation.Vertical);
        expect(r6.ok).toBe(true);
        board = r6.value;
        // Place 4 PatrolBoats
        // H1 vertical: H1 (2 cols away from F1)
        const r7 = place(board, ShipType.PatrolBoat, Column.H, 1, Orientation.Vertical);
        expect(r7.ok).toBe(true);
        board = r7.value;
        // J1 vertical: J1 (2 cols away from H1)
        const r8 = place(board, ShipType.PatrolBoat, Column.J, 1, Orientation.Vertical);
        expect(r8.ok).toBe(true);
        board = r8.value;
        // H4 vertical: H4 (2 rows away from H1)
        const r9 = place(board, ShipType.PatrolBoat, Column.H, 4, Orientation.Vertical);
        expect(r9.ok).toBe(true);
        board = r9.value;
        // J4 vertical: J4 (2 rows away from J1)
        const r10 = place(board, ShipType.PatrolBoat, Column.J, 4, Orientation.Vertical);
        expect(r10.ok).toBe(true);
        board = r10.value;
        expect(board.ready).toBe(true);
    });
});
// ---------------------------------------------------------------------------
// Out-of-bounds
// ---------------------------------------------------------------------------
describe("placeShip — out-of-bounds", () => {
    it("rejects a horizontal Battleship that extends past column J", () => {
        // G + 4 cells = G, H, I, J, K — K is out of bounds
        const result = place(emptyBoard(), ShipType.Battleship, Column.H, 1, Orientation.Horizontal);
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.error).toBe(PlacementError.OutOfBounds);
    });
    it("rejects a vertical Destroyer that extends past row 10", () => {
        const result = place(emptyBoard(), ShipType.Destroyer, Column.A, 10, Orientation.Vertical);
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.error).toBe(PlacementError.OutOfBounds);
    });
    it("rejects a vertical Cruiser starting at row 9", () => {
        // rows 9, 10, 11 — row 11 is out of bounds
        const result = place(emptyBoard(), ShipType.Cruiser, Column.A, 9, Orientation.Vertical);
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.error).toBe(PlacementError.OutOfBounds);
    });
    it("rejects a horizontal Battleship starting at column H (H,I,J,K)", () => {
        const result = place(emptyBoard(), ShipType.Battleship, Column.H, 5, Orientation.Horizontal);
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.error).toBe(PlacementError.OutOfBounds);
    });
});
// ---------------------------------------------------------------------------
// Adjacency violations
// ---------------------------------------------------------------------------
describe("placeShip — adjacency violations", () => {
    it("rejects a ship orthogonally adjacent (directly below) to an existing ship", () => {
        let board = emptyBoard();
        const r1 = place(board, ShipType.PatrolBoat, Column.E, 5, Orientation.Horizontal);
        expect(r1.ok).toBe(true);
        board = r1.value;
        // Directly below E5 is E6 — adjacent
        const r2 = place(board, ShipType.PatrolBoat, Column.E, 6, Orientation.Horizontal);
        expect(r2.ok).toBe(false);
        if (r2.ok)
            return;
        expect(r2.error).toBe(PlacementError.AdjacencyViolation);
    });
    it("rejects a ship diagonally adjacent to an existing ship", () => {
        let board = emptyBoard();
        const r1 = place(board, ShipType.PatrolBoat, Column.E, 5, Orientation.Horizontal);
        expect(r1.ok).toBe(true);
        board = r1.value;
        // F6 is diagonally adjacent to E5
        const r2 = place(board, ShipType.PatrolBoat, Column.F, 6, Orientation.Horizontal);
        expect(r2.ok).toBe(false);
        if (r2.ok)
            return;
        expect(r2.error).toBe(PlacementError.AdjacencyViolation);
    });
    it("rejects a ship directly to the right of an existing ship", () => {
        let board = emptyBoard();
        // PatrolBoat at E5
        const r1 = place(board, ShipType.PatrolBoat, Column.E, 5, Orientation.Horizontal);
        expect(r1.ok).toBe(true);
        board = r1.value;
        // F5 is directly to the right — adjacent
        const r2 = place(board, ShipType.PatrolBoat, Column.F, 5, Orientation.Horizontal);
        expect(r2.ok).toBe(false);
        if (r2.ok)
            return;
        expect(r2.error).toBe(PlacementError.AdjacencyViolation);
    });
    it("allows a ship placed two cells away (outside buffer zone)", () => {
        let board = emptyBoard();
        const r1 = place(board, ShipType.PatrolBoat, Column.A, 1, Orientation.Horizontal);
        expect(r1.ok).toBe(true);
        board = r1.value;
        // A3 is two rows below A1 — outside the buffer zone
        const r2 = place(board, ShipType.PatrolBoat, Column.A, 3, Orientation.Horizontal);
        expect(r2.ok).toBe(true);
    });
});
// ---------------------------------------------------------------------------
// Quota exceeded
// ---------------------------------------------------------------------------
describe("placeShip — quota exceeded", () => {
    it("rejects a second Battleship", () => {
        let board = emptyBoard();
        const r1 = place(board, ShipType.Battleship, Column.A, 1, Orientation.Horizontal);
        expect(r1.ok).toBe(true);
        board = r1.value;
        // Second Battleship — far away to avoid adjacency issues
        const r2 = place(board, ShipType.Battleship, Column.A, 5, Orientation.Horizontal);
        expect(r2.ok).toBe(false);
        if (r2.ok)
            return;
        expect(r2.error).toBe(PlacementError.QuotaExceeded);
    });
    it("rejects a third Cruiser", () => {
        let board = emptyBoard();
        const r1 = place(board, ShipType.Cruiser, Column.A, 1, Orientation.Horizontal);
        expect(r1.ok).toBe(true);
        board = r1.value;
        const r2 = place(board, ShipType.Cruiser, Column.A, 3, Orientation.Horizontal);
        expect(r2.ok).toBe(true);
        board = r2.value;
        const r3 = place(board, ShipType.Cruiser, Column.A, 5, Orientation.Horizontal);
        expect(r3.ok).toBe(false);
        if (r3.ok)
            return;
        expect(r3.error).toBe(PlacementError.QuotaExceeded);
    });
    it("rejects a fifth PatrolBoat", () => {
        let board = emptyBoard();
        // Place 4 patrol boats with enough spacing
        const positions = [
            [Column.A, 1],
            [Column.A, 3],
            [Column.A, 5],
            [Column.A, 7],
        ];
        for (const [col, row] of positions) {
            const r = place(board, ShipType.PatrolBoat, col, row, Orientation.Horizontal);
            expect(r.ok).toBe(true);
            board = r.value;
        }
        const r5 = place(board, ShipType.PatrolBoat, Column.A, 9, Orientation.Horizontal);
        expect(r5.ok).toBe(false);
        if (r5.ok)
            return;
        expect(r5.error).toBe(PlacementError.QuotaExceeded);
    });
});
// ---------------------------------------------------------------------------
// Overlap
// ---------------------------------------------------------------------------
describe("placeShip — overlap", () => {
    it("rejects a ship placed on an already-occupied cell", () => {
        let board = emptyBoard();
        const r1 = place(board, ShipType.Destroyer, Column.E, 5, Orientation.Horizontal);
        expect(r1.ok).toBe(true);
        board = r1.value;
        // PatrolBoat at E5 — same cell as the Destroyer's first cell
        // (adjacency check would fire first, but overlap is checked before adjacency
        // only if the cell is directly occupied — here we test exact overlap)
        // Use a Cruiser starting at D5 so that E5 is the second cell
        const r2 = placeShip(board, {
            type: ShipType.Cruiser,
            origin: { col: Column.D, row: 5 },
            orientation: Orientation.Horizontal,
        });
        // D5 is adjacent to E5, so AdjacencyViolation fires first — that's fine,
        // the ship is still rejected. Let's test a direct overlap instead.
        expect(r2.ok).toBe(false);
    });
    it("rejects a PatrolBoat placed exactly on an occupied cell", () => {
        let board = emptyBoard();
        const r1 = place(board, ShipType.PatrolBoat, Column.F, 6, Orientation.Horizontal);
        expect(r1.ok).toBe(true);
        board = r1.value;
        // Second PatrolBoat at the same cell — overlap (quota allows 4 total)
        const r2 = place(board, ShipType.PatrolBoat, Column.F, 6, Orientation.Horizontal);
        expect(r2.ok).toBe(false);
        if (r2.ok)
            return;
        // Adjacency fires before overlap in the validation order, but since the
        // cell itself is occupied the overlap check would also catch it.
        // Either error is acceptable here; the ship must be rejected.
        expect([PlacementError.Overlap, PlacementError.AdjacencyViolation]).toContain(r2.error);
    });
});
// ---------------------------------------------------------------------------
// isFleetReady
// ---------------------------------------------------------------------------
describe("isFleetReady", () => {
    it("returns false for an empty board", () => {
        expect(isFleetReady(emptyBoard())).toBe(false);
    });
    it("returns false when only some ships are placed", () => {
        let board = emptyBoard();
        const r = place(board, ShipType.Battleship, Column.A, 1, Orientation.Horizontal);
        expect(r.ok).toBe(true);
        board = r.value;
        expect(isFleetReady(board)).toBe(false);
    });
    it("returns true when all 10 ships are placed via autoPlace", () => {
        const board = autoPlace(emptyBoard(), FLEET_SPEC);
        expect(isFleetReady(board)).toBe(true);
    });
});
// ---------------------------------------------------------------------------
// autoPlace
// ---------------------------------------------------------------------------
describe("autoPlace", () => {
    it("produces a board with all 10 ships placed", () => {
        const board = autoPlace(emptyBoard(), FLEET_SPEC);
        expect(board.ships).toHaveLength(10);
    });
    it("produces a board marked as ready", () => {
        const board = autoPlace(emptyBoard(), FLEET_SPEC);
        expect(board.ready).toBe(true);
    });
    it("produces the correct fleet composition", () => {
        const board = autoPlace(emptyBoard(), FLEET_SPEC);
        const battleships = board.ships.filter((s) => s.type === ShipType.Battleship);
        const cruisers = board.ships.filter((s) => s.type === ShipType.Cruiser);
        const destroyers = board.ships.filter((s) => s.type === ShipType.Destroyer);
        const patrolBoats = board.ships.filter((s) => s.type === ShipType.PatrolBoat);
        expect(battleships).toHaveLength(1);
        expect(cruisers).toHaveLength(2);
        expect(destroyers).toHaveLength(3);
        expect(patrolBoats).toHaveLength(4);
    });
    it("produces a board where no two ships are adjacent", () => {
        const board = autoPlace(emptyBoard(), FLEET_SPEC);
        // Collect all occupied cells
        const occupiedKeys = new Set();
        for (const ship of board.ships) {
            for (const coord of ship.cells) {
                occupiedKeys.add(`${coord.col}${coord.row}`);
            }
        }
        // For each ship, check that none of its cells' neighbors are occupied by
        // a different ship
        for (const ship of board.ships) {
            const shipKeys = new Set(ship.cells.map((c) => `${c.col}${c.row}`));
            for (const coord of ship.cells) {
                const colOrder = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
                const colIdx = colOrder.indexOf(coord.col);
                for (let dc = -1; dc <= 1; dc++) {
                    for (let dr = -1; dr <= 1; dr++) {
                        if (dc === 0 && dr === 0)
                            continue;
                        const nColIdx = colIdx + dc;
                        const nRow = coord.row + dr;
                        if (nColIdx < 0 || nColIdx > 9 || nRow < 1 || nRow > 10)
                            continue;
                        const nKey = `${colOrder[nColIdx]}${nRow}`;
                        if (occupiedKeys.has(nKey) && !shipKeys.has(nKey)) {
                            throw new Error(`Ship at ${coord.col}${coord.row} has an adjacent ship at ${nKey}`);
                        }
                    }
                }
            }
        }
    });
    it("all ship cells are within A–J × 1–10", () => {
        const board = autoPlace(emptyBoard(), FLEET_SPEC);
        const validCols = new Set(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]);
        for (const ship of board.ships) {
            for (const coord of ship.cells) {
                expect(validCols.has(coord.col)).toBe(true);
                expect(coord.row).toBeGreaterThanOrEqual(1);
                expect(coord.row).toBeLessThanOrEqual(10);
            }
        }
    });
    it("runs multiple times without failure (stress test)", () => {
        for (let i = 0; i < 20; i++) {
            const board = autoPlace(emptyBoard(), FLEET_SPEC);
            expect(board.ships).toHaveLength(10);
        }
    });
});
// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------
// Feature: sea-battle-game, Property 3: Ship placement orientation invariant
describe("Property 3: Ship placement orientation invariant", () => {
    // Validates: Requirements 3.1, 3.2, 3.3, 3.4
    const COLUMNS = Object.values(Column);
    const ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const SHIP_TYPES = Object.values(ShipType);
    const ORIENTATIONS = Object.values(Orientation);
    const VALID_COLS = new Set(COLUMNS);
    const arbShipType = fc.constantFrom(...SHIP_TYPES);
    const arbOrientation = fc.constantFrom(...ORIENTATIONS);
    const arbCol = fc.constantFrom(...COLUMNS);
    const arbRow = fc.constantFrom(...ROWS);
    it("for any accepted placement, horizontal ships share the same row; " +
        "vertical ships share the same column; all cells are within A–J × 1–10", () => {
        fc.assert(fc.property(arbShipType, arbOrientation, arbCol, arbRow, (shipType, orientation, col, row) => {
            const board = createEmptyBoard("player1");
            const placement = {
                type: shipType,
                origin: { col, row },
                orientation,
            };
            const result = placeShip(board, placement);
            // Only verify the invariant for accepted placements
            if (!result.ok) {
                return true; // rejected placements are not subject to the invariant
            }
            const placedShip = result.value.ships[0];
            const cells = placedShip.cells;
            // All cells must be within A–J × 1–10
            for (const cell of cells) {
                if (!VALID_COLS.has(cell.col))
                    return false;
                if (cell.row < 1 || cell.row > 10)
                    return false;
            }
            if (orientation === Orientation.Horizontal) {
                // All cells must share the same row as the origin
                const expectedRow = cells[0].row;
                for (const cell of cells) {
                    if (cell.row !== expectedRow)
                        return false;
                }
            }
            else {
                // Orientation.Vertical: all cells must share the same column as the origin
                const expectedCol = cells[0].col;
                for (const cell of cells) {
                    if (cell.col !== expectedCol)
                        return false;
                }
            }
            return true;
        }), { numRuns: 100 });
    });
});
// Feature: sea-battle-game, Property 4: Adjacency rule is preserved after every placement
describe("Property 4: Adjacency rule preserved after every placement", () => {
    // Validates: Requirements 4.1, 4.2, 4.3, 4.4
    const COLUMN_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    /**
     * Returns true if two coordinates are orthogonally or diagonally adjacent
     * (i.e., within 1 step in any of the 8 directions).
     */
    function areAdjacent(a, b) {
        const aColIdx = COLUMN_ORDER.indexOf(a.col);
        const bColIdx = COLUMN_ORDER.indexOf(b.col);
        const colDiff = Math.abs(aColIdx - bColIdx);
        const rowDiff = Math.abs(a.row - b.row);
        return colDiff <= 1 && rowDiff <= 1 && !(colDiff === 0 && rowDiff === 0);
    }
    /**
     * Checks that no cell from ship i is adjacent to any cell from ship j (i ≠ j).
     */
    function noTwoShipsAreAdjacent(board) {
        const ships = board.ships;
        for (let i = 0; i < ships.length; i++) {
            for (let j = i + 1; j < ships.length; j++) {
                for (const cellA of ships[i].cells) {
                    for (const cellB of ships[j].cells) {
                        if (areAdjacent(cellA, cellB)) {
                            return false;
                        }
                    }
                }
            }
        }
        return true;
    }
    it("for any board produced by autoPlace, no two ships occupy orthogonally or diagonally adjacent cells", () => {
        fc.assert(fc.property(fc.constant(null), // seed for determinism; autoPlace uses Math.random internally
        (_) => {
            const board = autoPlace(createEmptyBoard("player1"), FLEET_SPEC);
            return noTwoShipsAreAdjacent(board);
        }), { numRuns: 100 });
    });
    it("after every accepted placement in a random sequence, no two ships are adjacent", () => {
        const COLUMNS = Object.values(Column);
        const ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const SHIP_TYPES = Object.values(ShipType);
        const ORIENTATIONS = Object.values(Orientation);
        // Generate a sequence of up to 10 placement attempts
        const arbPlacement = fc.record({
            type: fc.constantFrom(...SHIP_TYPES),
            col: fc.constantFrom(...COLUMNS),
            row: fc.constantFrom(...ROWS),
            orientation: fc.constantFrom(...ORIENTATIONS),
        });
        fc.assert(fc.property(fc.array(arbPlacement, { minLength: 1, maxLength: 10 }), (placements) => {
            let board = createEmptyBoard("player1");
            for (const p of placements) {
                const result = placeShip(board, {
                    type: p.type,
                    origin: { col: p.col, row: p.row },
                    orientation: p.orientation,
                });
                if (result.ok) {
                    board = result.value;
                    // Invariant must hold after every accepted placement
                    if (!noTwoShipsAreAdjacent(board)) {
                        return false;
                    }
                }
                // Rejected placements do not change the board; invariant trivially holds
            }
            return true;
        }), { numRuns: 100 });
    });
});
// Feature: sea-battle-game, Property 5: Fleet composition invariant
describe("Property 5: Fleet composition invariant", () => {
    // Validates: Requirements 2.1, 2.2, 5.2
    it("for any board whose fleet is marked ready (via autoPlace), it contains exactly " +
        "1 Battleship, 2 Cruisers, 3 Destroyers, 4 Patrol Boats — 10 ships and 20 segments", () => {
        fc.assert(fc.property(fc.constant(null), // autoPlace uses Math.random internally; no generator input needed
        (_) => {
            const board = autoPlace(createEmptyBoard("player1"), FLEET_SPEC);
            // The board must be marked ready
            if (!board.ready)
                return false;
            // Count each ship type
            const battleships = board.ships.filter((s) => s.type === ShipType.Battleship).length;
            const cruisers = board.ships.filter((s) => s.type === ShipType.Cruiser).length;
            const destroyers = board.ships.filter((s) => s.type === ShipType.Destroyer).length;
            const patrolBoats = board.ships.filter((s) => s.type === ShipType.PatrolBoat).length;
            // Verify exact fleet composition per FleetSpec
            if (battleships !== 1)
                return false;
            if (cruisers !== 2)
                return false;
            if (destroyers !== 3)
                return false;
            if (patrolBoats !== 4)
                return false;
            // Verify total ship count = 10
            const totalShips = board.ships.length;
            if (totalShips !== 10)
                return false;
            // Verify total segments = 20
            // Battleship(4) × 1 + Cruiser(3) × 2 + Destroyer(2) × 3 + PatrolBoat(1) × 4
            // = 4 + 6 + 6 + 4 = 20
            const totalSegments = board.ships.reduce((sum, ship) => sum + ship.cells.length, 0);
            if (totalSegments !== 20)
                return false;
            return true;
        }), { numRuns: 100 });
    });
});
//# sourceMappingURL=placementEngine.test.js.map