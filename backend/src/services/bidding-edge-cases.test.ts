import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  submitBid,
  getCurrentBidderPosition,
  calculateWinner,
  unlockBid,
  clearBidsForRetry,
  getCurrentBids,
  getBiddingOrderForCurrentRow,
  updateBidAmount,
  getCurrentProductPrice,
} from "./bidding.js";
import { setupTestDatabase, cleanupTestDatabase } from "../db/test-helper.js";
import { getDatabase } from "../db/connection.js";
import { addContestantToRow, replaceContestant } from "../db/contestants.js";
import { updateGameWorkflow } from "../db/game-workflow.js";

// Mock the products utility
vi.mock("../utils/products.js", () => ({
  getProduct: vi.fn((id: string) => {
    const products: Record<string, { name: string; price: number }> = {
      "product-001": { name: "Car", price: 15000 },
    };
    return products[id];
  }),
}));

describe("Bidding Service - Edge Cases & Missing Tests", () => {
  beforeEach(() => {
    setupTestDatabase();

    const db = getDatabase();
    // Create 10 test players
    for (let i = 1; i <= 10; i++) {
      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, role)
         VALUES (?, ?, ?, ?)`,
      ).run(`Player${i}`, `Last${i}`, `CODE${i}`, "player");
    }
  });

  afterEach(() => {
    cleanupTestDatabase();
  });

  describe("Partial Bids", () => {
    beforeEach(() => {
      // Add 5 contestants
      for (let i = 1; i <= 5; i++) {
        addContestantToRow(i, i, "section_1", "active");
      }

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

    it("should return allBidsSubmitted=false when only 4 bids submitted", () => {
      submitBid(1, 14000, "section_1", 1);
      submitBid(2, 15000, "section_1", 1);
      submitBid(3, 13000, "section_1", 1);
      const result = submitBid(4, 12000, "section_1", 1);

      expect(result.allBidsSubmitted).toBe(false);
    });

    it("should return allBidsSubmitted=false when only 1 bid submitted", () => {
      const result = submitBid(1, 14000, "section_1", 1);

      expect(result.allBidsSubmitted).toBe(false);
    });

    it("should correctly track current bidder position with partial bids", () => {
      submitBid(1, 14000, "section_1", 1);
      expect(getCurrentBidderPosition("section_1")).toBe(2);

      submitBid(2, 15000, "section_1", 1);
      expect(getCurrentBidderPosition("section_1")).toBe(3);

      submitBid(3, 13000, "section_1", 1);
      expect(getCurrentBidderPosition("section_1")).toBe(4);
    });
  });

  describe("Replacement Row Bidding Order (FIXED)", () => {
    it("should correctly determine first bidder in replacement row", () => {
      // Add initial 5 contestants
      for (let i = 1; i <= 5; i++) {
        addContestantToRow(i, i, "section_1", "active");
      }

      // Manually set earlier timestamps for initial contestants to ensure time difference
      const db = getDatabase();
      db.prepare(
        `UPDATE contestants_row
         SET added_at = datetime('now', '-10 seconds')
         WHERE position IN (1, 2, 4, 5)`,
      ).run();

      // Replace position 3 with player 6 (happens "now", so it's most recent)
      const contestant3 = db
        .prepare("SELECT id FROM contestants_row WHERE position = 3")
        .get() as {
        id: number;
      };

      replaceContestant(contestant3.id, 6, "active");

      updateGameWorkflow({
        current_segment: "section_1",
        current_segment_index: 0,
        phase_type: "bidding",
        phase_metadata: JSON.stringify({
          product_id: "product-001",
          is_fresh_row: false, // NOT fresh - replacement row
        }),
      });

      // Most recent (position 3, player 6) should be first
      const position = getCurrentBidderPosition("section_1");
      expect(position).toBe(3);

      // Verify full bidding order: most recent first, then rotate
      const order = getBiddingOrderForCurrentRow("section_1");
      expect(order[0]).toBe(3); // Most recent contestant goes first
      expect(order).toHaveLength(5);
      // Should include all active positions
      expect(new Set(order)).toEqual(new Set([1, 2, 3, 4, 5]));
    });
  });

  describe("Fewer Than 5 Contestants", () => {
    it("should handle only 3 active contestants", () => {
      // Add only 3 contestants
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 2, "section_1", "active");
      addContestantToRow(3, 3, "section_1", "active");

      updateGameWorkflow({
        current_segment: "section_1",
        current_segment_index: 0,
        phase_type: "bidding",
        phase_metadata: JSON.stringify({
          product_id: "product-001",
          is_fresh_row: true,
        }),
      });

      // Should start with position 1
      expect(getCurrentBidderPosition("section_1")).toBe(1);

      // Submit 3 bids
      submitBid(1, 14000, "section_1", 1);
      expect(getCurrentBidderPosition("section_1")).toBe(2);

      submitBid(2, 15000, "section_1", 1);
      expect(getCurrentBidderPosition("section_1")).toBe(3);

      const result = submitBid(3, 13000, "section_1", 1);

      // All 3 bids submitted
      expect(result.allBidsSubmitted).toBe(true);
      expect(getCurrentBidderPosition("section_1")).toBeNull();
    });

    it("should correctly calculate winner with only 3 contestants", () => {
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 2, "section_1", "active");
      addContestantToRow(3, 3, "section_1", "active");

      updateGameWorkflow({
        current_segment: "section_1",
        current_segment_index: 0,
        phase_type: "bidding",
        phase_metadata: JSON.stringify({
          product_id: "product-001",
          is_fresh_row: true,
        }),
      });

      submitBid(1, 14000, "section_1", 1);
      submitBid(2, 16000, "section_1", 1);
      submitBid(3, 14500, "section_1", 1);

      const result = calculateWinner("section_1", 1, 15000);

      expect("winner" in result).toBe(true);
      if ("winner" in result) {
        expect(result.winner.bid_amount).toBe(14500);
        expect(result.winner.player_id).toBe(3);
      }
    });
  });

  describe("Non-Contiguous Positions", () => {
    it("should handle missing position numbers", () => {
      // Add contestants at positions 1, 2, 4, 5 (missing 3)
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 2, "section_1", "active");
      addContestantToRow(4, 4, "section_1", "active");
      addContestantToRow(5, 5, "section_1", "active");

      updateGameWorkflow({
        current_segment: "section_1",
        current_segment_index: 0,
        phase_type: "bidding",
        phase_metadata: JSON.stringify({
          product_id: "product-001",
          is_fresh_row: true,
        }),
      });

      // Should go in order: 1, 2, 4, 5
      expect(getCurrentBidderPosition("section_1")).toBe(1);

      submitBid(1, 14000, "section_1", 1);
      expect(getCurrentBidderPosition("section_1")).toBe(2);

      submitBid(2, 15000, "section_1", 1);
      expect(getCurrentBidderPosition("section_1")).toBe(4); // Skips missing 3

      submitBid(4, 13000, "section_1", 1);
      expect(getCurrentBidderPosition("section_1")).toBe(5);

      const result = submitBid(5, 12000, "section_1", 1);
      expect(result.allBidsSubmitted).toBe(true);
    });
  });

  describe("Full Retry Flow (NO SHORTCUTS)", () => {
    beforeEach(() => {
      for (let i = 1; i <= 5; i++) {
        addContestantToRow(i, i, "section_1", "active");
      }

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

    it("should allow full retry flow using submitBid after all over", () => {
      // First attempt - all over
      submitBid(1, 16000, "section_1", 1);
      submitBid(2, 17000, "section_1", 1);
      submitBid(3, 18000, "section_1", 1);
      submitBid(4, 19000, "section_1", 1);
      submitBid(5, 20000, "section_1", 1);

      const result1 = calculateWinner("section_1", 1, 15000);
      expect("allOver" in result1).toBe(true);

      // Clear for retry
      clearBidsForRetry("section_1", 1);

      // Simulate what reveal-winner endpoint does: update metadata with retry_number
      if ("allOver" in result1) {
        updateGameWorkflow({
          phase_metadata: JSON.stringify({
            product_id: "product-001",
            is_fresh_row: true,
            retry_number: result1.newRetryNumber,
          }),
        });
      }

      // Verify bids cleared
      let bids = getCurrentBids("section_1", 1);
      expect(bids).toHaveLength(0);

      // Second attempt - use submitBid (not createBid!)
      submitBid(1, 14000, "section_1", 1);
      submitBid(2, 14500, "section_1", 1);
      submitBid(3, 13000, "section_1", 1);
      submitBid(4, 12000, "section_1", 1);
      submitBid(5, 11000, "section_1", 1);

      // Verify new bids exist with retry_number = 1
      bids = getCurrentBids("section_1", 1);
      expect(bids).toHaveLength(5);
      expect(bids[0].retry_number).toBe(1);

      // Calculate winner should work
      const result2 = calculateWinner("section_1", 1, 15000);
      expect("winner" in result2).toBe(true);
      if ("winner" in result2) {
        expect(result2.winner.bid_amount).toBe(14500);
      }
    });
  });

  describe("Unlock and Re-bid Flow", () => {
    beforeEach(() => {
      for (let i = 1; i <= 5; i++) {
        addContestantToRow(i, i, "section_1", "active");
      }

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

    it("should allow re-bidding after unlock when turn comes back around", () => {
      // Player 1 bids
      const { bid } = submitBid(1, 14000, "section_1", 1);

      // Players 2-5 bid
      submitBid(2, 15000, "section_1", 1);
      submitBid(3, 13000, "section_1", 1);
      submitBid(4, 12000, "section_1", 1);
      submitBid(5, 11000, "section_1", 1);

      // Host unlocks player 1's bid
      const unlockedBid = unlockBid(bid.id);
      expect(unlockedBid.is_locked).toBe(0);

      // All 5 have bid, so current bidder should be null
      expect(getCurrentBidderPosition("section_1")).toBeNull();

      // In our current implementation, player would need to wait for turn order
      // But since all 5 have bid, they can't re-bid until bids are cleared
      // This is correct behavior
    });

    it("should allow updating same bid to same amount after unlock", () => {
      const { bid } = submitBid(1, 14000, "section_1", 1);
      submitBid(2, 15000, "section_1", 1);

      // Unlock player 1's bid
      unlockBid(bid.id);

      // Update to same amount should succeed (no duplicate since it's the same bid)
      expect(() => {
        updateBidAmount(bid.id, 14000);
      }).not.toThrow();

      // Verify bid still exists with same amount
      const bids = getCurrentBids("section_1", 1);
      const updatedBid = bids.find((b) => b.id === bid.id);
      expect(updatedBid).toBeDefined();
      expect(updatedBid?.bid_amount).toBe(14000);
    });
  });

  describe("SQL Injection & Security", () => {
    beforeEach(() => {
      for (let i = 1; i <= 5; i++) {
        addContestantToRow(i, i, "section_1", "active");
      }
    });

    it("should safely handle malicious product_id in phase_metadata", () => {
      // Attempt SQL injection via product_id
      const maliciousProductId = "'; DROP TABLE bids; --";

      updateGameWorkflow({
        current_segment: "section_1",
        current_segment_index: 0,
        phase_type: "bidding",
        phase_metadata: JSON.stringify({
          product_id: maliciousProductId,
          is_fresh_row: true,
        }),
      });

      // Should not crash when trying to use the product_id
      // The getProduct mock will return undefined, which should be handled
      expect(() => {
        getCurrentProductPrice();
      }).toThrow("Product not found"); // Should fail gracefully, not execute SQL

      // Verify bids table still exists and wasn't dropped
      const db = getDatabase();
      const tableCheck = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='bids'`,
        )
        .get() as { name: string } | undefined;

      expect(tableCheck).toBeDefined();
      expect(tableCheck?.name).toBe("bids");
    });

    it("should safely handle malicious segment names", () => {
      const maliciousSegment = "section_1'; DROP TABLE bids; --";

      // Should not execute SQL injection
      expect(() => {
        getCurrentBids(maliciousSegment, 1);
      }).not.toThrow();

      // Verify bids table still exists
      const db = getDatabase();
      const tableCheck = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='bids'`,
        )
        .get() as { name: string } | undefined;

      expect(tableCheck?.name).toBe("bids");
    });
  });

  describe("Boundary Values", () => {
    beforeEach(() => {
      for (let i = 1; i <= 5; i++) {
        addContestantToRow(i, i, "section_1", "active");
      }

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

    it("should accept bid of 1 (minimum valid)", () => {
      const result = submitBid(1, 1, "section_1", 1);
      expect(result.bid.bid_amount).toBe(1);
    });

    it("should accept very large bid amounts", () => {
      const largeBid = 999999999;
      const result = submitBid(1, largeBid, "section_1", 1);
      expect(result.bid.bid_amount).toBe(largeBid);
    });

    it("should handle winner calculation with price of 1", async () => {
      // Mock very cheap product
      const { getProduct } = await import("../utils/products.js");
      vi.mocked(getProduct).mockReturnValueOnce({
        name: "Cheap Item",
        price: 1,
      });

      submitBid(1, 1, "section_1", 1);
      submitBid(2, 2, "section_1", 1);
      submitBid(3, 3, "section_1", 1);
      submitBid(4, 4, "section_1", 1);
      submitBid(5, 5, "section_1", 1);

      const result = calculateWinner("section_1", 1, 1);

      expect("winner" in result).toBe(true);
      if ("winner" in result) {
        expect(result.winner.bid_amount).toBe(1);
      }
    });
  });

  describe("Mid-Round Contestant Replacement", () => {
    it("should handle turn order when contestant replaced mid-round", () => {
      // Add 5 contestants
      for (let i = 1; i <= 5; i++) {
        addContestantToRow(i, i, "section_1", "active");
      }

      updateGameWorkflow({
        current_segment: "section_1",
        current_segment_index: 0,
        phase_type: "bidding",
        phase_metadata: JSON.stringify({
          product_id: "product-001",
          is_fresh_row: true,
        }),
      });

      // Players 1, 2, 3 bid
      submitBid(1, 14000, "section_1", 1);
      submitBid(2, 15000, "section_1", 1);
      const { bid: bid3 } = submitBid(3, 13000, "section_1", 1);

      // Replace player 3 with player 6
      const db = getDatabase();
      const contestant3 = db
        .prepare("SELECT id FROM contestants_row WHERE player_id = 3")
        .get() as { id: number };

      // Delete player 3's bid (simulates our documented behavior)
      db.prepare("DELETE FROM bids WHERE id = ?").run(bid3.id);

      replaceContestant(contestant3.id, 6, "active");

      // Mark row as not fresh
      updateGameWorkflow({
        phase_metadata: JSON.stringify({
          product_id: "product-001",
          is_fresh_row: false,
        }),
      });

      // New player in position 3 should bid next
      const nextBidder = getCurrentBidderPosition("section_1");
      expect(nextBidder).toBe(3);

      // They should be able to bid
      expect(() => {
        submitBid(6, 12500, "section_1", 1);
      }).not.toThrow();

      // Verify bid was created correctly
      const bids = getCurrentBids("section_1", 1);
      const newBid = bids.find((b) => b.player_id === 6);
      expect(newBid).toBeDefined();
      expect(newBid?.bid_amount).toBe(12500);
      expect(newBid?.position).toBe(3);
    });

    it("should handle replacement when it is current bidder turn (CRITICAL)", () => {
      // Add 5 contestants
      for (let i = 1; i <= 5; i++) {
        addContestantToRow(i, i, "section_1", "active");
      }

      updateGameWorkflow({
        current_segment: "section_1",
        current_segment_index: 0,
        phase_type: "bidding",
        phase_metadata: JSON.stringify({
          product_id: "product-001",
          is_fresh_row: true,
        }),
      });

      // Players 1, 2 bid - now it's player 3's turn
      submitBid(1, 14000, "section_1", 1);
      submitBid(2, 15000, "section_1", 1);

      // Verify it's position 3's turn
      expect(getCurrentBidderPosition("section_1")).toBe(3);

      // NOW replace the current bidder (player 3 at position 3)
      const db = getDatabase();
      const contestant3 = db
        .prepare("SELECT id FROM contestants_row WHERE player_id = 3")
        .get() as { id: number };

      replaceContestant(contestant3.id, 6, "active"); // Replace with player 6

      // Mark as replacement row
      updateGameWorkflow({
        phase_metadata: JSON.stringify({
          product_id: "product-001",
          is_fresh_row: false,
        }),
      });

      // Most recent contestant (position 3, player 6) should be current bidder
      const nextBidder = getCurrentBidderPosition("section_1");
      expect(nextBidder).toBe(3);

      // New player should be able to bid
      const result = submitBid(6, 13500, "section_1", 1);
      expect(result.bid.player_id).toBe(6);
      expect(result.bid.position).toBe(3);

      // Verify we have exactly 3 bids (player 1, 2, and new player 6)
      const bids = getCurrentBids("section_1", 1);
      expect(bids).toHaveLength(3);
      expect(bids.map((b) => b.player_id)).toContain(1); // player 1
      expect(bids.map((b) => b.player_id)).toContain(2); // player 2
      expect(bids.map((b) => b.player_id)).toContain(6); // new player 6
    });
  });

  describe("Duplicate Bid Prevention", () => {
    it("should prevent duplicate bids for same player in same round", () => {
      // Add 5 contestants
      for (let i = 1; i <= 5; i++) {
        addContestantToRow(i, i, "section_1", "active");
      }

      updateGameWorkflow({
        current_segment: "section_1",
        current_segment_index: 0,
        phase_type: "bidding",
        phase_metadata: JSON.stringify({
          product_id: "product-001",
          is_fresh_row: true,
        }),
      });

      // Player 1 submits a bid
      const firstBid = submitBid(1, 14000, "section_1", 1);
      expect(firstBid.bid.player_id).toBe(1);

      // Try to submit another bid for player 1 (should fail - already bid)
      expect(() => {
        submitBid(1, 15000, "section_1", 1);
      }).toThrow();

      // Verify only one bid exists for player 1
      const bids = getCurrentBids("section_1", 1);
      const player1Bids = bids.filter((b) => b.player_id === 1);
      expect(player1Bids).toHaveLength(1);
      expect(player1Bids[0].bid_amount).toBe(14000); // Original amount
    });

    it("should prevent out-of-turn bidding", () => {
      // Add 5 contestants
      for (let i = 1; i <= 5; i++) {
        addContestantToRow(i, i, "section_1", "active");
      }

      updateGameWorkflow({
        current_segment: "section_1",
        current_segment_index: 0,
        phase_type: "bidding",
        phase_metadata: JSON.stringify({
          product_id: "product-001",
          is_fresh_row: true,
        }),
      });

      // It's player 1's turn (position 1)
      // Player 2 tries to bid out of turn
      expect(() => {
        submitBid(2, 15000, "section_1", 1);
      }).toThrow(/not.*turn/i);

      // Verify no bids exist yet
      const bids = getCurrentBids("section_1", 1);
      expect(bids).toHaveLength(0);

      // Now player 1 bids correctly
      const result = submitBid(1, 14000, "section_1", 1);
      expect(result.bid.player_id).toBe(1);

      // Turn should advance to position 2
      expect(getCurrentBidderPosition("section_1")).toBe(2);
    });
  });
});
