-- Migration 006: Add unique constraint on bid amounts
-- Prevents race condition where two players submit the same bid amount
-- in the same round/segment/retry

-- Create unique index to prevent duplicate bid amounts within a round
CREATE UNIQUE INDEX idx_unique_bid_amount
ON bids(game_segment, round_number, retry_number, bid_amount);
