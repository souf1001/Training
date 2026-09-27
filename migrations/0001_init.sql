-- Database schema for Cloudflare D1 (SQLite).
-- Apply with: npm run db:migrate (online) or npm run db:migrate:local

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  profile       TEXT,             -- JSON: body data, goal, training preferences
  plan          TEXT,             -- JSON: the generated training plan
  settings      TEXT,             -- JSON: app preferences (theme, ...)
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE workouts (
  id      INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date    TEXT NOT NULL,
  data    TEXT NOT NULL           -- JSON: title, duration, exercises and sets
);

CREATE TABLE food_entries (
  id       INTEGER PRIMARY KEY,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  eaten_at TEXT NOT NULL,
  name     TEXT NOT NULL,
  amount   TEXT NOT NULL DEFAULT '',
  kcal     REAL NOT NULL,
  protein  REAL NOT NULL,
  carbs    REAL NOT NULL,
  fat      REAL NOT NULL,
  source   TEXT NOT NULL
);

CREATE TABLE weights (
  id      INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date    TEXT NOT NULL,
  kg      REAL NOT NULL,
  UNIQUE (user_id, date)
);

-- request counters for rate limits (a Worker has no shared memory between requests)
CREATE TABLE rate_limits (
  key   TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  since INTEGER NOT NULL          -- start of the time window, in milliseconds
);

CREATE INDEX idx_workouts_user ON workouts(user_id, date);
CREATE INDEX idx_food_user ON food_entries(user_id, eaten_at);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
