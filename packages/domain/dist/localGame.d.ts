/**
 * LocalGame — orchestrates PlacementEngine, ShotEngine, TurnManager, and
 * VictoryDetector for local two-player and single-player vs AI modes.
 *
 * Requirements: 5.1, 5.3, 5.4, 9.3, 9.4, 12.1, 12.4, 12.5, 12.6
 */
import { type Board, type Coordinate, type PlacementError, type Result, type ShipPlacement, type ShotError, type ShotResult, TurnPhase, type Winner } from "./types.js";
/** Snapshot of the current game state returned by LocalGame.getState(). */
export interface LocalGameState {
    phase: TurnPhase;
    activePlayer: string;
    boardA: Board;
    boardB: Board;
    winner?: Winner;
}
/**
 * Wires together the domain engines for local (offline) play.
 *
 * Modes:
 *   - 'local': two human players take turns on the same device.
 *   - 'ai':    one human player (playerA) vs the AI opponent (playerB = "ai").
 *
 * In 'ai' mode the AI fleet is placed automatically during construction;
 * playerA still needs to place their ships manually before calling startMatch.
 */
export declare class LocalGame {
    private readonly mode;
    private readonly playerAId;
    private readonly playerBId;
    private boardA;
    private boardB;
    private turnState;
    private winner;
    constructor(mode: "local" | "ai", playerAId: string, playerBId?: string);
    /**
     * Places a ship for the given player.
     *
     * Rejects if:
     *   - phase !== Placement
     *   - playerId doesn't match either player
     *   - the placement itself is invalid (delegates to PlacementEngine)
     *
     * Requirements: 5.1
     */
    placeShip(playerId: string, placement: ShipPlacement): Result<void, PlacementError | string>;
    /**
     * Transitions from Placement to Shooting phase.
     *
     * Fails if either fleet is not ready (isFleetReady returns false).
     *
     * Requirements: 5.3, 5.4
     */
    startMatch(): Result<void, string>;
    /**
     * Fires a shot on behalf of the given player.
     *
     * Rules:
     *   - Rejects if phase !== Shooting (Requirement 9.3)
     *   - Rejects if playerId !== activePlayer (wrong turn)
     *   - Shot is fired at the OPPONENT's board
     *   - Processes via ShotEngine, updates TurnManager, checks VictoryDetector
     *   - In AI mode: after a human Miss, automatically runs AI turns until the
     *     AI fires a Miss or the game ends (Requirements 12.4, 12.5, 12.6)
     *
     * Returns the human player's ShotResult (not the AI's follow-up shots).
     *
     * Requirements: 5.3, 9.3, 9.4, 12.4, 12.5, 12.6
     */
    fireShot(playerId: string, coord: Coordinate): Result<ShotResult & {
        winner?: Winner;
    }, ShotError | string>;
    /**
     * Returns a snapshot of the current game state.
     *
     * Requirements: 9.4
     */
    getState(): LocalGameState;
    /**
     * Runs AI turns automatically until the AI fires a Miss or the game ends.
     * Called after a human Miss in AI mode.
     */
    private runAiTurns;
}
//# sourceMappingURL=localGame.d.ts.map