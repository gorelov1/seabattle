/**
 * Unit tests for MatchmakingService.
 *
 * Uses a simple in-memory store (array-based) for dependency injection so that
 * tests run without any native binaries.
 */
import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { MatchmakingService } from "./matchmakingService.js";
// ---------------------------------------------------------------------------
// In-memory store implementation
// ---------------------------------------------------------------------------
function createInMemoryMatchmakingQueries() {
    const queue = [];
    return {
        _queue: queue,
        enqueue(row) {
            queue.push({ ...row });
        },
        getAll() {
            // Return a copy sorted by queued_at (oldest first)
            return [...queue].sort((a, b) => a.queued_at.localeCompare(b.queued_at));
        },
        dequeue(playerId) {
            const idx = queue.findIndex((r) => r.player_id === playerId);
            if (idx !== -1)
                queue.splice(idx, 1);
        },
        clear() {
            queue.splice(0, queue.length);
        },
    };
}
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("MatchmakingService.enqueue", () => {
    let service;
    let store;
    beforeEach(() => {
        store = createInMemoryMatchmakingQueries();
        service = new MatchmakingService(store);
    });
    it("adds a player to the queue", () => {
        service.enqueue("player-1");
        expect(store._queue).toHaveLength(1);
        expect(store._queue[0].player_id).toBe("player-1");
    });
    it("returns a QueueTicket with the correct playerId", () => {
        const ticket = service.enqueue("player-1");
        expect(ticket.playerId).toBe("player-1");
    });
    it("returns a QueueTicket with a valid ISO timestamp", () => {
        const before = new Date().toISOString();
        const ticket = service.enqueue("player-1");
        const after = new Date().toISOString();
        expect(ticket.queuedAt >= before).toBe(true);
        expect(ticket.queuedAt <= after).toBe(true);
    });
    it("adds multiple players to the queue", () => {
        service.enqueue("player-1");
        service.enqueue("player-2");
        service.enqueue("player-3");
        expect(store._queue).toHaveLength(3);
    });
});
describe("MatchmakingService.dequeue", () => {
    let service;
    let store;
    beforeEach(() => {
        store = createInMemoryMatchmakingQueries();
        service = new MatchmakingService(store);
    });
    it("removes only the specified player from the queue", () => {
        service.enqueue("player-1");
        service.enqueue("player-2");
        service.enqueue("player-3");
        service.dequeue("player-2");
        const remaining = store._queue.map((r) => r.player_id);
        expect(remaining).toContain("player-1");
        expect(remaining).not.toContain("player-2");
        expect(remaining).toContain("player-3");
        expect(store._queue).toHaveLength(2);
    });
    it("leaves all other players unchanged after dequeue", () => {
        service.enqueue("alice");
        service.enqueue("bob");
        service.enqueue("charlie");
        service.dequeue("bob");
        const queue = service.getQueue();
        expect(queue.map((t) => t.playerId)).toEqual(expect.arrayContaining(["alice", "charlie"]));
        expect(queue.map((t) => t.playerId)).not.toContain("bob");
    });
    it("does nothing when the player is not in the queue", () => {
        service.enqueue("player-1");
        service.dequeue("player-99");
        expect(store._queue).toHaveLength(1);
    });
});
describe("MatchmakingService.tryPair", () => {
    let service;
    let store;
    beforeEach(() => {
        store = createInMemoryMatchmakingQueries();
        service = new MatchmakingService(store);
    });
    it("returns null when the queue is empty", () => {
        expect(service.tryPair()).toBeNull();
    });
    it("returns null when the queue has only one player", () => {
        service.enqueue("player-1");
        expect(service.tryPair()).toBeNull();
    });
    it("returns a pair of players when the queue has ≥2 players", () => {
        service.enqueue("player-1");
        service.enqueue("player-2");
        const pair = service.tryPair();
        expect(pair).not.toBeNull();
        expect(pair).toHaveLength(2);
    });
    it("returns the two oldest players in the queue", () => {
        service.enqueue("player-1");
        service.enqueue("player-2");
        service.enqueue("player-3");
        const pair = service.tryPair();
        expect(pair).not.toBeNull();
        expect(pair[0]).toBe("player-1");
        expect(pair[1]).toBe("player-2");
    });
    it("removes both paired players from the queue", () => {
        service.enqueue("player-1");
        service.enqueue("player-2");
        service.enqueue("player-3");
        service.tryPair();
        const remaining = service.getQueue();
        expect(remaining).toHaveLength(1);
        expect(remaining[0].playerId).toBe("player-3");
    });
    it("leaves the queue empty after pairing exactly two players", () => {
        service.enqueue("player-1");
        service.enqueue("player-2");
        service.tryPair();
        expect(service.getQueue()).toHaveLength(0);
    });
});
describe("MatchmakingService.getQueue", () => {
    let service;
    beforeEach(() => {
        const store = createInMemoryMatchmakingQueries();
        service = new MatchmakingService(store);
    });
    it("returns an empty array when the queue is empty", () => {
        expect(service.getQueue()).toEqual([]);
    });
    it("returns players in queue order (oldest first)", () => {
        service.enqueue("player-1");
        service.enqueue("player-2");
        service.enqueue("player-3");
        const queue = service.getQueue();
        expect(queue).toHaveLength(3);
        expect(queue[0].playerId).toBe("player-1");
        expect(queue[1].playerId).toBe("player-2");
        expect(queue[2].playerId).toBe("player-3");
    });
    it("returns QueueTickets with playerId and queuedAt fields", () => {
        service.enqueue("player-1");
        const queue = service.getQueue();
        expect(typeof queue[0].playerId).toBe("string");
        expect(typeof queue[0].queuedAt).toBe("string");
    });
});
// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------
describe("Property 22: Matchmaking dequeue removes only the specified player", () => {
    // Feature: sea-battle-game, Property 22: Matchmaking dequeue removes only the specified player
    it("dequeuing one player removes exactly that player and leaves all others unchanged", () => {
        // Generator: list of 2–10 unique player IDs
        const uniquePlayerIdsArb = fc
            .uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), {
            minLength: 2,
            maxLength: 10,
        });
        fc.assert(fc.property(uniquePlayerIdsArb, (playerIds) => {
            // Build a fresh service for each run
            const queue = [];
            const store = {
                _queue: queue,
                enqueue(row) {
                    queue.push({ ...row });
                },
                getAll() {
                    return [...queue].sort((a, b) => a.queued_at.localeCompare(b.queued_at));
                },
                dequeue(playerId) {
                    const idx = queue.findIndex((r) => r.player_id === playerId);
                    if (idx !== -1)
                        queue.splice(idx, 1);
                },
                clear() {
                    queue.splice(0, queue.length);
                },
            };
            const service = new MatchmakingService(store);
            // Enqueue all players
            for (const id of playerIds) {
                service.enqueue(id);
            }
            // Pick one player to dequeue (use the first one for determinism)
            const targetPlayer = playerIds[0];
            const remainingPlayers = playerIds.slice(1);
            service.dequeue(targetPlayer);
            const queueAfter = service.getQueue();
            const idsAfter = queueAfter.map((t) => t.playerId);
            // The dequeued player must no longer be in the queue
            const targetStillPresent = idsAfter.includes(targetPlayer);
            // All other players must still be in the queue
            const allOthersPresent = remainingPlayers.every((id) => idsAfter.includes(id));
            // Queue length must be exactly one less than the original
            const correctLength = idsAfter.length === playerIds.length - 1;
            return !targetStillPresent && allOthersPresent && correctLength;
        }), { numRuns: 100 });
    });
});
// ---------------------------------------------------------------------------
// Integration tests — matchmaking queue full flow
// ---------------------------------------------------------------------------
describe("Matchmaking queue integration: two-player pairing", () => {
    let service;
    let store;
    beforeEach(() => {
        store = createInMemoryMatchmakingQueries();
        service = new MatchmakingService(store);
    });
    it("pairs two enqueued players into a session and removes both from the queue", () => {
        // Step 1: Enqueue player A
        const ticketA = service.enqueue("player-A");
        expect(ticketA.playerId).toBe("player-A");
        // Step 2: Enqueue player B
        const ticketB = service.enqueue("player-B");
        expect(ticketB.playerId).toBe("player-B");
        // Verify both are in the queue before pairing
        expect(service.getQueue()).toHaveLength(2);
        // Step 3: Call tryPair()
        const pair = service.tryPair();
        // Step 4: Verify both players are paired into a new session
        expect(pair).not.toBeNull();
        expect(pair).toHaveLength(2);
        expect(pair[0]).toBe("player-A");
        expect(pair[1]).toBe("player-B");
        // Step 5: Verify both players are removed from the queue
        expect(service.getQueue()).toHaveLength(0);
        const queueIds = service.getQueue().map((t) => t.playerId);
        expect(queueIds).not.toContain("player-A");
        expect(queueIds).not.toContain("player-B");
    });
    it("returns a pair with playerA as first and playerB as second (oldest-first order)", () => {
        service.enqueue("player-A");
        service.enqueue("player-B");
        const pair = service.tryPair();
        expect(pair).not.toBeNull();
        // The session has both players set: playerA is the first enqueued, playerB is the second
        const [sessionPlayerA, sessionPlayerB] = pair;
        expect(sessionPlayerA).toBe("player-A");
        expect(sessionPlayerB).toBe("player-B");
    });
});
describe("Matchmaking queue integration: single player stays in queue", () => {
    let service;
    beforeEach(() => {
        const store = createInMemoryMatchmakingQueries();
        service = new MatchmakingService(store);
    });
    it("returns null when only one player is enqueued and player stays in queue", () => {
        // Enqueue one player
        service.enqueue("player-A");
        // tryPair should return null — not enough players
        const pair = service.tryPair();
        expect(pair).toBeNull();
        // Player A must still be in the queue
        const queue = service.getQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0].playerId).toBe("player-A");
    });
});
describe("Matchmaking queue integration: three players — first two paired, third remains", () => {
    let service;
    beforeEach(() => {
        const store = createInMemoryMatchmakingQueries();
        service = new MatchmakingService(store);
    });
    it("pairs the first two players and leaves the third in the queue", () => {
        // Enqueue three players in order
        service.enqueue("player-A");
        service.enqueue("player-B");
        service.enqueue("player-C");
        expect(service.getQueue()).toHaveLength(3);
        // tryPair should pair the first two (oldest first)
        const pair = service.tryPair();
        expect(pair).not.toBeNull();
        expect(pair[0]).toBe("player-A");
        expect(pair[1]).toBe("player-B");
        // Only player-C should remain in the queue
        const remaining = service.getQueue();
        expect(remaining).toHaveLength(1);
        expect(remaining[0].playerId).toBe("player-C");
    });
});
//# sourceMappingURL=matchmakingService.test.js.map