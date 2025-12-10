import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  submitBid,
  getCurrentBids,
  getCurrentBidderPosition,
  calculateWinner,
  unlockBid,
  markWinner,
  clearBidsForRetry,
  getBiddingOrderForCurrentRow,
  hasPlayerBid,
  getCurrentProductPrice,
  updateBidAmount,
} from "./bidding.js";
import { setupTestDatabase, cleanupTestDatabase } from "../db/test-helper.js";
import { getDatabase } from "../db/connection.js";
import { addContestantToRow } from "../db/contestants.js";
import { updateGameWorkflow } from "../db/game-workflow.js";
import { createBid } from "../db/bids.js";

// Mock the products utility
// Prices are in DOLLARS (integers or decimals)
// - Integer (e.g., 15000) = $15,000
// - Decimal (e.g., 2.88) = $2.88
vi.mock("../utils/products.js", () => ({
  getProduct: vi.fn((id: string) => {
    const products: Record<string, { name: string; price: number }> = {
      "product-001": { name: "Car", price: 15000 },
      "product-002": { name: "TV", price: 1200 },
      "product-003": { name: "Vacation", price: 5000 },
    };
    return products[id];
  }),
}));

describe("Bidding Service Functions", () => {
  beforeEach(() => {
    setupTestDatabase();

    // Create test players
    const db = getDatabase();
    for (let i = 1; i <= 5; i++) {
      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, role)
         VALUES (?, ?, ?, ?)`,
      ).run(`Player${i}`, `Last${i}`, `CODE${i}`, "player");
    }

    // Add contestants to row
    for (let i = 1; i <= 5; i++) {
      addContestantToRow(i, i, "section_1", "active");
    }

    // Set up game workflow
    updateGameWorkflow({
      current_segment: "section_1",
      current_segment_index: 0,
      phase_type: "bidding",
      phase_metadata: JSON.stringify({
        product_id: "product-001",
        is_fresh_row: true,
      }),
    });
  });

  afterEach(() => {
    cleanupTestDatabase();
  });

  describe("submitBid", () => {
    it("should submit a valid bid", () => {
      const result = submitBid(1, 14000, "section_1", 1);

      expect(result.bid.player_id).toBe(1);
      expect(result.bid.bid_amount).toBe(14000);
      expect(result.allBidsSubmitted).toBe(false);
    });

    it("should include player information in returned bid", () => {
      const result = submitBid(1, 14000, "section_1", 1);

      expect(result.bid.first_name).toBe("Player1");
      expect(result.bid.last_name).toBe("Last1");
      expect(result.bid.position).toBe(1);
    });

    it("should detect when all 5 bids are submitted", () => {
      submitBid(1, 14000, "section_1", 1);
      submitBid(2, 15000, "section_1", 1);
      submitBid(3, 13000, "section_1", 1);
      submitBid(4, 12000, "section_1", 1);
      const result = submitBid(5, 11000, "section_1", 1);

      expect(result.allBidsSubmitted).toBe(true);
    });

    it("should reject negative bid amount", () => {
      expect(() => {
        submitBid(1, -1000, "section_1", 1);
      }).toThrow("Bid amount must be a positive integer");
    });

    it("should reject zero bid amount", () => {
      expect(() => {
        submitBid(1, 0, "section_1", 1);
      }).toThrow("Bid amount must be a positive integer");
    });

    it("should reject non-integer bid amount", () => {
      expect(() => {
        submitBid(1, 1000.5, "section_1", 1);
      }).toThrow("Bid amount must be a positive integer");
    });

    it("should reject duplicate bid amount", () => {
      submitBid(1, 14000, "section_1", 1);

      expect(() => {
        submitBid(2, 14000, "section_1", 1);
      }).toThrow("Bid amount already taken");
    });

    it("should reject bid when not player's turn", () => {
      // Player 1 should go first (position 1 in fresh row)
      // Try to submit for player 3
      expect(() => {
        submitBid(3, 14000, "section_1", 1);
      }).toThrow("Not your turn to bid");
    });

    it("should reject bid from player not in contestant's row", () => {
      // Create a player who is not a contestant
      const db = getDatabase();
      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, role)
         VALUES (?, ?, ?, ?)`,
      ).run("Player6", "Last6", "CODE6", "player");

      expect(() => {
        submitBid(6, 14000, "section_1", 1);
      }).toThrow("Player is not in contestant's row");
    });

    it("should allow bids in correct sequential order", () => {
      // Submit bids in correct turn order
      const result1 = submitBid(1, 14000, "section_1", 1);
      expect(result1.bid.player_id).toBe(1);
      expect(result1.allBidsSubmitted).toBe(false);

      const result2 = submitBid(2, 15000, "section_1", 1);
      expect(result2.bid.player_id).toBe(2);
      expect(result2.allBidsSubmitted).toBe(false);

      const result3 = submitBid(3, 13000, "section_1", 1);
      expect(result3.bid.player_id).toBe(3);
      expect(result3.allBidsSubmitted).toBe(false);

      // Verify all bids were created and turn advanced correctly
      const bids = getCurrentBids("section_1", 1);
      expect(bids).toHaveLength(3);
      expect(getCurrentBidderPosition("section_1")).toBe(4); // Next turn is position 4
    });
  });

  describe("getCurrentBids", () => {
    it("should return empty array when no bids", () => {
      const bids = getCurrentBids("section_1", 1);
      expect(bids).toEqual([]);
    });

    it("should return all bids for round with player info", () => {
      submitBid(1, 14000, "section_1", 1);
      submitBid(2, 15000, "section_1", 1);

      const bids = getCurrentBids("section_1", 1);

      expect(bids).toHaveLength(2);
      expect(bids[0].first_name).toBeDefined();
      expect(bids[0].position).toBeDefined();
    });

    it("should only return bids for current retry", () => {
      // First attempt
      submitBid(1, 14000, "section_1", 1);

      // Simulate "all over" - clear and create retry
      clearBidsForRetry("section_1", 1);
      createBid(1, "product-001", 1, "section_1", 12000, 1);

      const bids = getCurrentBids("section_1", 1);

      expect(bids).toHaveLength(1);
      expect(bids[0].bid_amount).toBe(12000);
      expect(bids[0].retry_number).toBe(1);
    });
  });

  describe("getCurrentBidderPosition", () => {
    it("should return position 1 when no bids submitted (fresh row)", () => {
      const position = getCurrentBidderPosition("section_1");
      expect(position).toBe(1);
    });

    it("should return next position after each bid", () => {
      submitBid(1, 14000, "section_1", 1);
      expect(getCurrentBidderPosition("section_1")).toBe(2);

      submitBid(2, 15000, "section_1", 1);
      expect(getCurrentBidderPosition("section_1")).toBe(3);
    });

    it("should return null when all 5 have bid", () => {
      submitBid(1, 14000, "section_1", 1);
      submitBid(2, 15000, "section_1", 1);
      submitBid(3, 13000, "section_1", 1);
      submitBid(4, 12000, "section_1", 1);
      submitBid(5, 11000, "section_1", 1);

      const position = getCurrentBidderPosition("section_1");
      expect(position).toBeNull();
    });

    it("should handle replacement row (most recent first)", () => {
      // Mark row as not fresh
      updateGameWorkflow({
        phase_metadata: JSON.stringify({
          product_id: "product-001",
          is_fresh_row: false,
        }),
      });

      // All contestants added at same time in test setup (positions 1-5 in order)
      // getBiddingOrder picks most recent by added_at DESC, id DESC
      // Since timestamps are same, it picks highest ID = last added = position 5
      const position = getCurrentBidderPosition("section_1");
      expect(position).toBe(5); // Most recently added contestant

      // Verify the full bidding order is correct (most recent first, then rotate)
      const order = getBiddingOrderForCurrentRow("section_1");
      expect(order[0]).toBe(5); // Most recent goes first
      expect(order).toContain(1);
      expect(order).toContain(2);
      expect(order).toContain(3);
      expect(order).toContain(4);
    });
  });

  describe("calculateWinner", () => {
    it("should calculate winner (closest without going over)", () => {
      submitBid(1, 14000, "section_1", 1);
      submitBid(2, 15000, "section_1", 1);
      submitBid(3, 14500, "section_1", 1);
      submitBid(4, 13000, "section_1", 1);
      submitBid(5, 14800, "section_1", 1);

      const result = calculateWinner("section_1", 1, 15000);

      expect("winner" in result).toBe(true);
      if ("winner" in result) {
        expect(result.winner.bid_amount).toBe(15000); // Exact match
        expect(result.winner.player_id).toBe(2);
      }
    });

    it("should return highest bid under price when no exact match", () => {
      submitBid(1, 14000, "section_1", 1);
      submitBid(2, 13000, "section_1", 1);
      submitBid(3, 14500, "section_1", 1);
      submitBid(4, 12000, "section_1", 1);
      submitBid(5, 11000, "section_1", 1);

      const result = calculateWinner("section_1", 1, 15000);

      expect("winner" in result).toBe(true);
      if ("winner" in result) {
        expect(result.winner.bid_amount).toBe(14500);
        expect(result.winner.player_id).toBe(3);
      }
    });

    it("should return all over when all bids exceed price", () => {
      submitBid(1, 16000, "section_1", 1);
      submitBid(2, 17000, "section_1", 1);
      submitBid(3, 18000, "section_1", 1);
      submitBid(4, 19000, "section_1", 1);
      submitBid(5, 20000, "section_1", 1);

      const result = calculateWinner("section_1", 1, 15000);

      expect("allOver" in result).toBe(true);
      if ("allOver" in result) {
        expect(result.allOver).toBe(true);
        expect(result.newRetryNumber).toBe(1);
      }
    });

    it("should reject duplicate bid amounts due to unique constraint", () => {
      // First bid succeeds
      createBid(1, "product-001", 1, "section_1", 14000, 0);

      // Second bid with same amount should fail
      expect(() => {
        createBid(2, "product-001", 1, "section_1", 14000, 0);
      }).toThrow("Bid amount already taken");
    });

    it("should throw error when no bids submitted", () => {
      expect(() => {
        calculateWinner("section_1", 1, 15000);
      }).toThrow("No bids submitted");
    });

    it("should include all bids in winner result", () => {
      submitBid(1, 14000, "section_1", 1);
      submitBid(2, 15000, "section_1", 1);
      submitBid(3, 13000, "section_1", 1);
      submitBid(4, 12000, "section_1", 1);
      submitBid(5, 11000, "section_1", 1);

      const result = calculateWinner("section_1", 1, 15000);

      expect("winner" in result).toBe(true);
      if ("winner" in result) {
        expect(result.allBids).toHaveLength(5);
      }
    });
  });

  describe("unlockBid", () => {
    it("should unlock a bid", () => {
      const { bid } = submitBid(1, 14000, "section_1", 1);

      const unlocked = unlockBid(bid.id);

      expect(unlocked.is_locked).toBe(0);
      expect(unlocked.id).toBe(bid.id);
    });

    it("should return bid with player info", () => {
      const { bid } = submitBid(1, 14000, "section_1", 1);

      const unlocked = unlockBid(bid.id);

      expect(unlocked.first_name).toBe("Player1");
      expect(unlocked.position).toBe(1);
    });
  });

  describe("markWinner", () => {
    it("should mark bid as winner", () => {
      const { bid } = submitBid(1, 14000, "section_1", 1);

      const winner = markWinner(bid.id);

      expect(winner.is_winner).toBe(1);
      expect(winner.id).toBe(bid.id);
    });

    it("should return winner with player info", () => {
      const { bid } = submitBid(1, 14000, "section_1", 1);

      const winner = markWinner(bid.id);

      expect(winner.first_name).toBe("Player1");
      expect(winner.position).toBe(1);
    });
  });

  describe("clearBidsForRetry", () => {
    it("should clear all bids for current retry", () => {
      submitBid(1, 14000, "section_1", 1);
      submitBid(2, 15000, "section_1", 1);

      clearBidsForRetry("section_1", 1);

      const bids = getCurrentBids("section_1", 1);
      expect(bids).toHaveLength(0);
    });

    it("should not affect bids from different retry", () => {
      // First attempt (retry 0)
      submitBid(1, 14000, "section_1", 1);
      submitBid(2, 15000, "section_1", 1);

      // Clear first attempt (clears current retry, which is 0)
      clearBidsForRetry("section_1", 1);

      // Verify first attempt is cleared
      let bids = getCurrentBids("section_1", 1);
      expect(bids).toHaveLength(0);

      // Create second attempt (retry 1)
      createBid(1, "product-001", 1, "section_1", 12000, 1);

      // Second attempt should exist
      bids = getCurrentBids("section_1", 1);
      expect(bids).toHaveLength(1);
      expect(bids[0].retry_number).toBe(1);
    });
  });

  describe("getBiddingOrderForCurrentRow", () => {
    it("should return left-to-right for fresh row", () => {
      const order = getBiddingOrderForCurrentRow("section_1");

      expect(order).toEqual([1, 2, 3, 4, 5]);
    });

    it("should return most-recent-first for replacement row", () => {
      // Mark row as not fresh
      updateGameWorkflow({
        phase_metadata: JSON.stringify({
          product_id: "product-001",
          is_fresh_row: false,
        }),
      });

      const order = getBiddingOrderForCurrentRow("section_1");

      expect(order).toHaveLength(5);
      expect(order).toContain(1);
      expect(order).toContain(2);
      expect(order).toContain(3);
      expect(order).toContain(4);
      expect(order).toContain(5);
    });
  });

  describe("hasPlayerBid", () => {
    it("should return false when player has not bid", () => {
      const hasBid = hasPlayerBid(1, "section_1", 1);
      expect(hasBid).toBe(false);
    });

    it("should return true when player has bid", () => {
      submitBid(1, 14000, "section_1", 1);

      const hasBid = hasPlayerBid(1, "section_1", 1);
      expect(hasBid).toBe(true);
    });

    it("should check current retry only", () => {
      // First attempt
      submitBid(1, 14000, "section_1", 1);

      // Clear for retry
      clearBidsForRetry("section_1", 1);

      // Check if player has bid in new retry
      const hasBid = hasPlayerBid(1, "section_1", 1);
      expect(hasBid).toBe(false);
    });
  });

  describe("getCurrentProductPrice", () => {
    it("should return product price from metadata", () => {
      const price = getCurrentProductPrice();
      expect(price).toBe(15000); // product-001 price
    });

    it("should throw error when no product_id in metadata", () => {
      updateGameWorkflow({
        phase_metadata: JSON.stringify({
          is_fresh_row: true,
        }),
      });

      expect(() => {
        getCurrentProductPrice();
      }).toThrow("No product_id in phase_metadata");
    });

    it("should throw error when product not found", () => {
      updateGameWorkflow({
        phase_metadata: JSON.stringify({
          product_id: "nonexistent-product",
          is_fresh_row: true,
        }),
      });

      expect(() => {
        getCurrentProductPrice();
      }).toThrow("Product not found");
    });
  });

  describe("updateBidAmount", () => {
    it("should update bid amount", () => {
      const { bid } = submitBid(1, 14000, "section_1", 1);

      const updated = updateBidAmount(bid.id, 13000);

      expect(updated.bid_amount).toBe(13000);
      expect(updated.is_locked).toBe(1);
    });

    it("should reject negative amount", () => {
      const { bid } = submitBid(1, 14000, "section_1", 1);

      expect(() => {
        updateBidAmount(bid.id, -1000);
      }).toThrow("Bid amount must be a positive integer");
    });

    it("should reject non-integer amount", () => {
      const { bid } = submitBid(1, 14000, "section_1", 1);

      expect(() => {
        updateBidAmount(bid.id, 1000.5);
      }).toThrow("Bid amount must be a positive integer");
    });

    it("should reject duplicate amount (from different player)", () => {
      const { bid } = submitBid(1, 14000, "section_1", 1);
      submitBid(2, 15000, "section_1", 1);

      expect(() => {
        updateBidAmount(bid.id, 15000);
      }).toThrow("Bid amount already taken");
    });

    it("should allow updating to same amount (same bid)", () => {
      const { bid } = submitBid(1, 14000, "section_1", 1);

      expect(() => {
        updateBidAmount(bid.id, 14000);
      }).not.toThrow();
    });

    it("should return updated bid with player info", () => {
      const { bid } = submitBid(1, 14000, "section_1", 1);

      const updated = updateBidAmount(bid.id, 13000);

      expect(updated.first_name).toBe("Player1");
      expect(updated.position).toBe(1);
    });
  });
});
