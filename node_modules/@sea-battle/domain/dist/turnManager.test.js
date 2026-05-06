/**
 * Unit tests for TurnManager.applyResult
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { applyResult } from "./turnManager.js";
import { ShotOutcome, TurnPhase } from "./types.js";
const PLAYER_A = "playerA";
const PLAYER_B = "playerB";
const PLAYERS = [PLAYER_A, PLAYER_B];
/** Helper: create a TurnState with the given active player in Shooting phase. */
function state(activePlayer) {
    return { activePlayer, phase: TurnPhase.Shooting };
}
describe("applyResult", () => {
    // -------------------------------------------------------------------------
    // Miss — switches active player
    // -------------------------------------------------------------------------
    describe("Miss switches active player", () => {
        it("switches from playerA to playerB on Miss", () => {
            const next = applyResult(state(PLAYER_A), ShotOutcome.Miss, PLAYERS);
            expect(next.activePlayer).toBe(PLAYER_B);
        });
        it("switches from playerB to playerA on Miss", () => {
            const next = applyResult(state(PLAYER_B), ShotOutcome.Miss, PLAYERS);
            expect(next.activePlayer).toBe(PLAYER_A);
        });
        it("preserves phase on Miss", () => {
            const next = applyResult(state(PLAYER_A), ShotOutcome.Miss, PLAYERS);
            expect(next.phase).toBe(TurnPhase.Shooting);
        });
    });
    // -------------------------------------------------------------------------
    // Hit — keeps active player
    // -------------------------------------------------------------------------
    describe("Hit keeps active player", () => {
        it("keeps playerA as active player on Hit", () => {
            const next = applyResult(state(PLAYER_A), ShotOutcome.Hit, PLAYERS);
            expect(next.activePlayer).toBe(PLAYER_A);
        });
        it("keeps playerB as active player on Hit", () => {
            const next = applyResult(state(PLAYER_B), ShotOutcome.Hit, PLAYERS);
            expect(next.activePlayer).toBe(PLAYER_B);
        });
        it("preserves phase on Hit", () => {
            const next = applyResult(state(PLAYER_A), ShotOutcome.Hit, PLAYERS);
            expect(next.phase).toBe(TurnPhase.Shooting);
        });
    });
    // -------------------------------------------------------------------------
    // Sunk — keeps active player
    // -------------------------------------------------------------------------
    describe("Sunk keeps active player", () => {
        it("keeps playerA as active player on Sunk", () => {
            const next = applyResult(state(PLAYER_A), ShotOutcome.Sunk, PLAYERS);
            expect(next.activePlayer).toBe(PLAYER_A);
        });
        it("keeps playerB as active player on Sunk", () => {
            const next = applyResult(state(PLAYER_B), ShotOutcome.Sunk, PLAYERS);
            expect(next.activePlayer).toBe(PLAYER_B);
        });
        it("preserves phase on Sunk", () => {
            const next = applyResult(state(PLAYER_A), ShotOutcome.Sunk, PLAYERS);
            expect(next.phase).toBe(TurnPhase.Shooting);
        });
    });
    // -------------------------------------------------------------------------
    // Multiple consecutive Hits keep the same player
    // -------------------------------------------------------------------------
    describe("Multiple consecutive Hits keep the same player", () => {
        it("playerA remains active after three consecutive Hits", () => {
            let current = state(PLAYER_A);
            current = applyResult(current, ShotOutcome.Hit, PLAYERS);
            current = applyResult(current, ShotOutcome.Hit, PLAYERS);
            current = applyResult(current, ShotOutcome.Hit, PLAYERS);
            expect(current.activePlayer).toBe(PLAYER_A);
        });
        it("playerB remains active after two consecutive Hits", () => {
            let current = state(PLAYER_B);
            current = applyResult(current, ShotOutcome.Hit, PLAYERS);
            current = applyResult(current, ShotOutcome.Hit, PLAYERS);
            expect(current.activePlayer).toBe(PLAYER_B);
        });
    });
    // -------------------------------------------------------------------------
    // Hit then Miss — switches player after the Miss
    // -------------------------------------------------------------------------
    describe("Hit then Miss switches player", () => {
        it("playerA stays after Hit, then switches to playerB after Miss", () => {
            let current = state(PLAYER_A);
            current = applyResult(current, ShotOutcome.Hit, PLAYERS);
            expect(current.activePlayer).toBe(PLAYER_A);
            current = applyResult(current, ShotOutcome.Miss, PLAYERS);
            expect(current.activePlayer).toBe(PLAYER_B);
        });
        it("multiple Hits followed by Miss switches player", () => {
            let current = state(PLAYER_A);
            current = applyResult(current, ShotOutcome.Hit, PLAYERS);
            current = applyResult(current, ShotOutcome.Hit, PLAYERS);
            current = applyResult(current, ShotOutcome.Miss, PLAYERS);
            expect(current.activePlayer).toBe(PLAYER_B);
        });
    });
    // -------------------------------------------------------------------------
    // Sunk then Miss — switches player after the Miss
    // -------------------------------------------------------------------------
    describe("Sunk then Miss switches player", () => {
        it("playerA stays after Sunk, then switches to playerB after Miss", () => {
            let current = state(PLAYER_A);
            current = applyResult(current, ShotOutcome.Sunk, PLAYERS);
            expect(current.activePlayer).toBe(PLAYER_A);
            current = applyResult(current, ShotOutcome.Miss, PLAYERS);
            expect(current.activePlayer).toBe(PLAYER_B);
        });
        it("Sunk then Sunk then Miss switches player", () => {
            let current = state(PLAYER_A);
            current = applyResult(current, ShotOutcome.Sunk, PLAYERS);
            current = applyResult(current, ShotOutcome.Sunk, PLAYERS);
            current = applyResult(current, ShotOutcome.Miss, PLAYERS);
            expect(current.activePlayer).toBe(PLAYER_B);
        });
    });
    // -------------------------------------------------------------------------
    // Immutability
    // -------------------------------------------------------------------------
    describe("Immutability: input state is not mutated", () => {
        it("returns a new state object on Miss", () => {
            const original = state(PLAYER_A);
            const next = applyResult(original, ShotOutcome.Miss, PLAYERS);
            expect(next).not.toBe(original);
            expect(original.activePlayer).toBe(PLAYER_A); // unchanged
        });
        it("returns a new state object on Hit", () => {
            const original = state(PLAYER_A);
            const next = applyResult(original, ShotOutcome.Hit, PLAYERS);
            expect(next).not.toBe(original);
            expect(original.activePlayer).toBe(PLAYER_A); // unchanged
        });
    });
});
// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------
// Feature: sea-battle-game, Property 9: Turn transitions follow shot outcome
describe("Property 9: Turn transitions follow shot outcome", () => {
    it("active player switches on Miss and stays on Hit/Sunk for any TurnState and outcome sequence — Validates: Requirements 7.1, 7.2, 7.3, 7.4", () => {
        // Arbitrary: two distinct player IDs
        const playerPairArb = fc
            .uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 2 })
            .map((arr) => [arr[0], arr[1]]);
        // Arbitrary: a random ShotOutcome
        const outcomeArb = fc.constantFrom(ShotOutcome.Miss, ShotOutcome.Hit, ShotOutcome.Sunk);
        // Arbitrary: a non-empty sequence of ShotOutcome values (1–20 outcomes)
        const outcomeSeqArb = fc.array(outcomeArb, { minLength: 1, maxLength: 20 });
        fc.assert(fc.property(playerPairArb, outcomeSeqArb, (players, outcomes) => {
            const [playerA, playerB] = players;
            // Start with playerA as the active player
            let state = { activePlayer: playerA, phase: TurnPhase.Shooting };
            for (const outcome of outcomes) {
                const prevActive = state.activePlayer;
                const next = applyResult(state, outcome, players);
                if (outcome === ShotOutcome.Miss) {
                    // Active player must switch to the other player
                    const expectedNext = prevActive === playerA ? playerB : playerA;
                    if (next.activePlayer !== expectedNext)
                        return false;
                }
                else {
                    // Hit or Sunk — active player must remain the same
                    if (next.activePlayer !== prevActive)
                        return false;
                }
                // Phase must be preserved
                if (next.phase !== state.phase)
                    return false;
                // Input state must not be mutated
                if (state.activePlayer !== prevActive)
                    return false;
                state = next;
            }
            return true;
        }), { numRuns: 100 });
    });
});
//# sourceMappingURL=turnManager.test.js.map