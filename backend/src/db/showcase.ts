import { getDatabase } from "./connection.js";

export interface ShowcaseBid {
  id: number;
  game_id: number;
  player_id: number;
  showcase_number: number; // 1 or 2
  bid_amount: number;
  retry_number: number;
  locked: number; // 1 = locked, 0 = unlocked
  created_at: string;
  updated_at: string;
}

export interface ShowcaseBidWithPlayer extends ShowcaseBid {
  first_name: string;
  last_name: string;
  photo_filename: string;
}

export interface ShowcaseState {
  finale_player1_id: number | null;
  finale_player2_id: number | null;
  finale_player1_product_value: number | null;
  finale_player2_product_value: number | null;
  finale_player1_showcase: number | null; // 1 or 2
  finale_player2_showcase: number | null;
  finale_retry_number: number;
  finale_player1_passed: number; // 0 or 1
  finale_winner_id: number | null;
  finale_bonus_won: number; // 0 or 1
}

export interface FinaleStateUpdates {
  finale_player1_id?: number;
  finale_player2_id?: number;
  finale_player1_product_value?: number;
  finale_player2_product_value?: number;
  finale_player1_showcase?: number;
  finale_player2_showcase?: number;
  finale_retry_number?: number;
  finale_player1_passed?: number;
  finale_winner_id?: number;
  finale_bonus_won?: number;
}

/**
 * Get all showcase bids for a specific retry attempt
 * Includes player information
 */
export function getShowcaseBids(
  gameId: number,
  retryNumber: number,
): ShowcaseBidWithPlayer[] {
  const db = getDatabase();

  const bids = db
    .prepare(
      `
    SELECT
      sb.*,
      p.first_name,
      p.last_name,
      p.photo_filename
    FROM showcase_bids sb
    JOIN players p ON sb.player_id = p.id
    WHERE sb.game_id = ?
      AND sb.retry_number = ?
    ORDER BY sb.created_at ASC
  `,
    )
    .all(gameId, retryNumber) as ShowcaseBidWithPlayer[];

  return bids;
}

/**
 * Get showcase state from game_workflow
 * Returns all finale-related fields
 */
export function getShowcaseState(gameId: number): ShowcaseState | null {
  const db = getDatabase();

  const state = db
    .prepare(
      `
    SELECT
      finale_player1_id,
      finale_player2_id,
      finale_player1_product_value,
      finale_player2_product_value,
      finale_player1_showcase,
      finale_player2_showcase,
      finale_retry_number,
      finale_player1_passed,
      finale_winner_id,
      finale_bonus_won
    FROM game_workflow
    WHERE id = ?
  `,
    )
    .get(gameId) as ShowcaseState | undefined;

  return state || null;
}

/**
 * Get showcase state with player information joined
 * Returns showcase state plus player names and photos
 */
export function getShowcaseStateWithPlayers(gameId: number): (ShowcaseState & {
  finale_player1_first_name: string | null;
  finale_player1_last_name: string | null;
  finale_player1_photo: string | null;
  finale_player2_first_name: string | null;
  finale_player2_last_name: string | null;
  finale_player2_photo: string | null;
}) | null {
  const db = getDatabase();

  const state = db
    .prepare(
      `
    SELECT
      gw.finale_player1_id,
      gw.finale_player2_id,
      gw.finale_player1_product_value,
      gw.finale_player2_product_value,
      gw.finale_player1_showcase,
      gw.finale_player2_showcase,
      gw.finale_retry_number,
      gw.finale_player1_passed,
      gw.finale_winner_id,
      gw.finale_bonus_won,
      p1.first_name as finale_player1_first_name,
      p1.last_name as finale_player1_last_name,
      p1.photo_filename as finale_player1_photo,
      p2.first_name as finale_player2_first_name,
      p2.last_name as finale_player2_last_name,
      p2.photo_filename as finale_player2_photo
    FROM game_workflow gw
    LEFT JOIN players p1 ON gw.finale_player1_id = p1.id
    LEFT JOIN players p2 ON gw.finale_player2_id = p2.id
    WHERE gw.id = ?
  `,
    )
    .get(gameId) as (ShowcaseState & {
    finale_player1_first_name: string | null;
    finale_player1_last_name: string | null;
    finale_player1_photo: string | null;
    finale_player2_first_name: string | null;
    finale_player2_last_name: string | null;
    finale_player2_photo: string | null;
  }) | undefined;

  return state || null;
}

/**
 * Get finale winner information
 * Returns null if winner not yet determined
 */
export function getFinaleWinner(
  gameId: number,
): { winnerId: number; bonusWon: boolean } | null {
  const db = getDatabase();

  const result = db
    .prepare(
      `
    SELECT
      finale_winner_id as winnerId,
      finale_bonus_won as bonusWon
    FROM game_workflow
    WHERE id = ?
      AND finale_winner_id IS NOT NULL
  `,
    )
    .get(gameId) as { winnerId: number; bonusWon: number } | undefined;

  if (!result) {
    return null;
  }

  return {
    winnerId: result.winnerId,
    bonusWon: result.bonusWon === 1,
  };
}

/**
 * Insert a new showcase bid
 */
export function insertShowcaseBid(bid: {
  game_id: number;
  player_id: number;
  showcase_number: number;
  bid_amount: number;
  retry_number: number;
}): ShowcaseBid {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO showcase_bids (
      game_id, player_id, showcase_number, bid_amount, retry_number
    )
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    bid.game_id,
    bid.player_id,
    bid.showcase_number,
    bid.bid_amount,
    bid.retry_number,
  );

  // Fetch and return the created bid
  const createdBid = db
    .prepare("SELECT * FROM showcase_bids WHERE id = ?")
    .get(result.lastInsertRowid) as ShowcaseBid;

  return createdBid;
}

/**
 * Update a showcase bid amount
 */
export function updateShowcaseBid(bidId: number, bidAmount: number): void {
  const db = getDatabase();

  db.prepare(
    `
    UPDATE showcase_bids
    SET bid_amount = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `,
  ).run(bidAmount, bidId);
}

/**
 * Unlock a showcase bid to allow re-entry
 * Sets locked = 0
 */
export function unlockShowcaseBid(
  gameId: number,
  playerId: number,
  retryNumber: number,
): void {
  const db = getDatabase();

  db.prepare(
    `
    UPDATE showcase_bids
    SET locked = 0,
        updated_at = datetime('now')
    WHERE game_id = ?
      AND player_id = ?
      AND retry_number = ?
  `,
  ).run(gameId, playerId, retryNumber);
}

/**
 * Update finale state fields in game_workflow
 * Accepts partial updates
 */
export function updateFinaleState(
  gameId: number,
  updates: FinaleStateUpdates,
): void {
  const db = getDatabase();

  const fields: string[] = [];
  const values: (number | null)[] = [];

  if (updates.finale_player1_id !== undefined) {
    fields.push("finale_player1_id = ?");
    values.push(updates.finale_player1_id);
  }

  if (updates.finale_player2_id !== undefined) {
    fields.push("finale_player2_id = ?");
    values.push(updates.finale_player2_id);
  }

  if (updates.finale_player1_product_value !== undefined) {
    fields.push("finale_player1_product_value = ?");
    values.push(updates.finale_player1_product_value);
  }

  if (updates.finale_player2_product_value !== undefined) {
    fields.push("finale_player2_product_value = ?");
    values.push(updates.finale_player2_product_value);
  }

  if (updates.finale_player1_showcase !== undefined) {
    fields.push("finale_player1_showcase = ?");
    values.push(updates.finale_player1_showcase);
  }

  if (updates.finale_player2_showcase !== undefined) {
    fields.push("finale_player2_showcase = ?");
    values.push(updates.finale_player2_showcase);
  }

  if (updates.finale_retry_number !== undefined) {
    fields.push("finale_retry_number = ?");
    values.push(updates.finale_retry_number);
  }

  if (updates.finale_player1_passed !== undefined) {
    fields.push("finale_player1_passed = ?");
    values.push(updates.finale_player1_passed);
  }

  if (updates.finale_winner_id !== undefined) {
    fields.push("finale_winner_id = ?");
    values.push(updates.finale_winner_id);
  }

  if (updates.finale_bonus_won !== undefined) {
    fields.push("finale_bonus_won = ?");
    values.push(updates.finale_bonus_won);
  }

  if (fields.length === 0) {
    throw new Error("No fields to update");
  }

  // Add updated_at timestamp
  fields.push("updated_at = datetime('now')");

  values.push(gameId);

  const stmt = db.prepare(`
    UPDATE game_workflow
    SET ${fields.join(", ")}
    WHERE id = ?
  `);

  stmt.run(...values);
}

/**
 * Set finale winner and bonus flag
 */
export function setFinaleWinner(
  gameId: number,
  winnerId: number,
  bonusWon: boolean,
): void {
  const db = getDatabase();

  db.prepare(
    `
    UPDATE game_workflow
    SET finale_winner_id = ?,
        finale_bonus_won = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `,
  ).run(winnerId, bonusWon ? 1 : 0, gameId);
}

/**
 * Increment the retry number for the finale
 * Used when both players go over and need to re-bid
 */
export function incrementRetryNumber(gameId: number): number {
  const db = getDatabase();

  // Get current retry number
  const current = db
    .prepare(
      "SELECT COALESCE(finale_retry_number, 0) as retry FROM game_workflow WHERE id = ?",
    )
    .get(gameId) as { retry: number };

  const newRetryNumber = current.retry + 1;

  // Increment it
  db.prepare(
    `
    UPDATE game_workflow
    SET finale_retry_number = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `,
  ).run(newRetryNumber, gameId);

  return newRetryNumber;
}

/**
 * Get a player's bid for the current retry
 * Returns the bid if it exists, undefined otherwise
 */
export function getPlayerBidForRetry(
  gameId: number,
  playerId: number,
  retryNumber: number,
): ShowcaseBid | undefined {
  const db = getDatabase();

  const bid = db
    .prepare(
      `
    SELECT *
    FROM showcase_bids
    WHERE game_id = ?
      AND player_id = ?
      AND retry_number = ?
  `,
    )
    .get(gameId, playerId, retryNumber) as ShowcaseBid | undefined;

  return bid;
}

/**
 * Get showcase bid by ID
 */
export function getShowcaseBidById(bidId: number): ShowcaseBid | undefined {
  const db = getDatabase();

  const bid = db
    .prepare("SELECT * FROM showcase_bids WHERE id = ?")
    .get(bidId) as ShowcaseBid | undefined;

  return bid;
}
