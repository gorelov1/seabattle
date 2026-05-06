/**
 * MatchmakingService — manages the matchmaking queue.
 *
 * Designed for dependency injection: pass a `MatchmakingQueries` interface in
 * the constructor so tests can use an in-memory store without touching the DB.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */
import type { MatchmakingQueueRow } from "./db.js";
export interface QueueTicket {
    playerId: string;
    queuedAt: string;
}
export interface MatchmakingQueries {
    enqueue(row: MatchmakingQueueRow): unknown;
    getAll(): MatchmakingQueueRow[];
    dequeue(playerId: string): unknown;
    clear(): unknown;
}
export declare class MatchmakingService {
    private readonly queries;
    constructor(queries: MatchmakingQueries);
    /**
     * Adds a player to the matchmaking queue.
     * Returns a QueueTicket with the player's id and the time they were queued.
     */
    enqueue(playerId: string): QueueTicket;
    /**
     * Removes ONLY the specified player from the queue.
     * All other players remain unchanged.
     */
    dequeue(playerId: string): void;
    /**
     * If the queue has ≥2 players, removes the first two (oldest first) and
     * returns them as a pair [playerA, playerB].
     * Otherwise returns null.
     */
    tryPair(): [string, string] | null;
    /**
     * Returns all players in queue order (oldest first).
     */
    getQueue(): QueueTicket[];
}
export declare function createDefaultMatchmakingService(): Promise<MatchmakingService>;
//# sourceMappingURL=matchmakingService.d.ts.map