-- Migration 007: Add officially_started flag to game_workflow
-- This flag indicates when the host has officially started the game
-- Non-host players see a waiting screen until this is set to 1

ALTER TABLE game_workflow ADD COLUMN officially_started INTEGER NOT NULL DEFAULT 0;
