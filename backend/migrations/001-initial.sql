-- Initial schema for Price is Right game
-- Creates the players table

CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  access_code TEXT NOT NULL UNIQUE,
  photo_filename TEXT NOT NULL DEFAULT 'default.png',
  role TEXT NOT NULL CHECK(role IN ('host', 'player', 'audience')),
  active INTEGER NOT NULL DEFAULT 1,
  session_token TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for fast access code lookups
CREATE INDEX idx_players_access_code ON players(access_code);

-- Index for fast session token lookups
CREATE INDEX idx_players_session_token ON players(session_token);

-- Index for active players
CREATE INDEX idx_players_active ON players(active);

-- Index for role filtering
CREATE INDEX idx_players_role ON players(role);
