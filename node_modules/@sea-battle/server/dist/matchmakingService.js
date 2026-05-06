/**
 * MatchmakingService — manages the matchmaking queue.
 *
 * Designed for dependency injection: pass a `MatchmakingQueries` interface in
 * the constructor so tests can use an in-memory store without touching the DB.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */
// ---------------------------------------------------------------------------
// MatchmakingService
// ---------------------------------------------------------------------------
export class MatchmakingService {
    queries;
    constructor(queries) {
        this.queries = queries;
    }
    /**
     * Adds a player to the matchmaking queue.
     * Returns a QueueTicket with the player's id and the time they were queued.
     */
    enqueue(playerId) {
        const queuedAt = new Date().toISOString();
        const row = { player_id: playerId, queued_at: queuedAt };
        this.queries.enqueue(row);
        return { playerId, queuedAt };
    }
    /**
     * Removes ONLY the specified player from the queue.
     * All other players remain unchanged.
     */
    dequeue(playerId) {
        this.queries.dequeue(playerId);
    }
    /**
     * If the queue has ≥2 players, removes the first two (oldest first) and
     * returns them as a pair [playerA, playerB].
     * Otherwise returns null.
     */
    tryPair() {
        const all = this.queries.getAll();
        if (all.length < 2)
            return null;
        const first = all[0];
        const second = all[1];
        // Remove both players from the queue
        this.queries.dequeue(first.player_id);
        this.queries.dequeue(second.player_id);
        return [first.player_id, second.player_id];
    }
    /**
     * Returns all players in queue order (oldest first).
     */
    getQueue() {
        return this.queries.getAll().map((row) => ({
            playerId: row.player_id,
            queuedAt: row.queued_at,
        }));
    }
}
// ---------------------------------------------------------------------------
// Factory helper — creates a MatchmakingService backed by the real DB.
// ---------------------------------------------------------------------------
export async function createDefaultMatchmakingService() {
    const { matchmakingQueries } = await import("./db.js");
    return new MatchmakingService(matchmakingQueries);
}
//# sourceMappingURL=matchmakingService.js.map