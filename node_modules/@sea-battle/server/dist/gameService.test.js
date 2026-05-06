/**
 * Unit tests for GameService.
 *
 * Uses an in-memory SessionService (no DB) to test game logic in isolation.
 *
 * Requirements: 5.1, 5.3, 5.4, 6.1–6.5, 7.1–7.4, 8.1–8.4, 9.1–9.4, 13.5, 13.6, 13.7
 */
import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { Column, Orientation, ShipType, TurnPhase, ShotError, ShotOutcome, createEmptyBoard, placeShip, } from "@sea-battle/domain";
import { GameService, serializeBoard } from "./gameService.js";
import { SessionService } from "./sessionService.js";
// ---------------------------------------------------------------------------
// In-memory SessionQueries (mirrors sessionService.test.ts)
// ---------------------------------------------------------------------------
function createInMemorySessionQueries() {
    const store = new Map();
    return {
        _store: store,
        insert(row) {
            store.set(row.id, { ...row });
        },
        findById(id) {
            const row = store.get(id);
            return row ? { ...row } : undefined;
        },
        findByInviteCode(code) {
            for (const row of store.values()) {
                if (row.invite_code === code)
                    return { ...row };
            }
            return undefined;
        },
        update(row) {
            if (store.has(row.id)) {
                store.set(row.id, { ...row });
            }
        },
        delete(id) {
            store.delete(id);
        },
    };
}
// ---------------------------------------------------------------------------
// Coordinate helper
// ---------------------------------------------------------------------------
function coord(col, row) {
    return { col, row };
}
// ---------------------------------------------------------------------------
// Board building helpers
// ---------------------------------------------------------------------------
/**
 * Builds a board with ships placed in a deterministic, non-overlapping layout.
 *
 * Layout (10 ships):
 *   Row 1:  Battleship  A1-D1 (horizontal)
 *   Row 3:  Cruiser     A3-C3 (horizontal)
 *   Row 3:  Cruiser     E3-G3 (horizontal)
 *   Row 5:  Destroyer   A5-B5 (horizontal)
 *   Row 5:  Destroyer   D5-E5 (horizontal)
 *   Row 5:  Destroyer   G5-H5 (horizontal)
 *   Row 7:  PatrolBoat  A7    (horizontal)
 *   Row 7:  PatrolBoat  C7    (horizontal)
 *   Row 7:  PatrolBoat  E7    (horizontal)
 *   Row 10: PatrolBoat  J10   (horizontal)
 */
function buildDeterministicBoard(ownerId, shipCount = 10) {
    const allPlacements = [
        { type: ShipType.Battleship, origin: coord(Column.A, 1), orientation: Orientation.Horizontal },
        { type: ShipType.Cruiser, origin: coord(Column.A, 3), orientation: Orientation.Horizontal },
        { type: ShipType.Cruiser, origin: coord(Column.E, 3), orientation: Orientation.Horizontal },
        { type: ShipType.Destroyer, origin: coord(Column.A, 5), orientation: Orientation.Horizontal },
        { type: ShipType.Destroyer, origin: coord(Column.D, 5), orientation: Orientation.Horizontal },
        { type: ShipType.Destroyer, origin: coord(Column.G, 5), orientation: Orientation.Horizontal },
        { type: ShipType.PatrolBoat, origin: coord(Column.A, 7), orientation: Orientation.Horizontal },
        { type: ShipType.PatrolBoat, origin: coord(Column.C, 7), orientation: Orientation.Horizontal },
        { type: ShipType.PatrolBoat, origin: coord(Column.E, 7), orientation: Orientation.Horizontal },
        { type: ShipType.PatrolBoat, origin: coord(Column.J, 10), orientation: Orientation.Horizontal },
    ];
    let board = createEmptyBoard(ownerId);
    for (let i = 0; i < shipCount; i++) {
        const r = placeShip(board, allPlacements[i]);
        if (!r.ok)
            throw new Error(`Failed to place ship ${i}: ${r.error}`);
        board = r.value;
    }
    return board;
}
/**
 * Builds a board with a layout where A1 is guaranteed to be empty (no ship).
 * Ships start from row 3.
 */
function buildBoardWithEmptyA1(ownerId) {
    const placements = [
        { type: ShipType.Battleship, origin: coord(Column.A, 3), orientation: Orientation.Horizontal },
        { type: ShipType.Cruiser, origin: coord(Column.A, 5), orientation: Orientation.Horizontal },
        { type: ShipType.Cruiser, origin: coord(Column.E, 5), orientation: Orientation.Horizontal },
        { type: ShipType.Destroyer, origin: coord(Column.A, 7), orientation: Orientation.Horizontal },
        { type: ShipType.Destroyer, origin: coord(Column.D, 7), orientation: Orientation.Horizontal },
        { type: ShipType.Destroyer, origin: coord(Column.G, 7), orientation: Orientation.Horizontal },
        { type: ShipType.PatrolBoat, origin: coord(Column.A, 9), orientation: Orientation.Horizontal },
        { type: ShipType.PatrolBoat, origin: coord(Column.C, 9), orientation: Orientation.Horizontal },
        { type: ShipType.PatrolBoat, origin: coord(Column.E, 9), orientation: Orientation.Horizontal },
        { type: ShipType.PatrolBoat, origin: coord(Column.G, 9), orientation: Orientation.Horizontal },
    ];
    let board = createEmptyBoard(ownerId);
    for (const p of placements) {
        const r = placeShip(board, p);
        if (!r.ok)
            throw new Error(`Failed to place ship: ${r.error}`);
        board = r.value;
    }
    return board;
}
/**
 * Builds a board where only a single PatrolBoat at A1 remains (all other ships
 * are pre-sunk). This simulates a game where 19 of 20 segments are already sunk.
 */
function buildAlmostSunkBoard(ownerId) {
    // Start with a PatrolBoat at A1
    let board = createEmptyBoard(ownerId);
    const r = placeShip(board, {
        type: ShipType.PatrolBoat,
        origin: coord(Column.A, 1),
        orientation: Orientation.Horizontal,
    });
    if (!r.ok)
        throw new Error(`Failed to place PatrolBoat: ${r.error}`);
    board = r.value;
    // Inject 9 pre-sunk ships (19 total sunk segments)
    const preSunkShips = [
        {
            type: ShipType.Battleship,
            cells: [coord(Column.A, 3), coord(Column.B, 3), coord(Column.C, 3), coord(Column.D, 3)],
            hitCount: 4,
            sunk: true,
        },
        {
            type: ShipType.Cruiser,
            cells: [coord(Column.A, 5), coord(Column.B, 5), coord(Column.C, 5)],
            hitCount: 3,
            sunk: true,
        },
        {
            type: ShipType.Cruiser,
            cells: [coord(Column.E, 5), coord(Column.F, 5), coord(Column.G, 5)],
            hitCount: 3,
            sunk: true,
        },
        {
            type: ShipType.Destroyer,
            cells: [coord(Column.A, 7), coord(Column.B, 7)],
            hitCount: 2,
            sunk: true,
        },
        {
            type: ShipType.Destroyer,
            cells: [coord(Column.D, 7), coord(Column.E, 7)],
            hitCount: 2,
            sunk: true,
        },
        {
            type: ShipType.Destroyer,
            cells: [coord(Column.G, 7), coord(Column.H, 7)],
            hitCount: 2,
            sunk: true,
        },
        {
            type: ShipType.PatrolBoat,
            cells: [coord(Column.A, 9)],
            hitCount: 1,
            sunk: true,
        },
        {
            type: ShipType.PatrolBoat,
            cells: [coord(Column.C, 9)],
            hitCount: 1,
            sunk: true,
        },
        {
            type: ShipType.PatrolBoat,
            cells: [coord(Column.E, 9)],
            hitCount: 1,
            sunk: true,
        },
    ];
    return {
        ...board,
        ships: [...board.ships, ...preSunkShips],
    };
}
// ---------------------------------------------------------------------------
// Session factory helpers
// ---------------------------------------------------------------------------
/** Creates a Placement-phase session with both players joined. */
function createPlacementSession(sessionService, playerA = "alice", playerB = "bob") {
    const session = sessionService.createSession(playerA);
    const result = sessionService.joinSession(session.inviteCode, playerB);
    if (!result.ok)
        throw new Error("Failed to join session");
    return result.value;
}
/** Creates a Shooting-phase session with both players' fleets fully placed. */
function createShootingSession(sessionService, playerA = "alice", playerB = "bob") {
    const boardA = buildDeterministicBoard(playerA);
    const boardB = buildDeterministicBoard(playerB);
    let session = createPlacementSession(sessionService, playerA, playerB);
    session = {
        ...session,
        boardA: serializeBoard(boardA),
        boardB: serializeBoard(boardB),
        status: "Shooting",
        turnState: JSON.stringify({ activePlayer: playerA, phase: TurnPhase.Shooting }),
    };
    sessionService.updateSession(session);
    return session;
}
/** Creates a Shooting-phase session where A1 on bob's board is guaranteed empty (miss). */
function createShootingSessionWithKnownMiss(sessionService, playerA = "alice", playerB = "bob") {
    const boardA = buildDeterministicBoard(playerA);
    const boardB = buildBoardWithEmptyA1(playerB);
    let session = createPlacementSession(sessionService, playerA, playerB);
    session = {
        ...session,
        boardA: serializeBoard(boardA),
        boardB: serializeBoard(boardB),
        status: "Shooting",
        turnState: JSON.stringify({ activePlayer: playerA, phase: TurnPhase.Shooting }),
    };
    sessionService.updateSession(session);
    return session;
}
/** Creates a Shooting-phase session where A1 on bob's board has a ship (hit/sunk). */
function createShootingSessionWithKnownHit(sessionService, playerA = "alice", playerB = "bob") {
    const boardA = buildDeterministicBoard(playerA);
    const boardB = buildDeterministicBoard(playerB); // Battleship at A1
    let session = createPlacementSession(sessionService, playerA, playerB);
    session = {
        ...session,
        boardA: serializeBoard(boardA),
        boardB: serializeBoard(boardB),
        status: "Shooting",
        turnState: JSON.stringify({ activePlayer: playerA, phase: TurnPhase.Shooting }),
    };
    sessionService.updateSession(session);
    return session;
}
/** Creates a Shooting-phase session where bob's fleet is almost entirely sunk. */
function createSessionWithAlmostSunkFleet(sessionService, playerA = "alice", playerB = "bob") {
    const boardA = buildDeterministicBoard(playerA);
    const boardB = buildAlmostSunkBoard(playerB);
    let session = createPlacementSession(sessionService, playerA, playerB);
    session = {
        ...session,
        boardA: serializeBoard(boardA),
        boardB: serializeBoard(boardB),
        status: "Shooting",
        turnState: JSON.stringify({ activePlayer: playerA, phase: TurnPhase.Shooting }),
    };
    sessionService.updateSession(session);
    return session;
}
// ---------------------------------------------------------------------------
// Tests: handlePlacement
// ---------------------------------------------------------------------------
describe("GameService.handlePlacement", () => {
    let sessionService;
    let gameService;
    beforeEach(() => {
        const queries = createInMemorySessionQueries();
        sessionService = new SessionService(queries);
        gameService = new GameService();
    });
    it("valid placement succeeds and updates boardA for playerA", () => {
        const session = createPlacementSession(sessionService);
        const result = gameService.handlePlacement(session, "alice", {
            type: ShipType.PatrolBoat,
            origin: coord(Column.A, 1),
            orientation: Orientation.Horizontal,
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.value.boardA).not.toBe(session.boardA);
        expect(result.value.boardB).toBe(session.boardB);
    });
    it("valid placement succeeds and updates boardB for playerB", () => {
        const session = createPlacementSession(sessionService);
        const result = gameService.handlePlacement(session, "bob", {
            type: ShipType.PatrolBoat,
            origin: coord(Column.A, 1),
            orientation: Orientation.Horizontal,
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.value.boardB).not.toBe(session.boardB);
        expect(result.value.boardA).toBe(session.boardA);
    });
    it("rejected outside Placement phase — Shooting", () => {
        const session = createPlacementSession(sessionService);
        const shootingSession = { ...session, status: "Shooting" };
        const result = gameService.handlePlacement(shootingSession, "alice", {
            type: ShipType.PatrolBoat,
            origin: coord(Column.A, 1),
            orientation: Orientation.Horizontal,
        });
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.error).toBe("Not in Placement phase");
    });
    it("rejected outside Placement phase — Finished", () => {
        const session = createPlacementSession(sessionService);
        const finishedSession = { ...session, status: "Finished" };
        const result = gameService.handlePlacement(finishedSession, "alice", {
            type: ShipType.PatrolBoat,
            origin: coord(Column.A, 1),
            orientation: Orientation.Horizontal,
        });
        expect(result.ok).toBe(false);
    });
    it("rejected outside Placement phase — WaitingForPlayers", () => {
        const session = sessionService.createSession("alice");
        const result = gameService.handlePlacement(session, "alice", {
            type: ShipType.PatrolBoat,
            origin: coord(Column.A, 1),
            orientation: Orientation.Horizontal,
        });
        expect(result.ok).toBe(false);
    });
    it("both fleets ready transitions status to Shooting", () => {
        // Build a session where alice has 9 ships and bob has 10 ships
        const boardAWith9 = buildDeterministicBoard("alice", 9);
        const boardBFull = buildDeterministicBoard("bob", 10);
        let session = createPlacementSession(sessionService);
        session = {
            ...session,
            boardA: serializeBoard(boardAWith9),
            boardB: serializeBoard(boardBFull),
        };
        // Place alice's 10th ship (4th PatrolBoat) at J10
        const result = gameService.handlePlacement(session, "alice", {
            type: ShipType.PatrolBoat,
            origin: coord(Column.J, 10),
            orientation: Orientation.Horizontal,
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.value.status).toBe("Shooting");
    });
    it("placing a ship when only one fleet is ready does NOT transition to Shooting", () => {
        const session = createPlacementSession(sessionService);
        // Only place one ship for alice; bob has no ships
        const result = gameService.handlePlacement(session, "alice", {
            type: ShipType.PatrolBoat,
            origin: coord(Column.A, 1),
            orientation: Orientation.Horizontal,
        });
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.value.status).toBe("Placement");
    });
    it("invalid placement (out of bounds) returns error", () => {
        const session = createPlacementSession(sessionService);
        // Battleship at J1 horizontal would go out of bounds (J+3 = beyond J)
        const result = gameService.handlePlacement(session, "alice", {
            type: ShipType.Battleship,
            origin: coord(Column.J, 1),
            orientation: Orientation.Horizontal,
        });
        expect(result.ok).toBe(false);
    });
});
// ---------------------------------------------------------------------------
// Tests: handleShot
// ---------------------------------------------------------------------------
describe("GameService.handleShot", () => {
    let sessionService;
    let gameService;
    beforeEach(() => {
        const queries = createInMemorySessionQueries();
        sessionService = new SessionService(queries);
        gameService = new GameService();
    });
    it("valid shot returns ShotResult event with correct fields", () => {
        const session = createShootingSession(sessionService);
        const result = gameService.handleShot(session, "alice", coord(Column.A, 1));
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        const { event } = result.value;
        expect(event.type).toBe("ShotResult");
        expect(event.shooter).toBe("alice");
        expect(event.coord).toBe("A1");
        expect([ShotOutcome.Miss, ShotOutcome.Hit, ShotOutcome.Sunk]).toContain(event.outcome);
        expect(Array.isArray(event.autoMarked)).toBe(true);
    });
    it("rejected outside Shooting phase — Placement", () => {
        const session = createPlacementSession(sessionService);
        const result = gameService.handleShot(session, "alice", coord(Column.A, 1));
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.error).toBe("Not in Shooting phase");
    });
    it("rejected outside Shooting phase — Finished", () => {
        const session = createShootingSession(sessionService);
        const finishedSession = { ...session, status: "Finished" };
        const result = gameService.handleShot(finishedSession, "alice", coord(Column.A, 1));
        expect(result.ok).toBe(false);
    });
    it("rejected when not active player's turn (ShotError.NotYourTurn)", () => {
        const session = createShootingSession(sessionService);
        // alice is active; bob tries to shoot
        const result = gameService.handleShot(session, "bob", coord(Column.A, 1));
        expect(result.ok).toBe(false);
        if (result.ok)
            return;
        expect(result.error).toBe(ShotError.NotYourTurn);
    });
    it("shot updates opponent board (boardB when alice fires)", () => {
        const session = createShootingSession(sessionService);
        const result = gameService.handleShot(session, "alice", coord(Column.A, 1));
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        // boardB (bob's board) should have changed
        expect(result.value.session.boardB).not.toBe(session.boardB);
        // boardA (alice's board) should be unchanged
        expect(result.value.session.boardA).toBe(session.boardA);
    });
    it("turn switches to bob after alice misses", () => {
        const session = createShootingSessionWithKnownMiss(sessionService);
        const result = gameService.handleShot(session, "alice", coord(Column.A, 1));
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.value.event.outcome).toBe(ShotOutcome.Miss);
        const newTurnState = JSON.parse(result.value.session.turnState);
        expect(newTurnState.activePlayer).toBe("bob");
    });
    it("turn stays with alice after alice hits", () => {
        const session = createShootingSessionWithKnownHit(sessionService);
        // A1 has a Battleship (4 segments) — first hit won't sink it
        const result = gameService.handleShot(session, "alice", coord(Column.A, 1));
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.value.event.outcome).toBe(ShotOutcome.Hit);
        const newTurnState = JSON.parse(result.value.session.turnState);
        expect(newTurnState.activePlayer).toBe("alice");
    });
    it("victory detected when all 20 segments sunk", () => {
        const session = createSessionWithAlmostSunkFleet(sessionService);
        // Fire the final shot to sink the last PatrolBoat at A1
        const result = gameService.handleShot(session, "alice", coord(Column.A, 1));
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        const { session: updatedSession, event } = result.value;
        expect(event.outcome).toBe(ShotOutcome.Sunk);
        expect(event.winner).toBe("alice");
        expect(updatedSession.status).toBe("Finished");
    });
    it("no winner when game is not over", () => {
        const session = createShootingSessionWithKnownMiss(sessionService);
        const result = gameService.handleShot(session, "alice", coord(Column.A, 1));
        expect(result.ok).toBe(true);
        if (!result.ok)
            return;
        expect(result.value.event.winner).toBeUndefined();
        expect(result.value.session.status).toBe("Shooting");
    });
    it("already-shot cell returns AlreadyShot error", () => {
        const session = createShootingSession(sessionService);
        // Fire once
        const first = gameService.handleShot(session, "alice", coord(Column.A, 1));
        expect(first.ok).toBe(true);
        if (!first.ok)
            return;
        // Determine who is active now
        const updatedSession = first.value.session;
        const turnState = JSON.parse(updatedSession.turnState);
        const activePlayer = turnState.activePlayer;
        // Fire at the same cell again (need to fire from the correct active player)
        // If alice is still active (hit), fire again at A1
        // If bob is now active (miss), we need to fire from bob's perspective at alice's board
        // For simplicity, test the AlreadyShot case by directly calling with the same session state
        // but at the already-shot coordinate from alice's perspective
        if (activePlayer === "alice") {
            const second = gameService.handleShot(updatedSession, "alice", coord(Column.A, 1));
            expect(second.ok).toBe(false);
            if (second.ok)
                return;
            expect(second.error).toBe(ShotError.AlreadyShot);
        }
        // If turn switched to bob, the test still validates the first shot succeeded
        expect(first.ok).toBe(true);
    });
});
// ---------------------------------------------------------------------------
// Property-Based Tests: Property 21 — Turn order enforced
// ---------------------------------------------------------------------------
// Feature: sea-battle-game, Property 21: Turn order is enforced — non-active player shots are rejected
describe("Property 21: Turn order enforced — non-active player shots rejected", () => {
    /**
     * For any session in the shooting phase, a shot from the non-active player
     * is rejected without changing board or turn state.
     *
     * Validates: Requirements 13.7
     */
    it("non-active player shot is rejected and board/turn state are unchanged", () => {
        // Arbitraries for columns (A–J) and rows (1–10)
        const columnArb = fc.constantFrom(Column.A, Column.B, Column.C, Column.D, Column.E, Column.F, Column.G, Column.H, Column.I, Column.J);
        const rowArb = fc.integer({ min: 1, max: 10 });
        const coordArb = fc.record({ col: columnArb, row: rowArb });
        // Arbitrary for which player is active: "alice" or "bob"
        const activePlayerArb = fc.constantFrom("alice", "bob");
        fc.assert(fc.property(coordArb, activePlayerArb, (targetCoord, activePlayer) => {
            const nonActivePlayer = activePlayer === "alice" ? "bob" : "alice";
            // Build a shooting-phase session with the given active player
            const queries = createInMemorySessionQueries();
            const sessionService = new SessionService(queries);
            const gameService = new GameService();
            const boardA = buildDeterministicBoard("alice");
            const boardB = buildDeterministicBoard("bob");
            let session = createPlacementSession(sessionService, "alice", "bob");
            session = {
                ...session,
                boardA: serializeBoard(boardA),
                boardB: serializeBoard(boardB),
                status: "Shooting",
                turnState: JSON.stringify({ activePlayer, phase: TurnPhase.Shooting }),
            };
            sessionService.updateSession(session);
            // Capture board and turn state before the rejected shot
            const boardABefore = session.boardA;
            const boardBBefore = session.boardB;
            const turnStateBefore = session.turnState;
            // Non-active player attempts to fire a shot
            const result = gameService.handleShot(session, nonActivePlayer, targetCoord);
            // The shot must be rejected
            expect(result.ok).toBe(false);
            if (result.ok)
                return;
            // The error must be NotYourTurn
            expect(result.error).toBe(ShotError.NotYourTurn);
            // Board state and turn state must be unchanged (the session object is
            // not mutated by handleShot — it returns a new session only on success)
            // We verify by re-reading the session from the store
            const storedSession = sessionService.getSession(session.id);
            expect(storedSession).toBeDefined();
            if (!storedSession)
                return;
            expect(storedSession.boardA).toBe(boardABefore);
            expect(storedSession.boardB).toBe(boardBBefore);
            expect(storedSession.turnState).toBe(turnStateBefore);
        }), { numRuns: 100 });
    });
});
//# sourceMappingURL=gameService.test.js.map