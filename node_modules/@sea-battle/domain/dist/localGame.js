/**
 * LocalGame — orchestrates PlacementEngine, ShotEngine, TurnManager, and
 * VictoryDetector for local two-player and single-player vs AI modes.
 *
 * Requirements: 5.1, 5.3, 5.4, 9.3, 9.4, 12.1, 12.4, 12.5, 12.6
 */
import { TurnPhase, FLEET_SPEC, } from "./types.js";
import { createEmptyBoard, placeShip, isFleetReady, removeShip } from "./placementEngine.js";
import { processShot } from "./shotEngine.js";
import { applyResult } from "./turnManager.js";
import { check as checkVictory } from "./victoryDetector.js";
import { placeFleet, chooseShot } from "./aiOpponent.js";
// ---------------------------------------------------------------------------
// LocalGame
// ---------------------------------------------------------------------------
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
export class LocalGame {
    mode;
    playerAId;
    playerBId;
    boardA;
    boardB;
    turnState;
    winner;
    constructor(mode, playerAId, playerBId) {
        this.mode = mode;
        this.playerAId = playerAId;
        this.playerBId = mode === "ai" ? (playerBId ?? "ai") : (playerBId ?? "");
        // Create empty board for player A — they must place ships manually
        this.boardA = createEmptyBoard(this.playerAId);
        if (mode === "ai") {
            // AI places its fleet automatically; board is immediately ready
            this.boardB = placeFleet(FLEET_SPEC);
            // Override ownerId to match playerBId
            this.boardB = { ...this.boardB, ownerId: this.playerBId };
        }
        else {
            // Local mode: player B also places ships manually
            this.boardB = createEmptyBoard(this.playerBId);
        }
        // Start in Placement phase; activePlayer is playerA
        this.turnState = {
            activePlayer: this.playerAId,
            phase: TurnPhase.Placement,
        };
        this.winner = undefined;
    }
    // -------------------------------------------------------------------------
    // placeShip
    // -------------------------------------------------------------------------
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
    placeShip(playerId, placement) {
        if (this.turnState.phase !== TurnPhase.Placement) {
            return { ok: false, error: "Cannot place ships outside of placement phase" };
        }
        if (playerId === this.playerAId) {
            const result = placeShip(this.boardA, placement);
            if (!result.ok)
                return result;
            this.boardA = result.value;
            return { ok: true, value: undefined };
        }
        if (playerId === this.playerBId) {
            const result = placeShip(this.boardB, placement);
            if (!result.ok)
                return result;
            this.boardB = result.value;
            return { ok: true, value: undefined };
        }
        return { ok: false, error: "Unknown player ID" };
    }
    // -------------------------------------------------------------------------
    // removeShip
    // -------------------------------------------------------------------------
    /**
     * Removes the ship occupying the given coordinate from the player's board.
     * Only valid during the Placement phase.
     */
    removeShip(playerId, coord) {
        if (this.turnState.phase !== TurnPhase.Placement) {
            return { ok: false, error: "Cannot remove ships outside of placement phase" };
        }
        if (playerId === this.playerAId) {
            this.boardA = removeShip(this.boardA, coord);
            return { ok: true, value: undefined };
        }
        if (playerId === this.playerBId) {
            this.boardB = removeShip(this.boardB, coord);
            return { ok: true, value: undefined };
        }
        return { ok: false, error: "Unknown player ID" };
    }
    // -------------------------------------------------------------------------
    // startMatch
    // -------------------------------------------------------------------------
    /**
     * Transitions from Placement to Shooting phase.
     *
     * Fails if either fleet is not ready (isFleetReady returns false).
     *
     * Requirements: 5.3, 5.4
     */
    startMatch() {
        if (this.turnState.phase !== TurnPhase.Placement) {
            return { ok: false, error: "Match has already started" };
        }
        if (!isFleetReady(this.boardA)) {
            return { ok: false, error: "Player A fleet is not ready" };
        }
        if (!isFleetReady(this.boardB)) {
            return { ok: false, error: "Player B fleet is not ready" };
        }
        this.turnState = {
            activePlayer: this.playerAId,
            phase: TurnPhase.Shooting,
        };
        return { ok: true, value: undefined };
    }
    // -------------------------------------------------------------------------
    // fireShot
    // -------------------------------------------------------------------------
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
    fireShot(playerId, coord) {
        if (this.turnState.phase !== TurnPhase.Shooting) {
            return { ok: false, error: "Cannot fire a shot outside of shooting phase" };
        }
        if (playerId !== this.turnState.activePlayer) {
            return { ok: false, error: "It is not your turn" };
        }
        // Determine which board is the target (opponent's board)
        const isPlayerA = playerId === this.playerAId;
        const targetBoard = isPlayerA ? this.boardB : this.boardA;
        // Process the shot
        const shotResult = processShot(targetBoard, coord);
        if (!shotResult.ok) {
            return shotResult;
        }
        const { outcome, updatedBoard, autoMarked } = shotResult.value;
        // Update the opponent's board
        if (isPlayerA) {
            this.boardB = updatedBoard;
        }
        else {
            this.boardA = updatedBoard;
        }
        // Check for victory on the updated opponent board
        const victoryOption = checkVictory(updatedBoard);
        if (victoryOption.some) {
            // The winner is the player who fired the shot (the shooter), not the board owner
            this.winner = { playerId: playerId };
            this.turnState = { ...this.turnState, phase: TurnPhase.Finished };
            return {
                ok: true,
                value: { outcome, updatedBoard, autoMarked, winner: this.winner },
            };
        }
        // Update turn state
        this.turnState = applyResult(this.turnState, outcome, [this.playerAId, this.playerBId]);
        const humanResult = {
            outcome,
            updatedBoard,
            autoMarked,
        };
        return { ok: true, value: humanResult };
    }
    // -------------------------------------------------------------------------
    // getState
    // -------------------------------------------------------------------------
    /**
     * Returns a snapshot of the current game state.
     *
     * Requirements: 9.4
     */
    getState() {
        const state = {
            phase: this.turnState.phase,
            activePlayer: this.turnState.activePlayer,
            boardA: this.boardA,
            boardB: this.boardB,
        };
        if (this.winner !== undefined) {
            state.winner = this.winner;
        }
        return state;
    }
    // -------------------------------------------------------------------------
    // fireAiShot
    // -------------------------------------------------------------------------
    /**
     * Fires one shot on behalf of the AI opponent (playerB in 'ai' mode).
     * The AI chooses its coordinate automatically via chooseShot.
     *
     * Returns the shot result, or an error if it's not the AI's turn.
     * The caller is responsible for calling this repeatedly (with delays)
     * until the AI misses or the game ends.
     */
    fireAiShot() {
        if (this.mode !== "ai") {
            return { ok: false, error: "Not in AI mode" };
        }
        if (this.turnState.activePlayer !== this.playerBId) {
            return { ok: false, error: "Not the AI's turn" };
        }
        const aiCoord = chooseShot(this.boardA);
        const shotResult = processShot(this.boardA, aiCoord);
        if (!shotResult.ok) {
            return { ok: false, error: "AI shot failed" };
        }
        const { outcome, updatedBoard, autoMarked } = shotResult.value;
        this.boardA = updatedBoard;
        const victoryOption = checkVictory(updatedBoard);
        if (victoryOption.some) {
            this.winner = { playerId: this.playerBId };
            this.turnState = { ...this.turnState, phase: TurnPhase.Finished };
            return { ok: true, value: { outcome, updatedBoard, autoMarked, winner: this.winner } };
        }
        this.turnState = applyResult(this.turnState, outcome, [this.playerAId, this.playerBId]);
        return { ok: true, value: { outcome, updatedBoard, autoMarked } };
    }
    /** Returns true when it is the AI's turn to shoot. */
    isAiTurn() {
        return (this.mode === "ai" &&
            this.turnState.phase === TurnPhase.Shooting &&
            this.turnState.activePlayer === this.playerBId);
    }
}
//# sourceMappingURL=localGame.js.map