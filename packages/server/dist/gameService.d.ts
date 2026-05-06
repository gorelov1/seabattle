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
import { ShotError, ShotOutcome, type Board, type ShipPlacement, type Coordinate, type PlacementError } from "@sea-battle/domain";
import type { SessionData, Result } from "./sessionService.js";
export interface ShotResultEvent {
    type: "ShotResult";
    shooter: string;
    coord: string;
    outcome: ShotOutcome;
    autoMarked: string[];
    winner?: string;
}
/** Deserializes a JSON board string back into a Board with a proper Map. */
export declare function deserializeBoard(json: string): Board;
/** Serializes a Board to a JSON string (Map → plain object). */
export declare function serializeBoard(board: Board): string;
export declare class GameService {
    /**
     * Validates and records a ship placement for the given player.
     *
     * - Rejects if session.status !== 'Placement'
     * - Determines which board belongs to playerId
     * - Deserializes the board, calls PlacementEngine.placeShip, re-serializes
     * - If fleet is now ready, checks if both fleets are ready → transitions to 'Shooting'
     * - Returns updated SessionData
     */
    handlePlacement(session: SessionData, playerId: string, placement: ShipPlacement): Result<SessionData, PlacementError | string>;
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
    handleShot(session: SessionData, playerId: string, coord: Coordinate): Result<{
        session: SessionData;
        event: ShotResultEvent;
    }, ShotError | string>;
}
//# sourceMappingURL=gameService.d.ts.map