-- Migration 010: Showcase Modal Navigation Indices
-- Tracks which product and image is currently displayed in the showcase modal
-- This enables synchronization of modal navigation across all clients

-- Current product index in the modal (0-indexed)
ALTER TABLE game_workflow ADD COLUMN showcase_modal_product_index INTEGER DEFAULT 0;

-- Current image index for the current product (0-indexed)
ALTER TABLE game_workflow ADD COLUMN showcase_modal_image_index INTEGER DEFAULT 0;
