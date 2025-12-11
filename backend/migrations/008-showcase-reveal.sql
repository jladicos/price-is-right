-- Migration 008: Showcase Reveal State
-- Adds columns to track which showcases have been revealed to players
-- This enables synchronization of reveal state across host and player views

-- Track whether showcase 1 has been revealed (0 = hidden, 1 = revealed)
ALTER TABLE game_workflow ADD COLUMN showcase1_revealed INTEGER DEFAULT 0;

-- Track whether showcase 2 has been revealed (0 = hidden, 1 = revealed)
ALTER TABLE game_workflow ADD COLUMN showcase2_revealed INTEGER DEFAULT 0;

-- Track which showcase modal is currently open (0 = none, 1 = showcase1, 2 = showcase2)
ALTER TABLE game_workflow ADD COLUMN showcase_modal_open INTEGER DEFAULT 0;
