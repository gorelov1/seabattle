/**
 * Database module — opens a SQLite database, runs migrations on startup,
 * and exports a singleton `db` instance plus typed query helpers.
 */
type BetterSqlite3 = import("better-sqlite3").Database;
export interface AccountRow {
    id: string;
    email: string;
    pending_email: string | null;
    display_name: string;
    profile_icon: string;
    password_hash: string;
    verified: number;
    created_at: string;
}
export interface AuthTokenRow {
    token_id: string;
    account_id: string;
    issued_at: string;
    expires_at: string;
}
export interface SessionRow {
    id: string;
    invite_code: string | null;
    player_a: string;
    player_b: string | null;
    board_a: string;
    board_b: string;
    turn_state: string;
    status: string;
    disconnected: string;
    created_at: string;
}
export interface MatchmakingQueueRow {
    player_id: string;
    queued_at: string;
}
export declare const db: BetterSqlite3;
export declare const accountQueries: {
    insert: (row: AccountRow) => import("better-sqlite3").RunResult;
    findById: (id: string) => AccountRow | undefined;
    findByEmail: (email: string) => AccountRow | undefined;
    update: (row: Omit<AccountRow, "created_at">) => import("better-sqlite3").RunResult;
    delete: (id: string) => import("better-sqlite3").RunResult;
};
export declare const authTokenQueries: {
    insert: (row: AuthTokenRow) => import("better-sqlite3").RunResult;
    findById: (tokenId: string) => AuthTokenRow | undefined;
    findByAccount: (accountId: string) => AuthTokenRow[];
    delete: (tokenId: string) => import("better-sqlite3").RunResult;
    deleteByAccount: (accountId: string) => import("better-sqlite3").RunResult;
};
export declare const sessionQueries: {
    insert: (row: SessionRow) => import("better-sqlite3").RunResult;
    findById: (id: string) => SessionRow | undefined;
    findByInviteCode: (code: string) => SessionRow | undefined;
    update: (row: SessionRow) => import("better-sqlite3").RunResult;
    delete: (id: string) => import("better-sqlite3").RunResult;
};
export declare const matchmakingQueries: {
    enqueue: (row: MatchmakingQueueRow) => import("better-sqlite3").RunResult;
    getAll: () => MatchmakingQueueRow[];
    dequeue: (playerId: string) => import("better-sqlite3").RunResult;
    clear: () => import("better-sqlite3").RunResult;
};
export {};
//# sourceMappingURL=db.d.ts.map