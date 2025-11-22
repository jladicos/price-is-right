import { getDatabase } from './connection.js';

export interface Bid {
  id: number;
  player_id: number;
  product_id: string;
  round_number: number;
  game_segment: string;
  bid_amount: number;
  is_locked: number;
  is_winner: number;
  retry_number: number;
  created_at: string;
}

export interface BidWithPlayer extends Bid {
  first_name: string;
  last_name: string;
  photo_filename: string;
  position: number | null; // contestant position (1-5) if they're in contestant's row
}

/**
 * Create a new bid
 */
export function createBid(
  playerId: number,
  productId: string,
  roundNumber: number,
  segment: string,
  bidAmount: number,
  retryNumber: number,
): Bid {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO bids (player_id, product_id, round_number, game_segment, bid_amount, retry_number)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(playerId, productId, roundNumber, segment, bidAmount, retryNumber);

  // Fetch and return the created bid
  const bid = db.prepare('SELECT * FROM bids WHERE id = ?').get(result.lastInsertRowid) as Bid;

  return bid;
}

/**
 * Get all bids for a specific round
 * Returns most recent bids (highest retry_number) for the round
 * Includes player info
 */
export function getBidsForRound(segment: string, roundNumber: number): BidWithPlayer[] {
  const db = getDatabase();

  // Get current retry number for this round
  const retryResult = db
    .prepare(
      `
    SELECT COALESCE(MAX(retry_number), 0) as current_retry
    FROM bids
    WHERE game_segment = ?
      AND round_number = ?
  `,
    )
    .get(segment, roundNumber) as { current_retry: number };

  const currentRetry = retryResult.current_retry;

  // Get bids for current retry with player info and contestant position
  const bids = db
    .prepare(
      `
    SELECT
      b.*,
      p.first_name,
      p.last_name,
      p.photo_filename,
      c.position
    FROM bids b
    JOIN players p ON b.player_id = p.id
    LEFT JOIN contestants_row c ON b.player_id = c.player_id
      AND c.status = 'active'
    WHERE b.game_segment = ?
      AND b.round_number = ?
      AND b.retry_number = ?
    ORDER BY b.created_at ASC
  `,
    )
    .all(segment, roundNumber, currentRetry) as BidWithPlayer[];

  return bids;
}

/**
 * Get a specific bid by ID
 */
export function getBidById(bidId: number): Bid | undefined {
  const db = getDatabase();

  const bid = db.prepare('SELECT * FROM bids WHERE id = ?').get(bidId) as Bid | undefined;

  return bid;
}

/**
 * Update a bid's fields
 * Used for updating bid_amount, is_locked, etc.
 */
export function updateBid(
  bidId: number,
  updates: {
    bid_amount?: number;
    is_locked?: number;
    is_winner?: number;
  },
): Bid {
  const db = getDatabase();

  const fields: string[] = [];
  const values: (number | string)[] = [];

  if (updates.bid_amount !== undefined) {
    fields.push('bid_amount = ?');
    values.push(updates.bid_amount);
  }

  if (updates.is_locked !== undefined) {
    fields.push('is_locked = ?');
    values.push(updates.is_locked);
  }

  if (updates.is_winner !== undefined) {
    fields.push('is_winner = ?');
    values.push(updates.is_winner);
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(bidId);

  const stmt = db.prepare(`
    UPDATE bids
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...values);

  const bid = db.prepare('SELECT * FROM bids WHERE id = ?').get(bidId) as Bid;

  return bid;
}

/**
 * Unlock a bid to allow re-entry
 * Sets is_locked = 0
 */
export function unlockBid(bidId: number): Bid {
  const db = getDatabase();

  const stmt = db.prepare(`
    UPDATE bids
    SET is_locked = 0
    WHERE id = ?
  `);

  stmt.run(bidId);

  const bid = db.prepare('SELECT * FROM bids WHERE id = ?').get(bidId) as Bid;

  return bid;
}

/**
 * Mark a bid as the winning bid
 * Sets is_winner = 1
 */
export function markWinner(bidId: number): Bid {
  const db = getDatabase();

  const stmt = db.prepare(`
    UPDATE bids
    SET is_winner = 1
    WHERE id = ?
  `);

  stmt.run(bidId);

  const bid = db.prepare('SELECT * FROM bids WHERE id = ?').get(bidId) as Bid;

  return bid;
}

/**
 * Delete all bids for a specific round
 * Used during "all over" retry scenario
 */
export function deleteBidsForRound(
  segment: string,
  roundNumber: number,
  retryNumber: number,
): void {
  const db = getDatabase();

  db.prepare(
    `
    DELETE FROM bids
    WHERE game_segment = ?
      AND round_number = ?
      AND retry_number = ?
  `,
  ).run(segment, roundNumber, retryNumber);
}

/**
 * Check if a bid amount is a duplicate in the current round
 * Returns true if duplicate exists, false otherwise
 */
export function checkDuplicateBid(
  segment: string,
  roundNumber: number,
  retryNumber: number,
  bidAmount: number,
): boolean {
  const db = getDatabase();

  const result = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM bids
    WHERE game_segment = ?
      AND round_number = ?
      AND retry_number = ?
      AND bid_amount = ?
  `,
    )
    .get(segment, roundNumber, retryNumber, bidAmount) as { count: number };

  return result.count > 0;
}

/**
 * Get the current retry number for a round
 * Returns the highest retry_number, or 0 if no bids exist yet
 */
export function getCurrentRetryNumber(segment: string, roundNumber: number): number {
  const db = getDatabase();

  const result = db
    .prepare(
      `
    SELECT COALESCE(MAX(retry_number), 0) as current_retry
    FROM bids
    WHERE game_segment = ?
      AND round_number = ?
  `,
    )
    .get(segment, roundNumber) as { current_retry: number };

  return result.current_retry;
}

/**
 * Get bid by player for current round
 * Returns the player's bid for the specified round (current retry)
 */
export function getBidByPlayerForRound(
  playerId: number,
  segment: string,
  roundNumber: number,
): Bid | undefined {
  const db = getDatabase();

  // Get current retry number
  const currentRetry = getCurrentRetryNumber(segment, roundNumber);

  const bid = db
    .prepare(
      `
    SELECT *
    FROM bids
    WHERE player_id = ?
      AND game_segment = ?
      AND round_number = ?
      AND retry_number = ?
  `,
    )
    .get(playerId, segment, roundNumber, currentRetry) as Bid | undefined;

  return bid;
}
