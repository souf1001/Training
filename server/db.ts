// SQLite database. Node has SQLite built in (node:sqlite),
// so we don't need an extra database server.
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const dataDir = process.env.DATA_DIR ?? path.resolve('data')
mkdirSync(dataDir, { recursive: true })

export const db = new DatabaseSync(path.join(dataDir, 'forma.db'))

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    profile       TEXT,             -- JSON: body data, goal, training preferences
    plan          TEXT,             -- JSON: the generated training plan
    settings      TEXT,             -- JSON: app preferences (theme, ...)
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workouts (
    id      INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date    TEXT NOT NULL,
    data    TEXT NOT NULL           -- JSON: title, duration, exercises and sets
  );

  CREATE TABLE IF NOT EXISTS food_entries (
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

  CREATE TABLE IF NOT EXISTS weights (
    id      INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date    TEXT NOT NULL,
    kg      REAL NOT NULL,
    UNIQUE (user_id, date)
  );

  CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_food_user ON food_entries(user_id, eaten_at);
`)
