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
const Database = require("better-sqlite3");
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// ---------------------------------------------------------------------------
// Open database
// ---------------------------------------------------------------------------
// On Render, the persistent disk is mounted at /data
const dbPath = process.env["DB_PATH"] ?? (process.env["NODE_ENV"] === "production" ? "/data/sea-battle.db" : "./sea-battle.db");
// Ensure the directory exists before SQLite tries to open the file
const dbDir = dirname(dbPath);
mkdirSync(dbDir, { recursive: true });
export const db = new Database(dbPath);
// Enable WAL mode for better concurrent read performance and foreign-key enforcement.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
// ---------------------------------------------------------------------------
// Run migrations
// ---------------------------------------------------------------------------
function runMigrations() {
    const migrationPath = join(__dirname, "migrations", "001_initial.sql");
    const sql = readFileSync(migrationPath, "utf-8");
    db.exec(sql);
}
runMigrations();
// ---------------------------------------------------------------------------
// Typed query helpers — accounts
// ---------------------------------------------------------------------------
const insertAccountStmt = db.prepare(`
  INSERT INTO accounts (id, email, pending_email, display_name, profile_icon, password_hash, verified, created_at)
  VALUES (@id, @email, @pending_email, @display_name, @profile_icon, @password_hash, @verified, @created_at)
`);
const selectAccountByIdStmt = db.prepare("SELECT * FROM accounts WHERE id = ?");
const selectAccountByEmailStmt = db.prepare("SELECT * FROM accounts WHERE email = ?");
const updateAccountStmt = db.prepare(`
  UPDATE accounts
  SET email = @email,
      pending_email = @pending_email,
      display_name = @display_name,
      profile_icon = @profile_icon,
      password_hash = @password_hash,
      verified = @verified
  WHERE id = @id
`);
const deleteAccountStmt = db.prepare("DELETE FROM accounts WHERE id = ?");
export const accountQueries = {
    insert: (row) => insertAccountStmt.run(row),
    findById: (id) => selectAccountByIdStmt.get(id),
    findByEmail: (email) => selectAccountByEmailStmt.get(email),
    update: (row) => updateAccountStmt.run(row),
    delete: (id) => deleteAccountStmt.run(id),
};
// ---------------------------------------------------------------------------
// Typed query helpers — auth_tokens
// ---------------------------------------------------------------------------
const insertAuthTokenStmt = db.prepare(`
  INSERT INTO auth_tokens (token_id, account_id, issued_at, expires_at)
  VALUES (@token_id, @account_id, @issued_at, @expires_at)
`);
const selectAuthTokenStmt = db.prepare("SELECT * FROM auth_tokens WHERE token_id = ?");
const selectAuthTokensByAccountStmt = db.prepare("SELECT * FROM auth_tokens WHERE account_id = ?");
const deleteAuthTokenStmt = db.prepare("DELETE FROM auth_tokens WHERE token_id = ?");
const deleteAuthTokensByAccountStmt = db.prepare("DELETE FROM auth_tokens WHERE account_id = ?");
export const authTokenQueries = {
    insert: (row) => insertAuthTokenStmt.run(row),
    findById: (tokenId) => selectAuthTokenStmt.get(tokenId),
    findByAccount: (accountId) => selectAuthTokensByAccountStmt.all(accountId),
    delete: (tokenId) => deleteAuthTokenStmt.run(tokenId),
    deleteByAccount: (accountId) => deleteAuthTokensByAccountStmt.run(accountId),
};
// ---------------------------------------------------------------------------
// Typed query helpers — sessions
// ---------------------------------------------------------------------------
const insertSessionStmt = db.prepare(`
  INSERT INTO sessions (id, invite_code, player_a, player_b, board_a, board_b, turn_state, status, disconnected, created_at)
  VALUES (@id, @invite_code, @player_a, @player_b, @board_a, @board_b, @turn_state, @status, @disconnected, @created_at)
`);
const selectSessionByIdStmt = db.prepare("SELECT * FROM sessions WHERE id = ?");
const selectSessionByInviteCodeStmt = db.prepare("SELECT * FROM sessions WHERE invite_code = ?");
const updateSessionStmt = db.prepare(`
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
const deleteSessionStmt = db.prepare("DELETE FROM sessions WHERE id = ?");
export const sessionQueries = {
    insert: (row) => insertSessionStmt.run(row),
    findById: (id) => selectSessionByIdStmt.get(id),
    findByInviteCode: (code) => selectSessionByInviteCodeStmt.get(code),
    update: (row) => updateSessionStmt.run(row),
    delete: (id) => deleteSessionStmt.run(id),
};
// ---------------------------------------------------------------------------
// Typed query helpers — matchmaking_queue
// ---------------------------------------------------------------------------
const insertQueueEntryStmt = db.prepare("INSERT INTO matchmaking_queue (player_id, queued_at) VALUES (@player_id, @queued_at)");
const selectAllQueueEntriesStmt = db.prepare("SELECT * FROM matchmaking_queue ORDER BY queued_at ASC");
const deleteQueueEntryStmt = db.prepare("DELETE FROM matchmaking_queue WHERE player_id = ?");
const deleteAllQueueEntriesStmt = db.prepare("DELETE FROM matchmaking_queue");
export const matchmakingQueries = {
    enqueue: (row) => insertQueueEntryStmt.run(row),
    getAll: () => selectAllQueueEntriesStmt.all(),
    dequeue: (playerId) => deleteQueueEntryStmt.run(playerId),
    clear: () => deleteAllQueueEntriesStmt.run(),
};
//# sourceMappingURL=db.js.map