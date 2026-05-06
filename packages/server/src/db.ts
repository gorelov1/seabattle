/**
 * Database module — opens a SQLite database, runs migrations on startup,
 * and exports a singleton `db` instance plus typed query helpers.
 */

import { createRequire } from "module";
import { readFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// better-sqlite3 is a CommonJS module; use createRequire to import it in ESM.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require("better-sqlite3") as typeof import("better-sqlite3");
type BetterSqlite3 = import("better-sqlite3").Database;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Types mirroring the database rows
// ---------------------------------------------------------------------------

export interface AccountRow {
  id: string;
  email: string;
  pending_email: string | null;
  display_name: string;
  profile_icon: string;
  password_hash: string;
  verified: number; // 0 | 1
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
  disconnected: string; // JSON-encoded map
  created_at: string;
}

export interface MatchmakingQueueRow {
  player_id: string;
  queued_at: string;
}

// ---------------------------------------------------------------------------
// Open database
// ---------------------------------------------------------------------------

// On Render, the persistent disk is mounted at /data
const dbPath = process.env["DB_PATH"] ?? (process.env["NODE_ENV"] === "production" ? "/data/sea-battle.db" : "./sea-battle.db");

// Ensure the directory exists before SQLite tries to open the file
const dbDir = dirname(dbPath);
mkdirSync(dbDir, { recursive: true });
export const db: BetterSqlite3 = new Database(dbPath);

// Enable WAL mode for better concurrent read performance and foreign-key enforcement.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---------------------------------------------------------------------------
// Run migrations
// ---------------------------------------------------------------------------

function runMigrations(): void {
  const migrationPath = join(__dirname, "migrations", "001_initial.sql");
  const sql = readFileSync(migrationPath, "utf-8");
  db.exec(sql);
}

runMigrations();

// ---------------------------------------------------------------------------
// Typed query helpers — accounts
// ---------------------------------------------------------------------------

const insertAccountStmt = db.prepare<AccountRow>(`
  INSERT INTO accounts (id, email, pending_email, display_name, profile_icon, password_hash, verified, created_at)
  VALUES (@id, @email, @pending_email, @display_name, @profile_icon, @password_hash, @verified, @created_at)
`);

const selectAccountByIdStmt = db.prepare<[string], AccountRow>(
  "SELECT * FROM accounts WHERE id = ?"
);

const selectAccountByEmailStmt = db.prepare<[string], AccountRow>(
  "SELECT * FROM accounts WHERE email = ?"
);

const updateAccountStmt = db.prepare<{
  id: string;
  email: string;
  pending_email: string | null;
  display_name: string;
  profile_icon: string;
  password_hash: string;
  verified: number;
}>(`
  UPDATE accounts
  SET email = @email,
      pending_email = @pending_email,
      display_name = @display_name,
      profile_icon = @profile_icon,
      password_hash = @password_hash,
      verified = @verified
  WHERE id = @id
`);

const deleteAccountStmt = db.prepare<[string]>(
  "DELETE FROM accounts WHERE id = ?"
);

export const accountQueries = {
  insert: (row: AccountRow) => insertAccountStmt.run(row),
  findById: (id: string): AccountRow | undefined =>
    selectAccountByIdStmt.get(id),
  findByEmail: (email: string): AccountRow | undefined =>
    selectAccountByEmailStmt.get(email),
  update: (row: Omit<AccountRow, "created_at">) => updateAccountStmt.run(row),
  delete: (id: string) => deleteAccountStmt.run(id),
};

// ---------------------------------------------------------------------------
// Typed query helpers — auth_tokens
// ---------------------------------------------------------------------------

const insertAuthTokenStmt = db.prepare<AuthTokenRow>(`
  INSERT INTO auth_tokens (token_id, account_id, issued_at, expires_at)
  VALUES (@token_id, @account_id, @issued_at, @expires_at)
`);

const selectAuthTokenStmt = db.prepare<[string], AuthTokenRow>(
  "SELECT * FROM auth_tokens WHERE token_id = ?"
);

const selectAuthTokensByAccountStmt = db.prepare<[string], AuthTokenRow>(
  "SELECT * FROM auth_tokens WHERE account_id = ?"
);

const deleteAuthTokenStmt = db.prepare<[string]>(
  "DELETE FROM auth_tokens WHERE token_id = ?"
);

const deleteAuthTokensByAccountStmt = db.prepare<[string]>(
  "DELETE FROM auth_tokens WHERE account_id = ?"
);

export const authTokenQueries = {
  insert: (row: AuthTokenRow) => insertAuthTokenStmt.run(row),
  findById: (tokenId: string): AuthTokenRow | undefined =>
    selectAuthTokenStmt.get(tokenId),
  findByAccount: (accountId: string): AuthTokenRow[] =>
    selectAuthTokensByAccountStmt.all(accountId),
  delete: (tokenId: string) => deleteAuthTokenStmt.run(tokenId),
  deleteByAccount: (accountId: string) =>
    deleteAuthTokensByAccountStmt.run(accountId),
};

// ---------------------------------------------------------------------------
// Typed query helpers — sessions
// ---------------------------------------------------------------------------

const insertSessionStmt = db.prepare<SessionRow>(`
  INSERT INTO sessions (id, invite_code, player_a, player_b, board_a, board_b, turn_state, status, disconnected, created_at)
  VALUES (@id, @invite_code, @player_a, @player_b, @board_a, @board_b, @turn_state, @status, @disconnected, @created_at)
`);

const selectSessionByIdStmt = db.prepare<[string], SessionRow>(
  "SELECT * FROM sessions WHERE id = ?"
);

const selectSessionByInviteCodeStmt = db.prepare<[string], SessionRow>(
  "SELECT * FROM sessions WHERE invite_code = ?"
);

const updateSessionStmt = db.prepare<Omit<SessionRow, "created_at"> & { id: string }>(`
  UPDATE sessions
  SET invite_code = @invite_code,
      player_a = @player_a,
      player_b = @player_b,
      board_a = @board_a,
      board_b = @board_b,
      turn_state = @turn_state,
      status = @status,
      disconnected = @disconnected
  WHERE id = @id
`);

const deleteSessionStmt = db.prepare<[string]>(
  "DELETE FROM sessions WHERE id = ?"
);

export const sessionQueries = {
  insert: (row: SessionRow) => insertSessionStmt.run(row),
  findById: (id: string): SessionRow | undefined =>
    selectSessionByIdStmt.get(id),
  findByInviteCode: (code: string): SessionRow | undefined =>
    selectSessionByInviteCodeStmt.get(code),
  update: (row: SessionRow) => updateSessionStmt.run(row),
  delete: (id: string) => deleteSessionStmt.run(id),
};

// ---------------------------------------------------------------------------
// Typed query helpers — matchmaking_queue
// ---------------------------------------------------------------------------

const insertQueueEntryStmt = db.prepare<MatchmakingQueueRow>(
  "INSERT INTO matchmaking_queue (player_id, queued_at) VALUES (@player_id, @queued_at)"
);

const selectAllQueueEntriesStmt = db.prepare<[], MatchmakingQueueRow>(
  "SELECT * FROM matchmaking_queue ORDER BY queued_at ASC"
);

const deleteQueueEntryStmt = db.prepare<[string]>(
  "DELETE FROM matchmaking_queue WHERE player_id = ?"
);

const deleteAllQueueEntriesStmt = db.prepare("DELETE FROM matchmaking_queue");

export const matchmakingQueries = {
  enqueue: (row: MatchmakingQueueRow) => insertQueueEntryStmt.run(row),
  getAll: (): MatchmakingQueueRow[] => selectAllQueueEntriesStmt.all(),
  dequeue: (playerId: string) => deleteQueueEntryStmt.run(playerId),
  clear: () => deleteAllQueueEntriesStmt.run(),
};
