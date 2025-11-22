-- Add weight column to players table for weighted random selection
-- Weight range: 0.0 to 1.0
-- 0.0 = backup only (selected if no other options)
-- 1.0 = full probability
-- NULL or missing = defaults to 1.0 (full probability)

ALTER TABLE players ADD COLUMN weight REAL DEFAULT 1.0;

-- Set weight to 1.0 for all existing players
UPDATE players SET weight = 1.0 WHERE weight IS NULL;
