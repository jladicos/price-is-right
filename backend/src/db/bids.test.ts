import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createBid,
  getBidsForRound,
  getBidById,
  updateBid,
  unlockBid,
  markWinner,
  deleteBidsForRound,
  checkDuplicateBid,
  getCurrentRetryNumber,
  getBidByPlayerForRound,
} from "./bids.js";
import { getDatabase } from "./connection.js";
import { setupTestDatabase, cleanupTestDatabase } from "./test-helper.js";
import { addContestantToRow } from "./contestants.js";

describe("Bids Database Functions", () => {
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

    // Add contestants to row for position tracking
    for (let i = 1; i <= 5; i++) {
      addContestantToRow(i, i, "section_1", "active");
    }
  });

  afterEach(() => {
    cleanupTestDatabase();
  });

  describe("createBid", () => {
    it("should create a new bid", () => {
      const bid = createBid(1, "product-001", 1, "section_1", 1200, 0);

      expect(bid.player_id).toBe(1);
      expect(bid.product_id).toBe("product-001");
      expect(bid.round_number).toBe(1);
      expect(bid.game_segment).toBe("section_1");
      expect(bid.bid_amount).toBe(1200);
      expect(bid.retry_number).toBe(0);
      expect(bid.id).toBeGreaterThan(0);
    });

    it("should set default values correctly", () => {
      const bid = createBid(1, "product-001", 1, "section_1", 1200, 0);

      expect(bid.is_locked).toBe(1);
      expect(bid.is_winner).toBe(0);
    });

    it("should set timestamp", () => {
      const bid = createBid(1, "product-001", 1, "section_1", 1200, 0);

      expect(bid.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it("should auto-increment id", () => {
      const bid1 = createBid(1, "product-001", 1, "section_1", 1200, 0);
      const bid2 = createBid(2, "product-001", 1, "section_1", 1500, 0);

      expect(bid1.id).toBeDefined();
      expect(bid2.id).toBeDefined();
      expect(bid2.id).toBeGreaterThan(bid1.id);
    });

    it("should allow multiple bids in same round", () => {
      const bid1 = createBid(1, "product-001", 1, "section_1", 1200, 0);
      const bid2 = createBid(2, "product-001", 1, "section_1", 1500, 0);
      const bid3 = createBid(3, "product-001", 1, "section_1", 1800, 0);

      expect(bid1.id).not.toBe(bid2.id);
      expect(bid2.id).not.toBe(bid3.id);
    });

    it("should allow same player to bid in different rounds", () => {
      const bid1 = createBid(1, "product-001", 1, "section_1", 1200, 0);
      const bid2 = createBid(1, "product-002", 2, "section_1", 1500, 0);

      expect(bid1.round_number).toBe(1);
      expect(bid2.round_number).toBe(2);
    });

    it("should allow same player to bid with different retry numbers", () => {
      const bid1 = createBid(1, "product-001", 1, "section_1", 1200, 0);
      const bid2 = createBid(1, "product-001", 1, "section_1", 1500, 1);

      expect(bid1.retry_number).toBe(0);
      expect(bid2.retry_number).toBe(1);
    });

    it("should enforce foreign key constraint on player_id", () => {
      expect(() => {
        createBid(999, "product-001", 1, "section_1", 1200, 0);
      }).toThrow();
    });

    it("should enforce unique constraint on bid amount within same round", () => {
      // First bid succeeds
      createBid(1, "product-001", 1, "section_1", 1200, 0);

      // Second bid with same amount in same round/segment/retry should fail
      expect(() => {
        createBid(2, "product-001", 1, "section_1", 1200, 0);
      }).toThrow("Bid amount already taken");
    });

    it("should allow same bid amount in different rounds", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      // Same amount in different round should succeed
      const bid2 = createBid(2, "product-002", 2, "section_1", 1200, 0);
      expect(bid2.bid_amount).toBe(1200);
    });

    it("should allow same bid amount in different retry numbers", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      // Same amount in different retry should succeed (after "all over")
      const bid2 = createBid(2, "product-001", 1, "section_1", 1200, 1);
      expect(bid2.bid_amount).toBe(1200);
    });

    it("should allow same bid amount in different segments", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      // Same amount in different segment should succeed
      const bid2 = createBid(2, "product-002", 1, "section_2", 1200, 0);
      expect(bid2.bid_amount).toBe(1200);
    });

    it("should catch race condition via database constraint (direct INSERT)", () => {
      // This simulates a race condition where two requests pass the app-level
      // checkDuplicateBid() check but then both try to INSERT
      const db = getDatabase();

      // First insert succeeds
      db.prepare(
        `INSERT INTO bids (player_id, product_id, round_number, game_segment, bid_amount, retry_number)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(1, "product-001", 1, "section_1", 999, 0);

      // Second insert with same amount should fail at database level
      expect(() => {
        db.prepare(
          `INSERT INTO bids (player_id, product_id, round_number, game_segment, bid_amount, retry_number)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(2, "product-001", 1, "section_1", 999, 0);
      }).toThrow(/UNIQUE constraint failed/);
    });
  });

  describe("getBidsForRound", () => {
    it("should return empty array when no bids exist", () => {
      const bids = getBidsForRound("section_1", 1);
      expect(bids).toEqual([]);
    });

    it("should return bids for specified round", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      createBid(2, "product-001", 1, "section_1", 1500, 0);
      createBid(3, "product-002", 2, "section_1", 1800, 0); // Different round

      const bids = getBidsForRound("section_1", 1);

      expect(bids).toHaveLength(2);
      expect(bids[0].round_number).toBe(1);
      expect(bids[1].round_number).toBe(1);
    });

    it("should include player information", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);

      const bids = getBidsForRound("section_1", 1);

      expect(bids[0].first_name).toBe("Player1");
      expect(bids[0].last_name).toBe("Last1");
      expect(bids[0].photo_filename).toBeDefined();
    });

    it("should include contestant position", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);

      const bids = getBidsForRound("section_1", 1);

      expect(bids[0].position).toBe(1);
    });

    it("should return bids ordered by creation time", () => {
      createBid(3, "product-001", 1, "section_1", 1800, 0);
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      createBid(2, "product-001", 1, "section_1", 1500, 0);

      const bids = getBidsForRound("section_1", 1);

      expect(bids[0].player_id).toBe(3);
      expect(bids[1].player_id).toBe(1);
      expect(bids[2].player_id).toBe(2);
    });

    it("should only return bids for current retry number", () => {
      // First attempt (retry 0)
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      createBid(2, "product-001", 1, "section_1", 1500, 0);

      // Second attempt (retry 1) - "all over" scenario
      createBid(1, "product-001", 1, "section_1", 900, 1);
      createBid(2, "product-001", 1, "section_1", 950, 1);

      const bids = getBidsForRound("section_1", 1);

      expect(bids).toHaveLength(2);
      expect(bids[0].retry_number).toBe(1);
      expect(bids[1].retry_number).toBe(1);
      expect(bids[0].bid_amount).toBe(900);
      expect(bids[1].bid_amount).toBe(950);
    });

    it("should filter by game segment", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      createBid(2, "product-002", 1, "section_2", 1500, 0);

      const bids1 = getBidsForRound("section_1", 1);
      const bids2 = getBidsForRound("section_2", 1);

      expect(bids1).toHaveLength(1);
      expect(bids2).toHaveLength(1);
      expect(bids1[0].game_segment).toBe("section_1");
      expect(bids2[0].game_segment).toBe("section_2");
    });
  });

  describe("getBidById", () => {
    it("should return bid when found", () => {
      const created = createBid(1, "product-001", 1, "section_1", 1200, 0);
      const found = getBidById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.bid_amount).toBe(1200);
    });

    it("should return undefined when not found", () => {
      const found = getBidById(999);
      expect(found).toBeUndefined();
    });
  });

  describe("updateBid", () => {
    it("should update bid amount", () => {
      const bid = createBid(1, "product-001", 1, "section_1", 1200, 0);

      const updated = updateBid(bid.id, { bid_amount: 1500 });

      expect(updated.bid_amount).toBe(1500);
      expect(updated.id).toBe(bid.id);
    });

    it("should update is_locked", () => {
      const bid = createBid(1, "product-001", 1, "section_1", 1200, 0);

      const updated = updateBid(bid.id, { is_locked: 0 });

      expect(updated.is_locked).toBe(0);
    });

    it("should update is_winner", () => {
      const bid = createBid(1, "product-001", 1, "section_1", 1200, 0);

      const updated = updateBid(bid.id, { is_winner: 1 });

      expect(updated.is_winner).toBe(1);
    });

    it("should update multiple fields at once", () => {
      const bid = createBid(1, "product-001", 1, "section_1", 1200, 0);

      const updated = updateBid(bid.id, {
        bid_amount: 1500,
        is_locked: 0,
        is_winner: 1,
      });

      expect(updated.bid_amount).toBe(1500);
      expect(updated.is_locked).toBe(0);
      expect(updated.is_winner).toBe(1);
    });

    it("should throw error when no fields to update", () => {
      const bid = createBid(1, "product-001", 1, "section_1", 1200, 0);

      expect(() => {
        updateBid(bid.id, {});
      }).toThrow("No fields to update");
    });

    it("should preserve other fields when updating", () => {
      const bid = createBid(1, "product-001", 1, "section_1", 1200, 0);
      const originalCreatedAt = bid.created_at;

      const updated = updateBid(bid.id, { bid_amount: 1500 });

      expect(updated.player_id).toBe(bid.player_id);
      expect(updated.product_id).toBe(bid.product_id);
      expect(updated.created_at).toBe(originalCreatedAt);
    });
  });

  describe("unlockBid", () => {
    it("should set is_locked to 0", () => {
      const bid = createBid(1, "product-001", 1, "section_1", 1200, 0);
      expect(bid.is_locked).toBe(1);

      const unlocked = unlockBid(bid.id);

      expect(unlocked.is_locked).toBe(0);
    });

    it("should preserve other fields", () => {
      const bid = createBid(1, "product-001", 1, "section_1", 1200, 0);

      const unlocked = unlockBid(bid.id);

      expect(unlocked.bid_amount).toBe(1200);
      expect(unlocked.player_id).toBe(1);
      expect(unlocked.is_winner).toBe(0);
    });
  });

  describe("markWinner", () => {
    it("should set is_winner to 1", () => {
      const bid = createBid(1, "product-001", 1, "section_1", 1200, 0);
      expect(bid.is_winner).toBe(0);

      const winner = markWinner(bid.id);

      expect(winner.is_winner).toBe(1);
    });

    it("should preserve other fields", () => {
      const bid = createBid(1, "product-001", 1, "section_1", 1200, 0);

      const winner = markWinner(bid.id);

      expect(winner.bid_amount).toBe(1200);
      expect(winner.player_id).toBe(1);
      expect(winner.is_locked).toBe(1);
    });
  });

  describe("deleteBidsForRound", () => {
    it("should delete bids for specified round and retry", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      createBid(2, "product-001", 1, "section_1", 1500, 0);

      deleteBidsForRound("section_1", 1, 0);

      const bids = getBidsForRound("section_1", 1);
      expect(bids).toHaveLength(0);
    });

    it("should not delete bids from different retry", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      createBid(2, "product-001", 1, "section_1", 1500, 1); // retry 1

      deleteBidsForRound("section_1", 1, 0);

      const bid = getBidById(2);
      expect(bid).toBeDefined();
      expect(bid?.retry_number).toBe(1);
    });

    it("should not delete bids from different round", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      createBid(2, "product-002", 2, "section_1", 1500, 0);

      deleteBidsForRound("section_1", 1, 0);

      const bid = getBidById(2);
      expect(bid).toBeDefined();
      expect(bid?.round_number).toBe(2);
    });

    it("should not delete bids from different segment", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      createBid(2, "product-001", 1, "section_2", 1500, 0);

      deleteBidsForRound("section_1", 1, 0);

      const bid = getBidById(2);
      expect(bid).toBeDefined();
      expect(bid?.game_segment).toBe("section_2");
    });
  });

  describe("checkDuplicateBid", () => {
    it("should return false when no duplicate exists", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);

      const isDuplicate = checkDuplicateBid("section_1", 1, 0, 1500);

      expect(isDuplicate).toBe(false);
    });

    it("should return true when duplicate exists", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);

      const isDuplicate = checkDuplicateBid("section_1", 1, 0, 1200);

      expect(isDuplicate).toBe(true);
    });

    it("should not detect duplicate from different round", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);

      const isDuplicate = checkDuplicateBid("section_1", 2, 0, 1200);

      expect(isDuplicate).toBe(false);
    });

    it("should not detect duplicate from different retry", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);

      const isDuplicate = checkDuplicateBid("section_1", 1, 1, 1200);

      expect(isDuplicate).toBe(false);
    });

    it("should not detect duplicate from different segment", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);

      const isDuplicate = checkDuplicateBid("section_2", 1, 0, 1200);

      expect(isDuplicate).toBe(false);
    });
  });

  describe("getCurrentRetryNumber", () => {
    it("should return 0 when no bids exist", () => {
      const retry = getCurrentRetryNumber("section_1", 1);
      expect(retry).toBe(0);
    });

    it("should return 0 for first attempt", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);

      const retry = getCurrentRetryNumber("section_1", 1);
      expect(retry).toBe(0);
    });

    it("should return highest retry number", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      createBid(2, "product-001", 1, "section_1", 1500, 1);
      createBid(3, "product-001", 1, "section_1", 1800, 2);

      const retry = getCurrentRetryNumber("section_1", 1);
      expect(retry).toBe(2);
    });

    it("should filter by segment", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      createBid(2, "product-001", 1, "section_2", 1500, 3);

      const retry = getCurrentRetryNumber("section_1", 1);
      expect(retry).toBe(0);
    });

    it("should filter by round number", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      createBid(2, "product-002", 2, "section_1", 1500, 3);

      const retry = getCurrentRetryNumber("section_1", 1);
      expect(retry).toBe(0);
    });
  });

  describe("getBidByPlayerForRound", () => {
    it("should return player's bid for current round", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      createBid(2, "product-001", 1, "section_1", 1500, 0);

      const bid = getBidByPlayerForRound(1, "section_1", 1);

      expect(bid).toBeDefined();
      expect(bid?.player_id).toBe(1);
      expect(bid?.bid_amount).toBe(1200);
    });

    it("should return undefined when player has not bid", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);

      const bid = getBidByPlayerForRound(2, "section_1", 1);

      expect(bid).toBeUndefined();
    });

    it("should return bid from current retry only", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      createBid(1, "product-001", 1, "section_1", 900, 1);

      const bid = getBidByPlayerForRound(1, "section_1", 1);

      expect(bid?.retry_number).toBe(1);
      expect(bid?.bid_amount).toBe(900);
    });

    it("should filter by round number", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      createBid(1, "product-002", 2, "section_1", 1500, 0);

      const bid = getBidByPlayerForRound(1, "section_1", 2);

      expect(bid?.round_number).toBe(2);
      expect(bid?.bid_amount).toBe(1500);
    });

    it("should filter by segment", () => {
      createBid(1, "product-001", 1, "section_1", 1200, 0);
      createBid(1, "product-001", 1, "section_2", 1500, 0);

      const bid = getBidByPlayerForRound(1, "section_2", 1);

      expect(bid?.game_segment).toBe("section_2");
      expect(bid?.bid_amount).toBe(1500);
    });
  });

  describe("REGRESSION: Cross-Segment Bid Tracking (Bug Fix)", () => {
    /**
     * CRITICAL REGRESSION TEST
     * Bug: Duplicate bids when player exists in multiple segments
     * Symptom: After 3 players bid in section 2, currentBids array had 5 entries
     * Root Cause: getBidsForRound() LEFT JOIN didn't filter by game_segment
     * Fix: Added "AND c.game_segment = b.game_segment" to JOIN condition
     */
    it("should not duplicate bids when player exists in multiple segments", () => {
      const db = getDatabase();

      // Player 1 is in both section_1 AND section_2
      // This happens when a player wins in section_1 and advances to section_2
      const player1Row = db
        .prepare(
          `INSERT INTO players (first_name, last_name, access_code, role)
           VALUES (?, ?, ?, ?)`,
        )
        .run("CrossSegment", "Player1", "CROSS1", "player");
      const player1Id = player1Row.lastInsertRowid as number;

      // Add player1 to section_1 (won status)
      db.prepare(
        `INSERT INTO contestants_row (player_id, game_segment, position, status)
         VALUES (?, ?, ?, ?)`,
      ).run(player1Id, "section_1", 1, "won");

      // Add player1 to section_2 (active - they won section_1 and moved to section_2)
      db.prepare(
        `INSERT INTO contestants_row (player_id, game_segment, position, status)
         VALUES (?, ?, ?, ?)`,
      ).run(player1Id, "section_2", 2, "active");

      // Player 2 and 3 only in section_2
      addContestantToRow(2, 3, "section_2", "active");
      addContestantToRow(3, 4, "section_2", "active");

      // Submit bids for section_2, round 1
      createBid(player1Id, "product-002", 1, "section_2", 1000, 0);
      createBid(2, "product-002", 1, "section_2", 1100, 0);
      createBid(3, "product-002", 1, "section_2", 1200, 0);

      // Get bids for section_2
      const bids = getBidsForRound("section_2", 1, 0);

      // CRITICAL: Should only have 3 bids, not 4 or 5 from duplicate joins
      expect(bids).toHaveLength(3);

      // Player 1 should appear exactly once
      const player1Bids = bids.filter((b) => b.player_id === player1Id);
      expect(player1Bids).toHaveLength(1);

      // Verify each player appears exactly once
      const playerIds = bids.map((b) => b.player_id);
      const uniquePlayerIds = new Set(playerIds);
      expect(uniquePlayerIds.size).toBe(3); // All unique
    });

    it("should mark winner in correct segment when player in multiple segments", () => {
      const db = getDatabase();

      // Create player who will be in both segments
      const playerRow = db
        .prepare(
          `INSERT INTO players (first_name, last_name, access_code, role)
           VALUES (?, ?, ?, ?)`,
        )
        .run("MultiSegment", "Winner", "MULTI1", "player");
      const playerId = playerRow.lastInsertRowid as number;

      // Player in both segments
      db.prepare(
        `INSERT INTO contestants_row (player_id, game_segment, position, status)
         VALUES (?, ?, ?, ?)`,
      ).run(playerId, "section_1", 1, "won");
      db.prepare(
        `INSERT INTO contestants_row (player_id, game_segment, position, status)
         VALUES (?, ?, ?, ?)`,
      ).run(playerId, "section_2", 2, "active");

      // Create bids in both segments
      createBid(playerId, "product-001", 1, "section_1", 1500, 0);
      createBid(playerId, "product-002", 1, "section_2", 2000, 0);

      // Mark as winner in section_2
      const section2Bid = getBidByPlayerForRound(playerId, "section_2", 1);
      expect(section2Bid).toBeDefined();

      markWinner(section2Bid!.id);

      // Verify section_1 bid is NOT marked as winner
      const section1Bid = getBidByPlayerForRound(playerId, "section_1", 1);
      expect(section1Bid).toBeDefined();
      expect(section1Bid!.is_winner).toBe(0); // Should NOT be winner

      // Verify section_2 bid IS marked as winner
      const updatedSection2Bid = getBidByPlayerForRound(
        playerId,
        "section_2",
        1,
      );
      expect(updatedSection2Bid!.is_winner).toBe(1); // Should be winner
    });

    it("should handle getBidsForRound when same player in multiple segments with same round number", () => {
      const db = getDatabase();

      // Create player in both segments
      const playerRow = db
        .prepare(
          `INSERT INTO players (first_name, last_name, access_code, role)
           VALUES (?, ?, ?, ?)`,
        )
        .run("Overlap", "Player", "OVER1", "player");
      const playerId = playerRow.lastInsertRowid as number;

      addContestantToRow(playerId, 1, "section_1", "won");
      addContestantToRow(playerId, 2, "section_2", "active");

      // Create bids in both segments for round 1
      createBid(playerId, "product-001", 1, "section_1", 1500, 0);
      createBid(playerId, "product-002", 1, "section_2", 2500, 0);

      // Add other players to section_2
      createBid(2, "product-002", 1, "section_2", 2000, 0);
      addContestantToRow(2, 3, "section_2", "active");

      createBid(3, "product-002", 1, "section_2", 2200, 0);
      addContestantToRow(3, 4, "section_2", "active");

      // Get bids for section_2, round 1
      const section2Bids = getBidsForRound("section_2", 1, 0);

      // Should only return section_2 bids
      expect(section2Bids).toHaveLength(3);
      section2Bids.forEach((bid) => {
        expect(bid.game_segment).toBe("section_2");
      });

      // Verify the player's bid is the section_2 one, not section_1
      const playerBid = section2Bids.find((b) => b.player_id === playerId);
      expect(playerBid).toBeDefined();
      expect(playerBid!.bid_amount).toBe(2500); // section_2 bid
      expect(playerBid!.bid_amount).not.toBe(1500); // NOT section_1 bid

      // Get bids for section_1, round 1
      const section1Bids = getBidsForRound("section_1", 1, 0);

      // Should only have the one bid from section_1
      expect(section1Bids.length).toBeGreaterThan(0);
      const section1PlayerBid = section1Bids.find(
        (b) => b.player_id === playerId,
      );
      if (section1PlayerBid) {
        expect(section1PlayerBid.bid_amount).toBe(1500); // section_1 bid
      }
    });

    it("should properly join contestant data only from matching segment", () => {
      const db = getDatabase();

      // Create player in both segments with different positions
      const playerRow = db
        .prepare(
          `INSERT INTO players (first_name, last_name, access_code, role)
           VALUES (?, ?, ?, ?)`,
        )
        .run("Position", "Test", "POS1", "player");
      const playerId = playerRow.lastInsertRowid as number;

      // Add to section_1 at position 1
      addContestantToRow(playerId, 1, "section_1", "won");

      // Add to section_2 at position 4
      addContestantToRow(playerId, 4, "section_2", "active");

      // Create bid in section_2
      createBid(playerId, "product-002", 1, "section_2", 2500, 0);

      // Get bids for section_2
      const section2Bids = getBidsForRound("section_2", 1, 0);

      const playerBid = section2Bids.find((b) => b.player_id === playerId);
      expect(playerBid).toBeDefined();

      // CRITICAL: Should have position from section_2 (4), not section_1 (1)
      expect(playerBid!.position).toBe(4);
      expect(playerBid!.position).not.toBe(1);
    });
  });
});
