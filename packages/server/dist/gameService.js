/**
 * GameService — server-side authoritative game logic.
 *
 * Wires PlacementEngine, ShotEngine, TurnManager, and VictoryDetector from
 * @sea-battle/domain to operate on SessionData objects from SessionService.
 *
 * Boards are stored as JSON strings in SessionData; this service deserializes
 * them before use and re-serializes after mutations.
 *
 * Requirements: 5.1, 5.3, 5.4, 6.1–6.5, 7.1–7.4, 8.1–8.4, 9.1–9.4, 13.5, 13.6, 13.7
 */
import { placeShip, isFleetReady, processShot, applyResult, check, serialize, TurnPhase, ShotError, } from "@sea-battle/domain";
/** Deserializes a JSON board string back into a Board with a proper Map. */
export function deserializeBoard(json) {
    const raw = JSON.parse(json);
    const cells = new Map(Object.entries(raw.cells));
    return {
        ownerId: raw.ownerId,
        cells,
        ships: raw.ships,
        ready: raw.ready,
    };
}
/** Serializes a Board to a JSON string (Map → plain object). */
export function serializeBoard(board) {
    return JSON.stringify({
        ownerId: board.ownerId,
        cells: Object.fromEntries(board.cells),
        ships: board.ships,
        ready: board.ready,
    });
}
/** Deserializes a TurnState from a JSON string. */
function deserializeTurnState(json) {
    return JSON.parse(json);
}
/** Serializes a TurnState to a JSON string. */
function serializeTurnState(state) {
    return JSON.stringify(state);
}
// ---------------------------------------------------------------------------
// GameService
// ---------------------------------------------------------------------------
export class GameService {
    // ---------------------------------------------------------------------------
    // handlePlacement
    // ---------------------------------------------------------------------------
    /**
     * Validates and records a ship placement for the given player.
     *
     * - Rejects if session.status !== 'Placement'
     * - Determines which board belongs to playerId
     * - Deserializes the board, calls PlacementEngine.placeShip, re-serializes
     * - If fleet is now ready, checks if both fleets are ready → transitions to 'Shooting'
     * - Returns updated SessionData
     */
    handlePlacement(session, playerId, placement) {
        // Reject if not in Placement phase
        if (session.status !== "Placement") {
            return { ok: false, error: "Not in Placement phase" };
        }
        // Determine which board belongs to this player
        const isPlayerA = session.playerA === playerId;
        const isPlayerB = session.playerB === playerId;
        if (!isPlayerA && !isPlayerB) {
            return { ok: false, error: "Player not in this session" };
        }
        const boardJson = isPlayerA ? session.boardA : session.boardB;
        const board = deserializeBoard(boardJson);
        // Attempt to place the ship
        const result = placeShip(board, placement);
        if (!result.ok) {
            return { ok: false, error: result.error };
        }
        const updatedBoard = result.value;
        const updatedBoardJson = serializeBoard(updatedBoard);
        // Build updated session with the new board
        let updatedSession = {
            ...session,
            boardA: isPlayerA ? updatedBoardJson : session.boardA,
            boardB: isPlayerB ? updatedBoardJson : session.boardB,
        };
        // Check if both fleets are now ready → transition to Shooting
        if (isFleetReady(updatedBoard)) {
            const otherBoardJson = isPlayerA ? updatedSession.boardB : updatedSession.boardA;
            const otherBoard = deserializeBoard(otherBoardJson);
            if (isFleetReady(otherBoard)) {
                // Both fleets ready — transition to Shooting phase
                const currentTurnState = deserializeTurnState(session.turnState);
                const newTurnState = {
                    ...currentTurnState,
                    phase: TurnPhase.Shooting,
                };
                updatedSession = {
                    ...updatedSession,
                    status: "Shooting",
                    turnState: serializeTurnState(newTurnState),
                };
            }
        }
        return { ok: true, value: updatedSession };
    }
    // ---------------------------------------------------------------------------
    // handleShot
    // ---------------------------------------------------------------------------
    /**
     * Processes a shot from the given player at the given coordinate.
     *
     * - Rejects if session.status !== 'Shooting'
     * - Rejects if playerId !== turnState.activePlayer (ShotError.NotYourTurn)
     * - Determines opponent's board
     * - Calls ShotEngine.processShot on opponent's board
     * - Updates turn state via TurnManager.applyResult
     * - Checks VictoryDetector.check on updated opponent board
     * - If victory: sets session.status to 'Finished'
     * - Returns updated session + ShotResultEvent
     */
    handleShot(session, playerId, coord) {
        // Reject if not in Shooting phase
        if (session.status !== "Shooting") {
            return { ok: false, error: "Not in Shooting phase" };
        }
        // Deserialize turn state and validate active player
        const turnState = deserializeTurnState(session.turnState);
        if (turnState.activePlayer !== playerId) {
            return { ok: false, error: ShotError.NotYourTurn };
        }
        // Determine opponent's board
        const isPlayerA = session.playerA === playerId;
        const isPlayerB = session.playerB === playerId;
        if (!isPlayerA && !isPlayerB) {
            return { ok: false, error: "Player not in this session" };
        }
        // playerA fires at boardB; playerB fires at boardA
        const opponentBoardJson = isPlayerA ? session.boardB : session.boardA;
        const opponentBoard = deserializeBoard(opponentBoardJson);
        // Process the shot
        const shotResult = processShot(opponentBoard, coord);
        if (!shotResult.ok) {
            return { ok: false, error: shotResult.error };
        }
        const { outcome, updatedBoard: updatedOpponentBoard, autoMarked } = shotResult.value;
        // Update turn state
        const playerA = session.playerA;
        const playerB = session.playerB;
        const players = [playerA, playerB];
        const newTurnState = applyResult(turnState, outcome, players);
        // Check for victory
        const victoryResult = check(updatedOpponentBoard);
        const winner = victoryResult.some ? victoryResult.value.playerId : undefined;
        // Build updated session
        const updatedOpponentBoardJson = serializeBoard(updatedOpponentBoard);
        let updatedSession = {
            ...session,
            boardA: isPlayerA ? session.boardA : updatedOpponentBoardJson,
            boardB: isPlayerA ? updatedOpponentBoardJson : session.boardB,
            turnState: serializeTurnState(newTurnState),
        };
        if (winner !== undefined) {
            updatedSession = {
                ...updatedSession,
                status: "Finished",
            };
        }
        // Build the ShotResultEvent
        // The winner field in the event is the shooter's playerId (the one who won),
        // but VictoryDetector returns the board owner (the loser). The winner is the shooter.
        const eventWinner = victoryResult.some ? playerId : undefined;
        const event = {
            type: "ShotResult",
            shooter: playerId,
            coord: serialize(coord),
            outcome,
            autoMarked: autoMarked.map((c) => serialize(c)),
            winner: eventWinner,
        };
        return { ok: true, value: { session: updatedSession, event } };
    }
}
//# sourceMappingURL=gameService.js.map