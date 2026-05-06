/**
 * TurnManager — pure state machine for managing turn transitions.
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { type PlayerId, ShotOutcome, type TurnState } from "./types.js";

/**
 * Applies a shot outcome to the current turn state and returns the new state.
 *
 * Rules:
 *   - Miss → switch activePlayer to the other player
 *   - Hit  → keep activePlayer unchanged
 *   - Sunk → keep activePlayer unchanged
 *
 * The function is a pure state machine — no I/O, no side effects, immutable.
 *
 * @param state   The current turn state.
 * @param result  The outcome of the shot just fired.
 * @param players The two player IDs in the game. Used to determine the "other"
 *                player when switching on a Miss.
 * @returns A new TurnState (the input is never mutated).
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
export function applyResult(
  state: TurnState,
  result: ShotOutcome,
  players: [PlayerId, PlayerId]
): TurnState {
  if (result === ShotOutcome.Miss) {
    // Switch to the other player
    const otherPlayer =
      players[0] === state.activePlayer ? players[1] : players[0];
    return { ...state, activePlayer: otherPlayer };
  }

  // Hit or Sunk — keep the same active player
  return { ...state };
}
