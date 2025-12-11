import {
  getShowcaseState as dbGetShowcaseState,
  getShowcaseStateWithPlayers as dbGetShowcaseStateWithPlayers,
  updateFinaleState as dbUpdateFinaleState,
  insertShowcaseBid as dbInsertShowcaseBid,
  getShowcaseBids as dbGetShowcaseBids,
  unlockShowcaseBid as dbUnlockShowcaseBid,
  updateShowcaseBid as dbUpdateShowcaseBid,
  setFinaleWinner as dbSetFinaleWinner,
  incrementRetryNumber as dbIncrementRetryNumber,
  getPlayerBidForRetry as dbGetPlayerBidForRetry,
  type ShowcaseState,
} from "../db/showcase.js";
import { getCurrentLeader } from "./wheel.js";
import { getWinnersForSegment } from "../db/bids.js";
import {
  getShowcase,
  getBonusThreshold,
  type Product,
} from "../utils/products.js";

/**
 * Determine the two finalists from wheel winners
 * Returns player IDs and their product values for bidding order determination
 */
export async function determineFinalists(_gameId: number): Promise<{
  player1: { id: number; productValue: number };
  player2: { id: number; productValue: number };
}> {
  // Get wheel winners from both sections
  const wheel1Winner = getCurrentLeader("section_1_finale", 0);
  const wheel2Winner = getCurrentLeader("section_2_finale", 0);

  if (!wheel1Winner || !wheel2Winner) {
    throw new Error("Cannot determine finalists: wheel winners not found");
  }

  // Get bidding winners to find product values
  const section1Winners = getWinnersForSegment("section_1");
  const section2Winners = getWinnersForSegment("section_2");

  // Find product value for wheel 1 winner
  const player1Bid = section1Winners.find(
    (w) => w.player_id === wheel1Winner.player_id,
  );
  if (!player1Bid) {
    throw new Error(
      `Wheel 1 winner (player ${wheel1Winner.player_id}) has no bidding win record`,
    );
  }

  // Find product value for wheel 2 winner
  const player2Bid = section2Winners.find(
    (w) => w.player_id === wheel2Winner.player_id,
  );
  if (!player2Bid) {
    throw new Error(
      `Wheel 2 winner (player ${wheel2Winner.player_id}) has no bidding win record`,
    );
  }

  // Get product prices from products.json
  const { getProduct } = await import("../utils/products.js");
  const player1Product = getProduct(player1Bid.product_id);
  const player2Product = getProduct(player2Bid.product_id);

  if (!player1Product || !player2Product) {
    throw new Error("Product not found for finalist");
  }

  return {
    player1: {
      id: wheel1Winner.player_id,
      productValue: player1Product.price,
    },
    player2: {
      id: wheel2Winner.player_id,
      productValue: player2Product.price,
    },
  };
}

/**
 * Calculate which player goes first based on product values
 * Returns player1 or player2
 * Tie-breaker: section 1 winner goes first
 */
export function calculateBiddingOrder(
  player1ProductValue: number,
  player2ProductValue: number,
  _player1Id: number,
): "player1" | "player2" {
  if (player1ProductValue > player2ProductValue) {
    return "player1";
  } else if (player2ProductValue > player1ProductValue) {
    return "player2";
  } else {
    // Tie: section 1 winner (player1) goes first
    return "player1";
  }
}

/**
 * Initialize showcase showdown
 * Determines finalists, calculates order, but does NOT assign showcases yet
 * Showcases are assigned when the first player makes their pass/bid decision
 */
export async function initializeShowcase(
  gameId: number,
): Promise<ShowcaseState> {
  const finalists = await determineFinalists(gameId);

  // Determine who goes first (higher product value)
  // This determines which player makes the first pass/bid decision
  calculateBiddingOrder(
    finalists.player1.productValue,
    finalists.player2.productValue,
    finalists.player1.id,
  );

  // Store in database WITHOUT assigning showcases yet
  // Showcases will be assigned when first player makes their decision
  dbUpdateFinaleState(gameId, {
    finale_player1_id: finalists.player1.id,
    finale_player2_id: finalists.player2.id,
    finale_player1_product_value: finalists.player1.productValue,
    finale_player2_product_value: finalists.player2.productValue,
    finale_player1_showcase: null, // Not assigned yet
    finale_player2_showcase: null, // Not assigned yet
    finale_retry_number: 0,
    finale_player1_passed: 0,
    showcase1_revealed: 0, // Reset reveal state
    showcase2_revealed: 0, // Reset reveal state
    showcase_modal_open: 0, // Reset modal state
    showcase_modal_product_index: 0, // Reset modal navigation
    showcase_modal_image_index: 0, // Reset modal navigation
  });

  return dbGetShowcaseState(gameId)!;
}

/**
 * Handle first player passing on showcase 1
 * Assigns showcases: first player gets showcase 2, second player gets showcase 1
 */
export function handlePass(gameId: number): void {
  const state = dbGetShowcaseState(gameId);
  if (!state) {
    throw new Error("Showcase state not initialized");
  }

  console.log("[handlePass] BEFORE assignment:", {
    player1Showcase: state.finale_player1_showcase,
    player2Showcase: state.finale_player2_showcase,
    player1Passed: state.finale_player1_passed,
  });

  // First player passes, so they get showcase 2 and second player gets showcase 1
  dbUpdateFinaleState(gameId, {
    finale_player1_showcase: 2, // First player gets showcase 2
    finale_player2_showcase: 1, // Second player gets showcase 1
    finale_player1_passed: 1,
  });

  const updatedState = dbGetShowcaseState(gameId);
  console.log("[handlePass] AFTER assignment:", {
    player1Showcase: updatedState?.finale_player1_showcase,
    player2Showcase: updatedState?.finale_player2_showcase,
    player1Passed: updatedState?.finale_player1_passed,
  });
}

/**
 * Handle first player choosing to bid (not pass)
 * Assigns showcases: first player gets showcase 1, second player gets showcase 2
 */
export function handleBidDecision(gameId: number): void {
  const state = dbGetShowcaseState(gameId);
  if (!state) {
    throw new Error("Showcase state not initialized");
  }

  console.log("[handleBidDecision] BEFORE assignment:", {
    player1Showcase: state.finale_player1_showcase,
    player2Showcase: state.finale_player2_showcase,
  });

  // First player chooses to bid, so they get showcase 1 and second player gets showcase 2
  dbUpdateFinaleState(gameId, {
    finale_player1_showcase: 1, // First player gets showcase 1
    finale_player2_showcase: 2, // Second player gets showcase 2
  });

  const updatedState = dbGetShowcaseState(gameId);
  console.log("[handleBidDecision] AFTER assignment:", {
    player1Showcase: updatedState?.finale_player1_showcase,
    player2Showcase: updatedState?.finale_player2_showcase,
  });
}

/**
 * Submit a showcase bid
 * Validates player, showcase assignment, and records bid
 */
export function submitBid(
  gameId: number,
  playerId: number,
  bidAmount: number,
): void {
  const state = dbGetShowcaseState(gameId);
  if (!state) {
    throw new Error("Showcase state not initialized");
  }

  // Validate player is a finalist
  if (
    playerId !== state.finale_player1_id &&
    playerId !== state.finale_player2_id
  ) {
    throw new Error("Player is not a finalist");
  }

  // Determine which showcase this player should bid on
  const showcaseNumber =
    playerId === state.finale_player1_id
      ? state.finale_player1_showcase!
      : state.finale_player2_showcase!;

  // Check if bid already exists for this retry
  const existingBid = dbGetPlayerBidForRetry(
    gameId,
    playerId,
    state.finale_retry_number,
  );

  if (existingBid && existingBid.locked === 1) {
    throw new Error("Bid already submitted and locked");
  }

  // Validate bid amount
  if (bidAmount <= 0) {
    throw new Error("Bid amount must be positive");
  }

  // Insert bid
  dbInsertShowcaseBid({
    game_id: gameId,
    player_id: playerId,
    showcase_number: showcaseNumber,
    bid_amount: bidAmount,
    retry_number: state.finale_retry_number,
  });
}

/**
 * Unlock a bid to allow re-entry
 */
export function unlockBid(gameId: number, playerId: number): void {
  const state = dbGetShowcaseState(gameId);
  if (!state) {
    throw new Error("Showcase state not initialized");
  }

  dbUnlockShowcaseBid(gameId, playerId, state.finale_retry_number);
}

/**
 * Update a bid amount (host override)
 */
export function updateBid(
  gameId: number,
  playerId: number,
  bidAmount: number,
): void {
  const state = dbGetShowcaseState(gameId);
  if (!state) {
    throw new Error("Showcase state not initialized");
  }

  const bid = dbGetPlayerBidForRetry(
    gameId,
    playerId,
    state.finale_retry_number,
  );

  if (!bid) {
    throw new Error("Bid not found");
  }

  dbUpdateShowcaseBid(bid.id, bidAmount);
}

/**
 * Calculate showcase total value
 */
function calculateShowcaseValue(showcaseNumber: 1 | 2): number {
  const showcase = getShowcase(showcaseNumber);
  return showcase.reduce((sum, item) => sum + item.product.price, 0);
}

/**
 * Calculate winner and determine if bonus applies
 * Returns winner info or null if both went over (retry needed)
 */
export function calculateWinner(gameId: number): {
  winnerId: number;
  bonusWon: boolean;
  player1Over: boolean;
  player2Over: boolean;
  player1Diff: number;
  player2Diff: number;
} {
  const state = dbGetShowcaseState(gameId);
  if (!state) {
    throw new Error("Showcase state not initialized");
  }

  // Get current bids
  const bids = dbGetShowcaseBids(gameId, state.finale_retry_number);

  const player1Bid = bids.find((b) => b.player_id === state.finale_player1_id);
  const player2Bid = bids.find((b) => b.player_id === state.finale_player2_id);

  if (!player1Bid || !player2Bid) {
    throw new Error("Both players must have bids");
  }

  // Get showcase values
  const showcase1Value = calculateShowcaseValue(1);
  const showcase2Value = calculateShowcaseValue(2);

  // Determine which player has which showcase
  const player1ShowcaseValue =
    state.finale_player1_showcase === 1 ? showcase1Value : showcase2Value;
  const player2ShowcaseValue =
    state.finale_player2_showcase === 1 ? showcase1Value : showcase2Value;

  // Calculate differences
  const player1Diff = player1ShowcaseValue - player1Bid.bid_amount;
  const player2Diff = player2ShowcaseValue - player2Bid.bid_amount;

  // Check if over
  const player1Over = player1Diff < 0;
  const player2Over = player2Diff < 0;

  // Both over: retry needed
  if (player1Over && player2Over) {
    return {
      winnerId: 0, // No winner
      bonusWon: false,
      player1Over: true,
      player2Over: true,
      player1Diff,
      player2Diff,
    };
  }

  // One or both valid: determine winner
  let winnerId: number;
  let winnerDiff: number;

  if (player1Over) {
    // Player 1 over, player 2 wins
    winnerId = state.finale_player2_id!;
    winnerDiff = player2Diff;
  } else if (player2Over) {
    // Player 2 over, player 1 wins
    winnerId = state.finale_player1_id!;
    winnerDiff = player1Diff;
  } else {
    // Both valid: closest wins
    if (player1Diff <= player2Diff) {
      winnerId = state.finale_player1_id!;
      winnerDiff = player1Diff;
    } else {
      winnerId = state.finale_player2_id!;
      winnerDiff = player2Diff;
    }
  }

  // Check bonus (winner within threshold)
  const threshold = getBonusThreshold();
  const bonusWon = winnerDiff >= 0 && winnerDiff <= threshold;

  return {
    winnerId,
    bonusWon,
    player1Over,
    player2Over,
    player1Diff,
    player2Diff,
  };
}

/**
 * Reveal winner and store in database
 */
export function revealWinner(gameId: number): {
  winnerId: number;
  bonusWon: boolean;
  retryNeeded: boolean;
} {
  const result = calculateWinner(gameId);

  // Check if retry needed
  if (result.player1Over && result.player2Over) {
    return {
      winnerId: 0,
      bonusWon: false,
      retryNeeded: true,
    };
  }

  // Store winner
  dbSetFinaleWinner(gameId, result.winnerId, result.bonusWon);

  return {
    winnerId: result.winnerId,
    bonusWon: result.bonusWon,
    retryNeeded: false,
  };
}

/**
 * Initiate retry when both players go over
 * Increments retry number, maintains showcase assignments
 */
export function initiateRetry(gameId: number): number {
  const result = calculateWinner(gameId);

  // Verify both players went over
  if (!result.player1Over || !result.player2Over) {
    throw new Error("Retry not needed: at least one player has valid bid");
  }

  // Increment retry number
  const newRetryNumber = dbIncrementRetryNumber(gameId);

  return newRetryNumber;
}

/**
 * Get complete showcase state with product details
 */
export function getShowcaseStateWithProducts(gameId: number): {
  state: ReturnType<typeof dbGetShowcaseStateWithPlayers>;
  showcase1: Array<{ id: string; product: Product }>;
  showcase2: Array<{ id: string; product: Product }>;
  showcase1Value: number;
  showcase2Value: number;
  bonusThreshold: number;
} {
  const state = dbGetShowcaseStateWithPlayers(gameId);
  if (!state) {
    throw new Error("Showcase state not initialized");
  }

  return {
    state,
    showcase1: getShowcase(1),
    showcase2: getShowcase(2),
    showcase1Value: calculateShowcaseValue(1),
    showcase2Value: calculateShowcaseValue(2),
    bonusThreshold: getBonusThreshold(),
  };
}
