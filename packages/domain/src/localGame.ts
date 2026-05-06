/**
 * LocalGame — orchestrates PlacementEngine, ShotEngine, TurnManager, and
 * VictoryDetector for local two-player and single-player vs AI modes.
 *
 * Requirements: 5.1, 5.3, 5.4, 9.3, 9.4, 12.1, 12.4, 12.5, 12.6
 */

import {
  type Board,
  type Coordinate,
  type PlacementError,
  type Result,
  type ShipPlacement,
  type ShotError,
  type ShotResult,
  ShotOutcome,
  TurnPhase,
  type TurnState,
  type Winner,
  FLEET_SPEC,
} from "./types.js";
import { createEmptyBoard, placeShip, isFleetReady } from "./placementEngine.js";
import { processShot } from "./shotEngine.js";
import { applyResult } from "./turnManager.js";
import { check as checkVictory } from "./victoryDetector.js";
import { placeFleet, chooseShot } from "./aiOpponent.js";

// ---------------------------------------------------------------------------
// LocalGameState
// ---------------------------------------------------------------------------

/** Snapshot of the current game state returned by LocalGame.getState(). */
export interface LocalGameState {
  phase: TurnPhase;
  activePlayer: string;
  boardA: Board;  // player A's board
  boardB: Board;  // player B's board
  winner?: Winner;
}

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
  private readonly mode: "local" | "ai";
  private readonly playerAId: string;
  private readonly playerBId: string;

  private boardA: Board;
  private boardB: Board;
  private turnState: TurnState;
  private winner: Winner | undefined;

  constructor(mode: "local" | "ai", playerAId: string, playerBId?: string) {
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
    } else {
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
  placeShip(
    playerId: string,
    placement: ShipPlacement
  ): Result<void, PlacementError | string> {
    if (this.turnState.phase !== TurnPhase.Placement) {
      return { ok: false, error: "Cannot place ships outside of placement phase" };
    }

    if (playerId === this.playerAId) {
      const result = placeShip(this.boardA, placement);
      if (!result.ok) return result;
      this.boardA = result.value;
      return { ok: true, value: undefined };
    }

    if (playerId === this.playerBId) {
      const result = placeShip(this.boardB, placement);
      if (!result.ok) return result;
      this.boardB = result.value;
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
  startMatch(): Result<void, string> {
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
  fireShot(
    playerId: string,
    coord: Coordinate
  ): Result<ShotResult & { winner?: Winner }, ShotError | string> {
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
    } else {
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
    this.turnState = applyResult(
      this.turnState,
      outcome,
      [this.playerAId, this.playerBId]
    );

    const humanResult: ShotResult & { winner?: Winner } = {
      outcome,
      updatedBoard,
      autoMarked,
    };

    // In AI mode: if the human fired a Miss, the turn switches to AI.
    // Run AI turns automatically until the AI fires a Miss or the game ends.
    if (
      this.mode === "ai" &&
      outcome === ShotOutcome.Miss &&
      this.turnState.phase === TurnPhase.Shooting
    ) {
      this.runAiTurns();
    }

    // Attach winner if the game ended during AI turns
    if (this.winner !== undefined) {
      humanResult.winner = this.winner;
    }

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
  getState(): LocalGameState {
    const state: LocalGameState = {
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
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Runs AI turns automatically until the AI fires a Miss or the game ends.
   * Called after a human Miss in AI mode.
   */
  private runAiTurns(): void {
    while (
      this.turnState.phase === TurnPhase.Shooting &&
      this.turnState.activePlayer === this.playerBId
    ) {
      // AI fires at player A's board
      const aiCoord = chooseShot(this.boardA);
      const aiShotResult = processShot(this.boardA, aiCoord);

      if (!aiShotResult.ok) {
        // Should never happen (AI always picks an Unshot cell), but guard anyway
        break;
      }

      const { outcome: aiOutcome, updatedBoard: aiUpdatedBoard } = aiShotResult.value;
      this.boardA = aiUpdatedBoard;

      // Check for AI victory
      const victoryOption = checkVictory(aiUpdatedBoard);
      if (victoryOption.some) {
        // AI is the winner (the shooter)
        this.winner = { playerId: this.playerBId };
        this.turnState = { ...this.turnState, phase: TurnPhase.Finished };
        return;
      }

      // Update turn state
      this.turnState = applyResult(
        this.turnState,
        aiOutcome,
        [this.playerAId, this.playerBId]
      );

      // If AI fired a Miss, turn switches back to human — stop the loop
      if (aiOutcome === ShotOutcome.Miss) {
        break;
      }
      // If AI fired Hit or Sunk, it keeps its turn — loop continues
    }
  }
}
