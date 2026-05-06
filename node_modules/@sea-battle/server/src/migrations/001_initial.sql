CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  pending_email TEXT,
  display_name TEXT NOT NULL,
  profile_icon TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  invite_code TEXT UNIQUE,
  player_a TEXT NOT NULL,
  player_b TEXT,
  board_a TEXT NOT NULL,
  board_b TEXT NOT NULL,
  turn_state TEXT NOT NULL,
  status TEXT NOT NULL,
  disconnected TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS matchmaking_queue (
  player_id TEXT PRIMARY KEY,
  queued_at TEXT NOT NULL
);
