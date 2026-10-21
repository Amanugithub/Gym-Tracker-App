-- Track the last local sync cursor and error message.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sync_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

PRAGMA user_version = 4;
