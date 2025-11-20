-- Phase 5: Game State Management & Contestant's Row
-- Creates tables for game workflow and contestant tracking
-- Also creates structure for future phases (bids, wheel_spins, showcase_bids)

-- Game workflow table - tracks current game state
-- Single row table (id always = 1) that gets updated as game progresses
CREATE TABLE game_workflow (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  current_segment TEXT NOT NULL,           -- 'section_1', 'section_2', 'finale'
  current_segment_index INTEGER NOT NULL,  -- 0-based index within segment
  phase_type TEXT NOT NULL,                -- 'not_started', 'contestant_selection', 'bidding', 'mini_game', 'wheel', 'showcase'
  phase_metadata TEXT,                     -- JSON blob for phase-specific data (nullable)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Initialize with default 'not_started' state
INSERT INTO game_workflow (id, current_segment, current_segment_index, phase_type, phase_metadata)
VALUES (1, 'section_1', 0, 'not_started', NULL);

-- Index for phase lookups
CREATE INDEX idx_game_workflow_phase ON game_workflow(phase_type);

-- Contestant's row table - tracks who's on stage at contestant podiums
CREATE TABLE contestants_row (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  position INTEGER NOT NULL,               -- 1-5 (which podium)
  game_segment TEXT NOT NULL,              -- 'section_1', 'section_2'
  status TEXT NOT NULL,                    -- 'pending_reveal', 'active', 'won', 'replaced'
  added_at TEXT NOT NULL DEFAULT (datetime('now')),     -- When contestant filled this position
  revealed_at TEXT,                        -- When host revealed to audience (triggers role change)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- Indexes for contestant queries
CREATE INDEX idx_contestants_row_player ON contestants_row(player_id);
CREATE INDEX idx_contestants_row_segment ON contestants_row(game_segment);
CREATE INDEX idx_contestants_row_status ON contestants_row(status);
CREATE INDEX idx_contestants_row_position ON contestants_row(position, game_segment);

-- Bids table - individual bids during bidding rounds (Phase 6)
-- Structure created now, used in Phase 6
CREATE TABLE bids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,                -- References products.json
  round_number INTEGER NOT NULL,           -- Which bidding round in the segment
  game_segment TEXT NOT NULL,              -- 'section_1', 'section_2'
  bid_amount INTEGER NOT NULL,             -- Whole dollars
  is_locked INTEGER NOT NULL DEFAULT 1,    -- 0=unlocked for re-entry, 1=locked
  is_winner INTEGER NOT NULL DEFAULT 0,    -- 0=not winner, 1=winner
  retry_number INTEGER NOT NULL DEFAULT 0, -- 0=first attempt, 1+=retry after "all over"
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- Indexes for bid queries
CREATE INDEX idx_bids_player ON bids(player_id);
CREATE INDEX idx_bids_product ON bids(product_id);
CREATE INDEX idx_bids_segment_round ON bids(game_segment, round_number);

-- Wheel spins table - wheel spin results (Phase 7)
-- Structure created now, used in Phase 7
CREATE TABLE wheel_spins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  game_segment TEXT NOT NULL,              -- 'wheel_1', 'wheel_2'
  spin_number INTEGER NOT NULL,            -- 1 or 2
  result REAL NOT NULL,                    -- 0.05 to 1.00
  spinoff_number INTEGER NOT NULL DEFAULT 0, -- 0=normal spin, 1+=spinoff round
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- Indexes for wheel spin queries
CREATE INDEX idx_wheel_spins_player ON wheel_spins(player_id);
CREATE INDEX idx_wheel_spins_segment ON wheel_spins(game_segment);

-- Showcase bids table - showcase showdown bids (Phase 7)
-- Structure created now, used in Phase 7
CREATE TABLE showcase_bids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,                -- References products.json
  bid_amount INTEGER NOT NULL,             -- Whole dollars
  passed INTEGER NOT NULL DEFAULT 0,       -- 0=bid, 1=passed
  is_winner INTEGER NOT NULL DEFAULT 0,    -- 0=not winner, 1=winner
  retry_number INTEGER NOT NULL DEFAULT 0, -- 0=first bid, 1+=retry if both went over
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- Index for showcase bid queries
CREATE INDEX idx_showcase_bids_player ON showcase_bids(player_id);
