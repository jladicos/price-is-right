-- Migration 009: Showcase Modal Open State
-- Tracks which showcase modal is currently open for synchronization across clients

-- Track which showcase modal is currently open (0 = none, 1 = showcase1, 2 = showcase2)
ALTER TABLE game_workflow ADD COLUMN showcase_modal_open INTEGER DEFAULT 0;
