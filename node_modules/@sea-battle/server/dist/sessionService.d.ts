/**
 * SessionService — manages game sessions and invite-code flow.
 *
 * Designed for dependency injection: pass a `SessionQueries` interface in the
 * constructor so tests can use an in-memory store without touching the DB.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */
import type { SessionRow } from "./db.js";
export interface SessionData {
    id: string;
    inviteCode: string | null;
    playerA: string;
    playerB: string | null;
    boardA: string;
    boardB: string;
    turnState: string;
    status: "WaitingForPlayers" | "Placement" | "Shooting" | "Finished";
    disconnected: Record<string, string>;
    createdAt: string;
}
export type SessionError = "InvalidInviteCode" | "SessionFull" | "SessionNotFound";
export type Result<T, E> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: E;
};
export interface SessionQueries {
    insert(row: SessionRow): unknown;
    findById(id: string): SessionRow | undefined;
    findByInviteCode(code: string): SessionRow | undefined;
    update(row: SessionRow): unknown;
    delete(id: string): unknown;
}
export declare class SessionService {
    private readonly queries;
    constructor(queries: SessionQueries);
    /**
     * Creates a new session for playerA.
     *
     * - Generates a UUID sessionId and 6-char alphanumeric inviteCode
     * - Creates empty boards for both players (playerB board uses placeholder id)
     * - Sets status to 'WaitingForPlayers'
     * - Persists to DB
     * - Returns SessionData
     */
    createSession(playerA: string): SessionData;
    /**
     * Joins an existing session using an invite code.
     *
     * - Looks up open session by invite code
     * - Rejects with InvalidInviteCode if not found
     * - Rejects with SessionFull if playerB already set
     * - Sets playerB, transitions status to 'Placement'
     * - Persists updated session
     * - Returns updated SessionData
     */
    joinSession(inviteCode: string, playerB: string): Result<SessionData, SessionError>;
    /**
     * Looks up a session by sessionId.
     * Returns undefined if not found.
     */
    getSession(sessionId: string): SessionData | undefined;
    /**
     * Persists an updated session to the DB.
     */
    updateSession(session: SessionData): void;
}
export declare function createDefaultSessionService(): Promise<SessionService>;
//# sourceMappingURL=sessionService.d.ts.map