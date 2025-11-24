import {
  createBid as dbCreateBid,
  getBidsForRound as dbGetBidsForRound,
  unlockBid as dbUnlockBid,
  markWinner as dbMarkWinner,
  deleteBidsForRound as dbDeleteBidsForRound,
  checkDuplicateBid,
  getCurrentRetryNumber,
  getBidByPlayerForRound,
  updateBid,
  type BidWithPlayer,
} from "../db/bids.js";
import { getGameWorkflow } from "../db/game-workflow.js";
import { getAllActiveContestants, getBiddingOrder } from "../db/contestants.js";
import { getProduct } from "../utils/products.js";

export interface BidSubmission {
  bid: BidWithPlayer;
  allBidsSubmitted: boolean;
}

export interface WinnerResult {
  winner: BidWithPlayer;
  allBids: BidWithPlayer[];
}

export interface AllOverResult {
  allOver: true;
  newRetryNumber: number;
}

/**
 * Submit a bid for a player
 * Validates: positive integer, no duplicate, player's turn
 */
export function submitBid(
  playerId: number,
  bidAmount: number,
  segment: string,
  roundNumber: number,
): BidSubmission {
  // Validate bid amount
  if (!Number.isInteger(bidAmount) || bidAmount <= 0) {
    throw new Error("Bid amount must be a positive integer");
  }

  // Get current retry number
  // Check phase_metadata first (set during "all over" scenario)
  const workflow = getGameWorkflow();
  const metadata = workflow.phase_metadata
    ? JSON.parse(workflow.phase_metadata)
    : {};
  const retryNumber =
    metadata.retry_number ?? getCurrentRetryNumber(segment, roundNumber);

  // Check for duplicate bid
  const isDuplicate = checkDuplicateBid(
    segment,
    roundNumber,
    retryNumber,
    bidAmount,
  );
  if (isDuplicate) {
    throw new Error("Bid amount already taken. Choose a unique bid.");
  }

  // Check if it's the player's turn
  const currentBidderPos = getCurrentBidderPosition(segment);

  // Get the contestant for this player
  const contestants = getAllActiveContestants();
  const playerContestant = contestants.find((c) => c.player_id === playerId);

  if (!playerContestant) {
    throw new Error("Player is not in contestant's row");
  }

  if (currentBidderPos !== playerContestant.position) {
    throw new Error("Not your turn to bid");
  }

  // Get product_id from metadata (already loaded above)
  const productId = metadata.product_id || "unknown";

  // Create the bid
  const bid = dbCreateBid(
    playerId,
    productId,
    roundNumber,
    segment,
    bidAmount,
    retryNumber,
  );

  // Get bid with player info
  const bids = getCurrentBids(segment, roundNumber);
  const bidWithPlayer = bids.find((b) => b.id === bid.id);

  if (!bidWithPlayer) {
    throw new Error("Failed to retrieve bid after creation");
  }

  // Check if all contestants have bid (reuse contestants from above)
  const allBidsSubmitted = bids.length === contestants.length;

  return {
    bid: bidWithPlayer,
    allBidsSubmitted,
  };
}

/**
 * Get all current bids for a round
 * Includes player information and contestant position
 */
export function getCurrentBids(
  segment: string,
  roundNumber: number,
): BidWithPlayer[] {
  return dbGetBidsForRound(segment, roundNumber);
}

/**
 * Determine whose turn it is to bid
 * Returns the position (1-5) of the next bidder, or null if all have bid
 */
export function getCurrentBidderPosition(segment: string): number | null {
  const workflow = getGameWorkflow();
  const roundNumber = workflow.current_segment_index + 1;

  // Get bidding order
  const order = getBiddingOrderForCurrentRow(segment);

  if (order.length === 0) {
    return null; // No active contestants
  }

  // Get current bids
  const bids = getCurrentBids(segment, roundNumber);

  // All have bid
  if (bids.length >= order.length) {
    return null;
  }

  // Get set of positions that have already bid
  const biddedPositions = new Set(
    bids.map((b) => b.position).filter((p) => p !== null),
  );

  // Find first position in order that hasn't bid yet
  for (const position of order) {
    if (!biddedPositions.has(position)) {
      return position;
    }
  }

  return null; // All have bid (fallback)
}

/**
 * Calculate the winner for current round
 *
 * Bidding Logic:
 * - Bids are entered as whole dollar amounts (e.g., 4 = $4.00, 302 = $302.00)
 * - Product prices are stored as dollar amounts (integers or decimals)
 * - Winner is the HIGHEST bid that does NOT EXCEED the actual price
 * - If all bids are over the price, it's an "all over" scenario requiring retry
 *
 * Examples (product at $4.78):
 * - Bid $4 (under) ✓, Bid $5 (over) ✗
 * - Bids: $3, $4, $5 → Winner is $4 (highest without going over)
 * - Bids: $5, $6, $7 → All over (everyone overbid, must retry)
 *
 * @param segment - Game segment (section_1, section_2, etc.)
 * @param roundNumber - Round number within the segment
 * @param productPrice - Product price in DOLLARS
 * @returns Winner with bid details, or allOver flag if everyone overbid
 */
export function calculateWinner(
  segment: string,
  roundNumber: number,
  productPrice: number,
): WinnerResult | AllOverResult {
  const bids = getCurrentBids(segment, roundNumber);

  if (bids.length === 0) {
    throw new Error("No bids submitted for this round");
  }

  // Find highest bid that doesn't exceed price
  let winningBid: BidWithPlayer | null = null;

  for (const bid of bids) {
    // Bid must be less than or equal to actual price
    if (bid.bid_amount <= productPrice) {
      if (
        winningBid === null ||
        bid.bid_amount > winningBid.bid_amount ||
        // Tie-breaker: earlier bid wins
        (bid.bid_amount === winningBid.bid_amount &&
          new Date(bid.created_at) < new Date(winningBid.created_at))
      ) {
        winningBid = bid;
      }
    }
  }

  // Check if all over (no valid bids)
  if (winningBid === null) {
    return {
      allOver: true,
      newRetryNumber: getCurrentRetryNumber(segment, roundNumber) + 1,
    };
  }

  return {
    winner: winningBid,
    allBids: bids,
  };
}

/**
 * Unlock a bid to allow re-entry
 */
export function unlockBid(bidId: number): BidWithPlayer {
  const unlockedBid = dbUnlockBid(bidId);

  // Get bid with player info
  const bid = dbGetBidsForRound(
    unlockedBid.game_segment,
    unlockedBid.round_number,
  ).find((b) => b.id === bidId);

  if (!bid) {
    throw new Error("Failed to retrieve unlocked bid");
  }

  return bid;
}

/**
 * Mark a bid as the winning bid
 */
export function markWinner(bidId: number): BidWithPlayer {
  const winnerBid = dbMarkWinner(bidId);

  // Get bid with player info
  const bid = dbGetBidsForRound(
    winnerBid.game_segment,
    winnerBid.round_number,
  ).find((b) => b.id === bidId);

  if (!bid) {
    throw new Error("Failed to retrieve winner bid");
  }

  return bid;
}

/**
 * Clear all bids for a retry (all over scenario)
 */
export function clearBidsForRetry(segment: string, roundNumber: number): void {
  const retryNumber = getCurrentRetryNumber(segment, roundNumber);
  dbDeleteBidsForRound(segment, roundNumber, retryNumber);
}

/**
 * Get bidding order for current row
 *
 * Bidding Order Logic:
 * The order contestants bid depends on whether this is a "fresh" row or has replacements:
 *
 * FRESH ROW (is_fresh_row = true):
 * - All 5 contestants selected at once (game start or after refresh-contestants-row)
 * - Bidding goes LEFT TO RIGHT: Position 1 → 2 → 3 → 4 → 5
 *
 * REPLACEMENT ROW (is_fresh_row = false):
 * - After a winner, they're replaced with a new contestant
 * - The NEWEST contestant bids FIRST, then continues in circular order
 * - Example: Winner at position 2 replaced → New person at pos 2 bids first
 *
 * The is_fresh_row flag is:
 * - Set to TRUE: On game start, or when host refreshes entire row
 * - Set to FALSE: When advancing from a bidding phase (auto-replacement)
 * - Preserved: When advancing between other phases
 *
 * @param segment - Game segment to get order for
 * @returns Array of positions in bidding order (e.g., [1, 2, 3, 4, 5] or [3, 4, 5, 1, 2])
 */
export function getBiddingOrderForCurrentRow(segment: string): number[] {
  const workflow = getGameWorkflow();
  const metadata = workflow.phase_metadata
    ? JSON.parse(workflow.phase_metadata)
    : {};

  const isFreshRow = metadata.is_fresh_row === true;

  if (isFreshRow) {
    // Fresh row: Left to right (1, 2, 3, 4, 5)
    const contestants = getAllActiveContestants();
    return contestants.map((c) => c.position).sort((a, b) => a - b);
  } else {
    // Replacement row: Most recently added goes first, then circular order
    return getBiddingOrder(segment);
  }
}

/**
 * Check if a player has already bid in the current round
 */
export function hasPlayerBid(
  playerId: number,
  segment: string,
  roundNumber: number,
): boolean {
  const bid = getBidByPlayerForRound(playerId, segment, roundNumber);
  return bid !== undefined;
}

/**
 * Get product price for current round
 * Reads product_id from phase_metadata
 * Returns price in dollars
 *
 * Price format:
 * - Integer (e.g., 288) = $288 dollars
 * - Decimal (e.g., 2.88) = $2.88 dollars and cents
 */
export function getCurrentProductPrice(): number {
  const workflow = getGameWorkflow();
  const metadata = workflow.phase_metadata
    ? JSON.parse(workflow.phase_metadata)
    : {};

  const productId = metadata.product_id;
  if (!productId) {
    throw new Error("No product_id in phase_metadata");
  }

  const product = getProduct(productId);
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  return product.price;
}

/**
 * Update a bid amount (used when host edits a bid)
 */
export function updateBidAmount(
  bidId: number,
  newAmount: number,
): BidWithPlayer {
  // Validate new amount
  if (!Number.isInteger(newAmount) || newAmount <= 0) {
    throw new Error("Bid amount must be a positive integer");
  }

  // Get current game state to determine segment and round
  const workflow = getGameWorkflow();
  const segment = workflow.current_segment;
  const roundNumber = workflow.current_segment_index + 1;

  // Get original bid to check for duplicates
  const bids = dbGetBidsForRound(segment, roundNumber);
  const originalBid = bids.find((b) => b.id === bidId);

  if (!originalBid) {
    throw new Error("Bid not found");
  }

  // Check for duplicate with new amount (excluding this bid)
  const isDuplicate = checkDuplicateBid(
    originalBid.game_segment,
    originalBid.round_number,
    originalBid.retry_number,
    newAmount,
  );

  if (isDuplicate) {
    // Check if the duplicate is this same bid
    const duplicateBid = dbGetBidsForRound(
      originalBid.game_segment,
      originalBid.round_number,
    ).find((b) => b.bid_amount === newAmount);

    if (duplicateBid && duplicateBid.id !== bidId) {
      throw new Error("Bid amount already taken. Choose a unique bid.");
    }
  }

  // Update the bid
  const updated = updateBid(bidId, { bid_amount: newAmount, is_locked: 1 });

  // Get bid with player info
  const bid = dbGetBidsForRound(
    updated.game_segment,
    updated.round_number,
  ).find((b) => b.id === bidId);

  if (!bid) {
    throw new Error("Failed to retrieve updated bid");
  }

  return bid;
}
