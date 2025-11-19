-- Migration 002: Game State Table
-- Stores global game configuration like enabled/disabled status

CREATE TABLE IF NOT EXISTS game_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default game state (game is enabled by default)
INSERT INTO game_state (key, value) VALUES ('game_enabled', 'true');
