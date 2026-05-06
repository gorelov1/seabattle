/**
 * PlacementEngine — validates and records ship placements on a board.
 * Requirements: 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.2
 */
import { Orientation, PlacementError, ShipType, shipSize, Column, CellStatus, } from "./types.js";
import { serialize } from "./coordinateSystem.js";
// ---------------------------------------------------------------------------
// Column ordering: A=0, B=1, ..., J=9
// ---------------------------------------------------------------------------
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
const COLUMN_INDEX = new Map(COLUMN_ORDER.map((col, idx) => [col, idx]));
/** Returns the Column at the given index (0–9), or undefined if out of range. */
function columnAt(index) {
    return COLUMN_ORDER[index];
}
// ---------------------------------------------------------------------------
// Cell computation
// ---------------------------------------------------------------------------
/**
 * Computes all cell coordinates occupied by a ship placement.
 * Returns null if the placement is invalid (out of bounds or bad orientation).
 */
function computeCells(placement) {
    const { type, origin, orientation } = placement;
    const size = shipSize(type);
    const colIdx = COLUMN_INDEX.get(origin.col);
    if (colIdx === undefined)
        return null;
    const cells = [];
    for (let i = 0; i < size; i++) {
        if (orientation === Orientation.Horizontal) {
            const newColIdx = colIdx + i;
            const newCol = columnAt(newColIdx);
            if (newCol === undefined)
                return null; // out of bounds
            const row = origin.row;
            if (row < 1 || row > 10)
                return null;
            cells.push({ col: newCol, row });
        }
        else if (orientation === Orientation.Vertical) {
            const newRow = (origin.row + i);
            if (newRow < 1 || newRow > 10)
                return null; // out of bounds
            cells.push({ col: origin.col, row: newRow });
        }
        else {
            return null; // invalid orientation
        }
    }
    return cells;
}
// ---------------------------------------------------------------------------
// Quota helpers
// ---------------------------------------------------------------------------
/** Returns the allowed count for a ship type from the FleetSpec. */
function quotaFor(type, fleet) {
    switch (type) {
        case ShipType.Battleship:
            return fleet.battleships;
        case ShipType.Cruiser:
            return fleet.cruisers;
        case ShipType.Destroyer:
            return fleet.destroyers;
        case ShipType.PatrolBoat:
            return fleet.patrolBoats;
    }
}
/** Counts how many ships of the given type are already on the board. */
function countShipType(board, type) {
    return board.ships.filter((s) => s.type === type).length;
}
// ---------------------------------------------------------------------------
// Adjacency helpers
// ---------------------------------------------------------------------------
/**
 * Returns all eight-directional neighbors of a coordinate that are within
 * the valid 10×10 board.
 */
function neighbors(coord) {
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
            const newCol = columnAt(newColIdx);
            if (newCol !== undefined && newRow >= 1 && newRow <= 10) {
                result.push({ col: newCol, row: newRow });
            }
        }
    }
    return result;
}
// ---------------------------------------------------------------------------
// Board construction helpers
// ---------------------------------------------------------------------------
/** Creates a fresh empty 10×10 board for the given owner. */
export function createEmptyBoard(ownerId) {
    const cells = new Map();
    for (const col of COLUMN_ORDER) {
        for (let row = 1; row <= 10; row++) {
            const coord = { col, row: row };
            const key = serialize(coord);
            cells.set(key, { coord, status: CellStatus.Unshot });
        }
    }
    return { ownerId, cells, ships: [], ready: false };
}
// ---------------------------------------------------------------------------
// The canonical FleetSpec used throughout the game
// ---------------------------------------------------------------------------
const STANDARD_FLEET = {
    battleships: 1,
    cruisers: 2,
    destroyers: 3,
    patrolBoats: 4,
};
// ---------------------------------------------------------------------------
// placeShip
// ---------------------------------------------------------------------------
/**
 * Validates and places a ship on the board.
 *
 * Validation order (per design):
 *   1. Orientation is Horizontal or Vertical.
 *   2. All cells are within A–J × 1–10.
 *   3. Ship-type quota is not exceeded.
 *   4. No cell overlaps an existing ship.
 *   5. No cell is within the eight-directional buffer zone of an existing ship.
 *
 * On success returns a new Board (immutable — input board is not mutated).
 */
export function placeShip(board, placement) {
    const { type, orientation } = placement;
    // 1. Validate orientation
    if (orientation !== Orientation.Horizontal &&
        orientation !== Orientation.Vertical) {
        return { ok: false, error: PlacementError.InvalidOrientation };
    }
    // 2. Compute cells — null means out of bounds or invalid orientation
    const cells = computeCells(placement);
    if (cells === null) {
        return { ok: false, error: PlacementError.OutOfBounds };
    }
    // Double-check all cells are within bounds (belt-and-suspenders)
    for (const cell of cells) {
        const colIdx = COLUMN_INDEX.get(cell.col);
        if (colIdx === undefined || cell.row < 1 || cell.row > 10) {
            return { ok: false, error: PlacementError.OutOfBounds };
        }
    }
    // 3. Quota check
    const currentCount = countShipType(board, type);
    const allowed = quotaFor(type, STANDARD_FLEET);
    if (currentCount >= allowed) {
        return { ok: false, error: PlacementError.QuotaExceeded };
    }
    // Build a set of occupied cell keys for fast lookup
    const occupiedKeys = new Set();
    for (const ship of board.ships) {
        for (const coord of ship.cells) {
            occupiedKeys.add(serialize(coord));
        }
    }
    // 4. Overlap check
    for (const cell of cells) {
        if (occupiedKeys.has(serialize(cell))) {
            return { ok: false, error: PlacementError.Overlap };
        }
    }
    // 5. Adjacency (buffer zone) check
    for (const cell of cells) {
        for (const neighbor of neighbors(cell)) {
            if (occupiedKeys.has(serialize(neighbor))) {
                return { ok: false, error: PlacementError.AdjacencyViolation };
            }
        }
    }
    // All checks passed — build the new ship and board (immutably)
    const newShip = {
        type,
        cells,
        hitCount: 0,
        sunk: false,
    };
    const newShips = [...board.ships, newShip];
    // Update the cells map: mark each occupied cell (shallow-copy the map)
    const newCells = new Map(board.cells);
    for (const coord of cells) {
        const key = serialize(coord);
        newCells.set(key, { coord, status: CellStatus.Unshot });
    }
    const newBoard = {
        ownerId: board.ownerId,
        cells: newCells,
        ships: newShips,
        ready: false, // will be set by isFleetReady check below
    };
    // Mark ready if fleet is complete
    newBoard.ready = isFleetReady(newBoard);
    return { ok: true, value: newBoard };
}
// ---------------------------------------------------------------------------
// isFleetReady
// ---------------------------------------------------------------------------
/**
 * Returns true when all 10 ships of the standard FleetSpec are placed.
 * Requirements: 5.2
 */
export function isFleetReady(board) {
    const battleships = board.ships.filter((s) => s.type === ShipType.Battleship).length;
    const cruisers = board.ships.filter((s) => s.type === ShipType.Cruiser).length;
    const destroyers = board.ships.filter((s) => s.type === ShipType.Destroyer).length;
    const patrolBoats = board.ships.filter((s) => s.type === ShipType.PatrolBoat).length;
    return (battleships === STANDARD_FLEET.battleships &&
        cruisers === STANDARD_FLEET.cruisers &&
        destroyers === STANDARD_FLEET.destroyers &&
        patrolBoats === STANDARD_FLEET.patrolBoats);
}
// ---------------------------------------------------------------------------
// autoPlace
// ---------------------------------------------------------------------------
/**
 * Randomly places all ships of the fleet on the board following all placement
 * rules. Used by the AI opponent.
 * Requirements: 5.2, 12.2
 */
export function autoPlace(board, fleet) {
    // Build the ordered list of ships to place: 1 Battleship, 2 Cruisers,
    // 3 Destroyers, 4 PatrolBoats
    const shipsToPlace = [
        ...Array(fleet.battleships).fill(ShipType.Battleship),
        ...Array(fleet.cruisers).fill(ShipType.Cruiser),
        ...Array(fleet.destroyers).fill(ShipType.Destroyer),
        ...Array(fleet.patrolBoats).fill(ShipType.PatrolBoat),
    ];
    let currentBoard = board;
    for (const shipType of shipsToPlace) {
        let placed = false;
        // Retry until a valid placement is found (bounded by attempts to avoid
        // infinite loops in degenerate cases)
        for (let attempt = 0; attempt < 1000 && !placed; attempt++) {
            const orientation = Math.random() < 0.5 ? Orientation.Horizontal : Orientation.Vertical;
            // Pick a random origin
            const colIdx = Math.floor(Math.random() * 10);
            const row = (Math.floor(Math.random() * 10) + 1);
            const col = COLUMN_ORDER[colIdx];
            const placement = {
                type: shipType,
                origin: { col, row },
                orientation,
            };
            const result = placeShip(currentBoard, placement);
            if (result.ok) {
                currentBoard = result.value;
                placed = true;
            }
        }
        if (!placed) {
            // This should not happen on a valid 10×10 board with standard fleet,
            // but if it does, restart from scratch
            return autoPlace(createEmptyBoard(board.ownerId), fleet);
        }
    }
    return currentBoard;
}
//# sourceMappingURL=placementEngine.js.map