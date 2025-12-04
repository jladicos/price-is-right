import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  determineFinalists,
  calculateBiddingOrder,
  initializeShowcase,
  handlePass,
  handleBidDecision,
  submitBid,
  unlockBid,
  updateBid,
  calculateWinner,
  revealWinner,
  initiateRetry,
  getShowcaseStateWithProducts,
} from "./showcase.js";
import { getDatabase } from "../db/connection.js";
import { setupTestDatabase, cleanupTestDatabase } from "../db/test-helper.js";
import { createWheelSpin } from "../db/wheel-spins.js";
import { createBid, updateBid as dbUpdateBid } from "../db/bids.js";
import { addContestantToRow } from "../db/contestants.js";
import { getShowcaseState } from "../db/showcase.js";

describe("Showcase Service", () => {
  beforeEach(() => {
    setupTestDatabase();

    // Create test players
    const db = getDatabase();
    for (let i = 1; i <= 5; i++) {
      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, role, photo_filename)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(`Player${i}`, `Last${i}`, `CODE${i}`, "player", `player${i}.jpg`);
    }
  });

  afterEach(() => {
    cleanupTestDatabase();
  });

  describe("calculateBiddingOrder", () => {
    it("should return player1 when player1 has higher product value", () => {
      const result = calculateBiddingOrder(25000, 15000, 1);
      expect(result).toBe("player1");
    });

    it("should return player2 when player2 has higher product value", () => {
      const result = calculateBiddingOrder(15000, 25000, 1);
      expect(result).toBe("player2");
    });

    it("should return player1 on tie (section 1 winner tie-breaker)", () => {
      const result = calculateBiddingOrder(20000, 20000, 1);
      expect(result).toBe("player1");
    });
  });

  describe("determineFinalists", () => {
    beforeEach(() => {
      // Add contestants to row
      addContestantToRow(1, 1, "section_1", "won");
      addContestantToRow(2, 2, "section_2", "won");

      // Create bidding wins (using actual product IDs from products.json)
      const bid1 = createBid(1, "lemon-juice", 1, "section_1", 1200, 0);
      const bid2 = createBid(2, "apple-juice", 1, "section_2", 1500, 0);

      // Mark as winners
      dbUpdateBid(bid1.id, { is_winner: 1 });
      dbUpdateBid(bid2.id, { is_winner: 1 });

      // Create wheel spins (player 1 and player 2 win their wheels)
      createWheelSpin(1, "section_1_finale", 1, 1.0, 0); // Perfect $1.00
      createWheelSpin(2, "section_2_finale", 1, 0.95, 0); // $0.95
    });

    it("should determine finalists from wheel winners", async () => {
      const result = await determineFinalists(1);

      expect(result.player1.id).toBe(1);
      expect(result.player2.id).toBe(2);
      expect(result.player1.productValue).toBe(2.88); // lemon-juice price
      expect(result.player2.productValue).toBe(2.58); // apple-juice price
    });

    it("should throw error if wheel winner not found", async () => {
      // Clear wheel spins
      const db = getDatabase();
      db.prepare("DELETE FROM wheel_spins").run();

      await expect(determineFinalists(1)).rejects.toThrow(
        "wheel winners not found",
      );
    });

    it("should throw error if wheel winner has no bidding win", async () => {
      // Mark bids as not winners
      const db = getDatabase();
      db.prepare("UPDATE bids SET is_winner = 0").run();

      await expect(determineFinalists(1)).rejects.toThrow("no bidding win");
    });
  });

  describe("initializeShowcase", () => {
    beforeEach(() => {
      // Setup finalists
      addContestantToRow(1, 1, "section_1", "won");
      addContestantToRow(2, 2, "section_2", "won");

      const bid1 = createBid(1, "lemon-juice", 1, "section_1", 1200, 0);
      const bid2 = createBid(2, "apple-juice", 1, "section_2", 1500, 0);

      dbUpdateBid(bid1.id, { is_winner: 1 });
      dbUpdateBid(bid2.id, { is_winner: 1 });

      createWheelSpin(1, "section_1_finale", 1, 1.0, 0);
      createWheelSpin(2, "section_2_finale", 1, 0.95, 0);
    });

    it("should initialize showcase with correct player order", async () => {
      const state = await initializeShowcase(1);

      expect(state.finale_player1_id).toBe(1);
      expect(state.finale_player2_id).toBe(2);
      expect(state.finale_player1_product_value).toBe(2.88);
      expect(state.finale_player2_product_value).toBe(2.58);
    });

    it("should not assign showcases during initialization (deferred to pass/bid decision)", async () => {
      const state = await initializeShowcase(1);

      // Showcases are not assigned until player makes pass/bid decision
      expect(state.finale_player1_showcase).toBe(null);
      expect(state.finale_player2_showcase).toBe(null);
    });

    it("should initialize retry number to 0", async () => {
      const state = await initializeShowcase(1);

      expect(state.finale_retry_number).toBe(0);
    });

    it("should initialize passed flag to 0", async () => {
      const state = await initializeShowcase(1);

      expect(state.finale_player1_passed).toBe(0);
    });
  });

  describe("handlePass", () => {
    beforeEach(async () => {
      // Setup finalists
      addContestantToRow(1, 1, "section_1", "won");
      addContestantToRow(2, 2, "section_2", "won");

      const bid1 = createBid(1, "lemon-juice", 1, "section_1", 1200, 0);
      const bid2 = createBid(2, "apple-juice", 1, "section_2", 1500, 0);

      dbUpdateBid(bid1.id, { is_winner: 1 });
      dbUpdateBid(bid2.id, { is_winner: 1 });

      createWheelSpin(1, "section_1_finale", 1, 1.0, 0);
      createWheelSpin(2, "section_2_finale", 1, 0.95, 0);

      await initializeShowcase(1);
    });

    it("should assign showcase 2 to player1 and showcase 1 to player2 when player1 passes", () => {
      // Before handlePass, showcases are not assigned
      const stateBefore = getShowcaseState(1)!;
      expect(stateBefore.finale_player1_showcase).toBe(null);
      expect(stateBefore.finale_player2_showcase).toBe(null);

      handlePass(1);

      // After pass, player1 gets showcase 2, player2 gets showcase 1
      const stateAfter = getShowcaseState(1)!;
      expect(stateAfter.finale_player1_showcase).toBe(2);
      expect(stateAfter.finale_player2_showcase).toBe(1);
    });

    it("should set passed flag to 1", () => {
      handlePass(1);

      const state = getShowcaseState(1)!;
      expect(state.finale_player1_passed).toBe(1);
    });
  });

  describe("submitBid", () => {
    beforeEach(async () => {
      addContestantToRow(1, 1, "section_1", "won");
      addContestantToRow(2, 2, "section_2", "won");

      const bid1 = createBid(1, "lemon-juice", 1, "section_1", 1200, 0);
      const bid2 = createBid(2, "apple-juice", 1, "section_2", 1500, 0);

      dbUpdateBid(bid1.id, { is_winner: 1 });
      dbUpdateBid(bid2.id, { is_winner: 1 });

      createWheelSpin(1, "section_1_finale", 1, 1.0, 0);
      createWheelSpin(2, "section_2_finale", 1, 0.95, 0);

      await initializeShowcase(1);
      handleBidDecision(1);
    });

    it("should submit bid for player 1", () => {
      expect(() => {
        submitBid(1, 1, 50000);
      }).not.toThrow();

      const db = getDatabase();
      const bid = db
        .prepare(
          "SELECT * FROM showcase_bids WHERE game_id = 1 AND player_id = 1",
        )
        .get();

      expect(bid).toBeDefined();
    });

    it("should submit bid for player 2", () => {
      expect(() => {
        submitBid(1, 2, 30000);
      }).not.toThrow();

      const db = getDatabase();
      const bid = db
        .prepare(
          "SELECT * FROM showcase_bids WHERE game_id = 1 AND player_id = 2",
        )
        .get();

      expect(bid).toBeDefined();
    });

    it("should throw error for non-finalist", () => {
      expect(() => {
        submitBid(1, 99, 25000);
      }).toThrow("not a finalist");
    });

    it("should throw error for negative bid", () => {
      expect(() => {
        submitBid(1, 1, -1000);
      }).toThrow("must be positive");
    });

    it("should throw error for zero bid", () => {
      expect(() => {
        submitBid(1, 1, 0);
      }).toThrow("must be positive");
    });

    it("should assign correct showcase number", () => {
      const state = getShowcaseState(1)!;

      submitBid(1, 1, 50000);

      const db = getDatabase();
      const bid = db
        .prepare(
          "SELECT * FROM showcase_bids WHERE game_id = 1 AND player_id = 1",
        )
        .get() as any;

      expect(bid.showcase_number).toBe(state.finale_player1_showcase);
    });
  });

  describe("calculateWinner", () => {
    beforeEach(async () => {
      addContestantToRow(1, 1, "section_1", "won");
      addContestantToRow(2, 2, "section_2", "won");

      const bid1 = createBid(1, "lemon-juice", 1, "section_1", 1200, 0);
      const bid2 = createBid(2, "apple-juice", 1, "section_2", 1500, 0);

      dbUpdateBid(bid1.id, { is_winner: 1 });
      dbUpdateBid(bid2.id, { is_winner: 1 });

      createWheelSpin(1, "section_1_finale", 1, 1.0, 0);
      createWheelSpin(2, "section_2_finale", 1, 0.95, 0);

      await initializeShowcase(1);
      handleBidDecision(1);
    });

    it("should determine winner when both valid bids", () => {
      // Showcase 1: lemon-juice (2.88) + mango-pineapple (4.78) + allens-apple-juice (1.33) = 8.99
      // Player 1 bids 8.50 (diff: 0.49)
      // Player 2 bids 14.00 on showcase 2

      submitBid(1, 1, 8.5);
      submitBid(1, 2, 14.0);

      const result = calculateWinner(1);

      // Player 1 should win (closest without going over)
      expect(result.winnerId).toBeGreaterThan(0);
      expect(result.player1Over).toBe(false);
      expect(result.player2Over).toBe(false);
    });

    it("should detect when both players go over", () => {
      // Both bid higher than their showcase values
      submitBid(1, 1, 100); // Way over
      submitBid(1, 2, 100); // Way over

      const result = calculateWinner(1);

      expect(result.winnerId).toBe(0);
      expect(result.player1Over).toBe(true);
      expect(result.player2Over).toBe(true);
    });

    it("should determine winner when one player goes over", () => {
      submitBid(1, 1, 100); // Player 1 over
      submitBid(1, 2, 14); // Player 2 valid

      const result = calculateWinner(1);

      expect(result.winnerId).toBe(2);
      expect(result.player1Over).toBe(true);
      expect(result.player2Over).toBe(false);
    });

    it("should detect bonus when within threshold", () => {
      // Calculate showcase 1 value
      // lemon-juice (2.88) + mango-pineapple (4.78) + allens-apple-juice (1.33) = 8.99
      // Bid 8.80 (diff: 0.19 cents = $0.19, within threshold of $250)

      submitBid(1, 1, 8.8);
      submitBid(1, 2, 100); // Other player over

      const result = calculateWinner(1);

      expect(result.bonusWon).toBe(true);
      expect(result.winnerId).toBe(1);
    });

    it("should not award bonus when outside threshold", () => {
      // Bid 1.00 (diff: 7.99, outside threshold of 0.250 = 25 cents)
      // Note: bonus threshold is $250 in config, but our products are in dollars
      submitBid(1, 1, 1.0);
      submitBid(1, 2, 100); // Other player over

      const result = calculateWinner(1);

      expect(result.bonusWon).toBe(false);
      expect(result.winnerId).toBe(1);
    });
  });

  describe("revealWinner", () => {
    beforeEach(async () => {
      addContestantToRow(1, 1, "section_1", "won");
      addContestantToRow(2, 2, "section_2", "won");

      const bid1 = createBid(1, "lemon-juice", 1, "section_1", 1200, 0);
      const bid2 = createBid(2, "apple-juice", 1, "section_2", 1500, 0);

      dbUpdateBid(bid1.id, { is_winner: 1 });
      dbUpdateBid(bid2.id, { is_winner: 1 });

      createWheelSpin(1, "section_1_finale", 1, 1.0, 0);
      createWheelSpin(2, "section_2_finale", 1, 0.95, 0);

      await initializeShowcase(1);
      handleBidDecision(1);
    });

    it("should store winner in database", () => {
      submitBid(1, 1, 8.5);
      submitBid(1, 2, 14.0);

      const result = revealWinner(1);

      expect(result.winnerId).toBeGreaterThan(0);
      expect(result.retryNeeded).toBe(false);

      // Verify stored in database
      const state = getShowcaseState(1)!;
      expect(state.finale_winner_id).toBe(result.winnerId);
      expect(state.finale_bonus_won).toBe(result.bonusWon ? 1 : 0);
    });

    it("should indicate retry needed when both over", () => {
      submitBid(1, 1, 100);
      submitBid(1, 2, 100);

      const result = revealWinner(1);

      expect(result.winnerId).toBe(0);
      expect(result.retryNeeded).toBe(true);
    });
  });

  describe("initiateRetry", () => {
    beforeEach(async () => {
      addContestantToRow(1, 1, "section_1", "won");
      addContestantToRow(2, 2, "section_2", "won");

      const bid1 = createBid(1, "lemon-juice", 1, "section_1", 1200, 0);
      const bid2 = createBid(2, "apple-juice", 1, "section_2", 1500, 0);

      dbUpdateBid(bid1.id, { is_winner: 1 });
      dbUpdateBid(bid2.id, { is_winner: 1 });

      createWheelSpin(1, "section_1_finale", 1, 1.0, 0);
      createWheelSpin(2, "section_2_finale", 1, 0.95, 0);

      await initializeShowcase(1);
      handleBidDecision(1);
    });

    it("should increment retry number", () => {
      submitBid(1, 1, 100);
      submitBid(1, 2, 100);

      const newRetryNumber = initiateRetry(1);

      expect(newRetryNumber).toBe(1);

      const state = getShowcaseState(1)!;
      expect(state.finale_retry_number).toBe(1);
    });

    it("should throw error if retry not needed", () => {
      submitBid(1, 1, 8.5);
      submitBid(1, 2, 14.0);

      expect(() => {
        initiateRetry(1);
      }).toThrow("Retry not needed");
    });
  });

  describe("getShowcaseStateWithProducts", () => {
    beforeEach(async () => {
      addContestantToRow(1, 1, "section_1", "won");
      addContestantToRow(2, 2, "section_2", "won");

      const bid1 = createBid(1, "lemon-juice", 1, "section_1", 1200, 0);
      const bid2 = createBid(2, "apple-juice", 1, "section_2", 1500, 0);

      dbUpdateBid(bid1.id, { is_winner: 1 });
      dbUpdateBid(bid2.id, { is_winner: 1 });

      createWheelSpin(1, "section_1_finale", 1, 1.0, 0);
      createWheelSpin(2, "section_2_finale", 1, 0.95, 0);

      await initializeShowcase(1);
      handleBidDecision(1);
    });

    it("should return complete showcase state with products", () => {
      const result = getShowcaseStateWithProducts(1);

      expect(result.state).toBeDefined();
      expect(result.showcase1).toBeInstanceOf(Array);
      expect(result.showcase2).toBeInstanceOf(Array);
      expect(result.showcase1Value).toBeGreaterThan(0);
      expect(result.showcase2Value).toBeGreaterThan(0);
      expect(result.bonusThreshold).toBe(1.0); // Matches config value
    });

    it("should include product details", () => {
      const result = getShowcaseStateWithProducts(1);

      expect(result.showcase1[0]).toHaveProperty("id");
      expect(result.showcase1[0]).toHaveProperty("product");
      expect(result.showcase1[0].product).toHaveProperty("name");
      expect(result.showcase1[0].product).toHaveProperty("price");
    });
  });

  describe("Edge Cases", () => {
    beforeEach(async () => {
      addContestantToRow(1, 1, "section_1", "won");
      addContestantToRow(2, 2, "section_2", "won");

      const bid1 = createBid(1, "lemon-juice", 1, "section_1", 1200, 0);
      const bid2 = createBid(2, "apple-juice", 1, "section_2", 1500, 0);

      dbUpdateBid(bid1.id, { is_winner: 1 });
      dbUpdateBid(bid2.id, { is_winner: 1 });

      createWheelSpin(1, "section_1_finale", 1, 1.0, 0);
      createWheelSpin(2, "section_2_finale", 1, 0.95, 0);

      await initializeShowcase(1);
      // Assign showcases by having player 1 choose to bid
      handleBidDecision(1);
    });

    it("should reject bid when already locked", () => {
      // Submit initial bid
      submitBid(1, 1, 8.5);

      // Try to submit again (should fail - bid is locked)
      expect(() => {
        submitBid(1, 1, 9.0);
      }).toThrow("already submitted and locked");
    });

    it("should allow resubmit after unlocking bid", () => {
      // Submit initial bid
      submitBid(1, 1, 8.5);

      // Unlock the bid
      unlockBid(1, 1);

      // Should now allow resubmit
      expect(() => {
        submitBid(1, 1, 9.0);
      }).not.toThrow();

      // Verify new amount
      const db = getDatabase();
      const bid = db
        .prepare(
          "SELECT * FROM showcase_bids WHERE player_id = 1 ORDER BY id DESC LIMIT 1",
        )
        .get() as any;
      expect(bid.bid_amount).toBe(9.0);
    });

    it("should handle exact showcase value bid with bonus", () => {
      // Showcase 1 = 2.88 + 4.78 + 1.33 = 8.99
      submitBid(1, 1, 8.99); // Exact!
      submitBid(1, 2, 100); // Other player over

      const result = calculateWinner(1);

      expect(result.winnerId).toBe(1);
      expect(result.player1Diff).toBe(0);
      expect(result.bonusWon).toBe(true); // diff=0 is within threshold!
    });

    it("should award win to player1 when differences are equal", () => {
      // Engineer scenario where both diffs are exactly 0.50
      // Showcase 1 = 8.99, bid 8.49 -> diff = 0.50
      // Showcase 2 = 15.02, bid 14.52 -> diff = 0.50
      submitBid(1, 1, 8.49);
      submitBid(1, 2, 14.52);

      const result = calculateWinner(1);

      // Player 1 should win the tie
      expect(result.player1Diff).toBeCloseTo(0.5, 2);
      expect(result.player2Diff).toBeCloseTo(0.5, 2);
      expect(result.winnerId).toBe(1); // Player 1 wins on tie
    });

    it("should throw error when trying to calculate winner without all bids", () => {
      // Only submit one bid
      submitBid(1, 1, 8.5);

      // Should throw when calculating
      expect(() => {
        calculateWinner(1);
      }).toThrow("Both players must have bids");
    });

    it("should throw error when updating non-existent bid", () => {
      // Try to update without submitting first
      expect(() => {
        updateBid(1, 1, 10);
      }).toThrow("Bid not found");
    });

    it("should handle complete retry flow", () => {
      // First attempt - both go over
      submitBid(1, 1, 100);
      submitBid(1, 2, 100);

      // Verify both over
      let result = calculateWinner(1);
      expect(result.player1Over).toBe(true);
      expect(result.player2Over).toBe(true);

      // Initiate retry
      const retryNum = initiateRetry(1);
      expect(retryNum).toBe(1);

      // Submit NEW bids for retry
      submitBid(1, 1, 8.5);
      submitBid(1, 2, 14.0);

      // Verify bids have correct retry_number
      const db = getDatabase();
      const retryBids = db
        .prepare("SELECT * FROM showcase_bids WHERE retry_number = 1")
        .all();
      expect(retryBids.length).toBe(2);

      // Verify winner calculation uses retry bids (not original)
      result = calculateWinner(1);
      expect(result.winnerId).toBeGreaterThan(0); // Should have a winner now
      expect(result.player1Over).toBe(false);
      expect(result.player2Over).toBe(false);
    });

    it("should assign correct showcase after pass", async () => {
      // This test needs its own setup WITHOUT handleBidDecision
      // Reset showcase state by re-initializing
      const db = getDatabase();
      db.prepare("DELETE FROM showcase_bids").run();
      db.prepare(
        "UPDATE game_workflow SET finale_player1_showcase = NULL, finale_player2_showcase = NULL",
      ).run();
      await initializeShowcase(1);

      // Verify showcases are not assigned yet
      let state = getShowcaseState(1)!;
      expect(state.finale_player1_showcase).toBe(null);
      expect(state.finale_player2_showcase).toBe(null);

      // Player 1 passes - this assigns showcase 2 to player 1, showcase 1 to player 2
      handlePass(1);

      // Get new assignment
      state = getShowcaseState(1)!;

      // Verify showcases were assigned correctly after pass
      expect(state.finale_player1_showcase).toBe(2); // First player gets showcase 2 when passing
      expect(state.finale_player2_showcase).toBe(1); // Second player gets showcase 1
      expect(state.finale_player1_passed).toBe(1);

      // Submit bid and verify it uses NEW showcase assignment
      submitBid(1, 1, 10);

      const bid = db
        .prepare("SELECT * FROM showcase_bids WHERE player_id = 1")
        .get() as any;

      expect(bid.showcase_number).toBe(state.finale_player1_showcase);
    });
  });
});
