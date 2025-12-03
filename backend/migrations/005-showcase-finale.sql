-- Phase 7: Showcase Showdown Finale
-- Updates showcase_bids table structure and adds finale tracking columns to game_workflow

-- Drop existing showcase_bids table (created in 003 but never used)
-- Old structure had product_id and passed fields which don't match new design
DROP TABLE IF EXISTS showcase_bids;

-- Recreate showcase_bids with correct structure for Phase 7
CREATE TABLE showcase_bids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL DEFAULT 1,      -- References game_workflow(id), always 1
  player_id INTEGER NOT NULL,
  showcase_number INTEGER NOT NULL,        -- 1 or 2 (which showcase)
  bid_amount INTEGER NOT NULL,             -- in dollars
  retry_number INTEGER NOT NULL DEFAULT 0, -- 0 = first attempt, 1 = first retry, etc.
  locked INTEGER NOT NULL DEFAULT 1,       -- 1 = locked, 0 = unlocked (can be re-entered)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (game_id) REFERENCES game_workflow(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Indexes for efficient showcase bid queries
CREATE INDEX idx_showcase_bids_game ON showcase_bids(game_id);
CREATE INDEX idx_showcase_bids_player ON showcase_bids(player_id);
CREATE INDEX idx_showcase_bids_retry ON showcase_bids(game_id, retry_number);
CREATE INDEX idx_showcase_bids_showcase ON showcase_bids(showcase_number);

-- Add finale tracking columns to game_workflow table
-- These track the state of the showcase showdown

-- Finalist IDs (players who won the wheel rounds)
ALTER TABLE game_workflow ADD COLUMN finale_player1_id INTEGER;
ALTER TABLE game_workflow ADD COLUMN finale_player2_id INTEGER;

-- Product values for bidding order determination
ALTER TABLE game_workflow ADD COLUMN finale_player1_product_value INTEGER;
ALTER TABLE game_workflow ADD COLUMN finale_player2_product_value INTEGER;

-- Showcase assignments (which player has which showcase: 1 or 2)
ALTER TABLE game_workflow ADD COLUMN finale_player1_showcase INTEGER;
ALTER TABLE game_workflow ADD COLUMN finale_player2_showcase INTEGER;

-- Retry tracking
ALTER TABLE game_workflow ADD COLUMN finale_retry_number INTEGER DEFAULT 0;

-- Pass decision tracking (1 if player 1 passed, 0 if bid)
ALTER TABLE game_workflow ADD COLUMN finale_player1_passed INTEGER DEFAULT 0;

-- Winner tracking
ALTER TABLE game_workflow ADD COLUMN finale_winner_id INTEGER;
ALTER TABLE game_workflow ADD COLUMN finale_bonus_won INTEGER DEFAULT 0;
