import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  insertShowcaseBid,
  getShowcaseBids,
  getShowcaseState,
  getFinaleWinner,
  updateShowcaseBid,
  unlockShowcaseBid,
  updateFinaleState,
  setFinaleWinner,
  incrementRetryNumber,
  getPlayerBidForRetry,
  getShowcaseBidById,
} from "./showcase.js";
import { getDatabase } from "./connection.js";
import { setupTestDatabase, cleanupTestDatabase } from "./test-helper.js";

describe("Showcase Database Functions", () => {
  beforeEach(() => {
    setupTestDatabase();

    // Create test players
    const db = getDatabase();
    for (let i = 1; i <= 3; i++) {
      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, role, photo_filename)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(`Player${i}`, `Last${i}`, `CODE${i}`, "player", `player${i}.jpg`);
    }
  });

  afterEach(() => {
    cleanupTestDatabase();
  });

  describe("insertShowcaseBid", () => {
    it("should insert a new showcase bid", () => {
      const bid = insertShowcaseBid({
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 25000,
        retry_number: 0,
      });

      expect(bid.id).toBeGreaterThan(0);
      expect(bid.game_id).toBe(1);
      expect(bid.player_id).toBe(1);
      expect(bid.showcase_number).toBe(1);
      expect(bid.bid_amount).toBe(25000);
      expect(bid.retry_number).toBe(0);
      expect(bid.locked).toBe(1); // Default locked
    });

    it("should set timestamps", () => {
      const bid = insertShowcaseBid({
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 25000,
        retry_number: 0,
      });

      expect(bid.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(bid.updated_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it("should allow both players to bid on different showcases", () => {
      const bid1 = insertShowcaseBid({
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 25000,
        retry_number: 0,
      });

      const bid2 = insertShowcaseBid({
        game_id: 1,
        player_id: 2,
        showcase_number: 2,
        bid_amount: 30000,
        retry_number: 0,
      });

      expect(bid1.showcase_number).toBe(1);
      expect(bid2.showcase_number).toBe(2);
    });

    it("should allow retry bids with incremented retry_number", () => {
      const bid1 = insertShowcaseBid({
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 25000,
        retry_number: 0,
      });

      const bid2 = insertShowcaseBid({
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 22000,
        retry_number: 1,
      });

      expect(bid1.retry_number).toBe(0);
      expect(bid2.retry_number).toBe(1);
    });
  });

  describe("getShowcaseBids", () => {
    it("should return bids for specific retry number", () => {
      // Create bids for retry 0
      insertShowcaseBid({
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 25000,
        retry_number: 0,
      });

      insertShowcaseBid({
        game_id: 1,
        player_id: 2,
        showcase_number: 2,
        bid_amount: 30000,
        retry_number: 0,
      });

      // Create bid for retry 1
      insertShowcaseBid({
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 22000,
        retry_number: 1,
      });

      const bidsRetry0 = getShowcaseBids(1, 0);
      const bidsRetry1 = getShowcaseBids(1, 1);

      expect(bidsRetry0).toHaveLength(2);
      expect(bidsRetry1).toHaveLength(1);
    });

    it("should include player information", () => {
      insertShowcaseBid({
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 25000,
        retry_number: 0,
      });

      const bids = getShowcaseBids(1, 0);

      expect(bids[0].first_name).toBe("Player1");
      expect(bids[0].last_name).toBe("Last1");
      expect(bids[0].photo_filename).toBe("player1.jpg");
    });

    it("should return empty array when no bids exist", () => {
      const bids = getShowcaseBids(1, 0);

      expect(bids).toEqual([]);
    });

    it("should order by created_at ascending", () => {
      const bid1 = insertShowcaseBid({
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 25000,
        retry_number: 0,
      });

      const bid2 = insertShowcaseBid({
        game_id: 1,
        player_id: 2,
        showcase_number: 2,
        bid_amount: 30000,
        retry_number: 0,
      });

      const bids = getShowcaseBids(1, 0);

      expect(bids[0].id).toBe(bid1.id);
      expect(bids[1].id).toBe(bid2.id);
    });
  });

  describe("getShowcaseState", () => {
    it("should return showcase state from game_workflow", () => {
      const db = getDatabase();

      // Update finale state
      db.prepare(
        `
        UPDATE game_workflow
        SET finale_player1_id = 1,
            finale_player2_id = 2,
            finale_player1_product_value = 15000,
            finale_player2_product_value = 20000,
            finale_player1_showcase = 2,
            finale_player2_showcase = 1,
            finale_retry_number = 0,
            finale_player1_passed = 1
        WHERE id = 1
      `,
      ).run();

      const state = getShowcaseState(1);

      expect(state).not.toBeNull();
      expect(state!.finale_player1_id).toBe(1);
      expect(state!.finale_player2_id).toBe(2);
      expect(state!.finale_player1_product_value).toBe(15000);
      expect(state!.finale_player2_product_value).toBe(20000);
      expect(state!.finale_player1_showcase).toBe(2);
      expect(state!.finale_player2_showcase).toBe(1);
      expect(state!.finale_retry_number).toBe(0);
      expect(state!.finale_player1_passed).toBe(1);
    });

    it("should return null values for unset fields", () => {
      const state = getShowcaseState(1);

      expect(state).not.toBeNull();
      expect(state!.finale_player1_id).toBeNull();
      expect(state!.finale_player2_id).toBeNull();
      expect(state!.finale_winner_id).toBeNull();
    });
  });

  describe("getFinaleWinner", () => {
    it("should return winner information when set", () => {
      const db = getDatabase();

      db.prepare(
        `
        UPDATE game_workflow
        SET finale_winner_id = 1,
            finale_bonus_won = 1
        WHERE id = 1
      `,
      ).run();

      const winner = getFinaleWinner(1);

      expect(winner).not.toBeNull();
      expect(winner!.winnerId).toBe(1);
      expect(winner!.bonusWon).toBe(true);
    });

    it("should return null when winner not determined", () => {
      const winner = getFinaleWinner(1);

      expect(winner).toBeNull();
    });

    it("should handle bonus_won = 0", () => {
      const db = getDatabase();

      db.prepare(
        `
        UPDATE game_workflow
        SET finale_winner_id = 1,
            finale_bonus_won = 0
        WHERE id = 1
      `,
      ).run();

      const winner = getFinaleWinner(1);

      expect(winner).not.toBeNull();
      expect(winner!.winnerId).toBe(1);
      expect(winner!.bonusWon).toBe(false);
    });
  });

  describe("updateShowcaseBid", () => {
    it("should update bid amount", () => {
      const bid = insertShowcaseBid({
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 25000,
        retry_number: 0,
      });

      updateShowcaseBid(bid.id, 22000);

      const updatedBid = getShowcaseBidById(bid.id);

      expect(updatedBid).not.toBeUndefined();
      expect(updatedBid!.bid_amount).toBe(22000);
    });

    it("should not throw error when updating", () => {
      const bid = insertShowcaseBid({
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 25000,
        retry_number: 0,
      });

      // Should not throw
      expect(() => {
        updateShowcaseBid(bid.id, 22000);
      }).not.toThrow();

      const updatedBid = getShowcaseBidById(bid.id);
      expect(updatedBid!.bid_amount).toBe(22000);
    });
  });

  describe("unlockShowcaseBid", () => {
    it("should unlock a bid", () => {
      const bid = insertShowcaseBid({
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 25000,
        retry_number: 0,
      });

      expect(bid.locked).toBe(1);

      unlockShowcaseBid(1, 1, 0);

      const updatedBid = getShowcaseBidById(bid.id);

      expect(updatedBid!.locked).toBe(0);
    });

    it("should unlock correct bid by game_id, player_id, and retry_number", () => {
      const bid1 = insertShowcaseBid({
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 25000,
        retry_number: 0,
      });

      const bid2 = insertShowcaseBid({
        game_id: 1,
        player_id: 2,
        showcase_number: 2,
        bid_amount: 30000,
        retry_number: 0,
      });

      unlockShowcaseBid(1, 1, 0);

      const updatedBid1 = getShowcaseBidById(bid1.id);
      const updatedBid2 = getShowcaseBidById(bid2.id);

      expect(updatedBid1!.locked).toBe(0);
      expect(updatedBid2!.locked).toBe(1); // Should remain locked
    });
  });

  describe("updateFinaleState", () => {
    it("should update single field", () => {
      updateFinaleState(1, { finale_player1_id: 1 });

      const state = getShowcaseState(1);

      expect(state!.finale_player1_id).toBe(1);
    });

    it("should update multiple fields", () => {
      updateFinaleState(1, {
        finale_player1_id: 1,
        finale_player2_id: 2,
        finale_player1_product_value: 15000,
        finale_player2_product_value: 20000,
      });

      const state = getShowcaseState(1);

      expect(state!.finale_player1_id).toBe(1);
      expect(state!.finale_player2_id).toBe(2);
      expect(state!.finale_player1_product_value).toBe(15000);
      expect(state!.finale_player2_product_value).toBe(20000);
    });

    it("should update showcase assignments", () => {
      updateFinaleState(1, {
        finale_player1_showcase: 1,
        finale_player2_showcase: 2,
      });

      const state = getShowcaseState(1);

      expect(state!.finale_player1_showcase).toBe(1);
      expect(state!.finale_player2_showcase).toBe(2);
    });

    it("should update pass decision", () => {
      updateFinaleState(1, { finale_player1_passed: 1 });

      const state = getShowcaseState(1);

      expect(state!.finale_player1_passed).toBe(1);
    });

    it("should throw error when no fields to update", () => {
      expect(() => {
        updateFinaleState(1, {});
      }).toThrow("No fields to update");
    });
  });

  describe("setFinaleWinner", () => {
    it("should set winner with bonus", () => {
      setFinaleWinner(1, 1, true);

      const winner = getFinaleWinner(1);

      expect(winner).not.toBeNull();
      expect(winner!.winnerId).toBe(1);
      expect(winner!.bonusWon).toBe(true);
    });

    it("should set winner without bonus", () => {
      setFinaleWinner(1, 2, false);

      const winner = getFinaleWinner(1);

      expect(winner).not.toBeNull();
      expect(winner!.winnerId).toBe(2);
      expect(winner!.bonusWon).toBe(false);
    });

    it("should overwrite previous winner", () => {
      setFinaleWinner(1, 1, true);
      setFinaleWinner(1, 2, false);

      const winner = getFinaleWinner(1);

      expect(winner!.winnerId).toBe(2);
      expect(winner!.bonusWon).toBe(false);
    });
  });

  describe("incrementRetryNumber", () => {
    it("should increment retry number from 0 to 1", () => {
      const newRetry = incrementRetryNumber(1);

      expect(newRetry).toBe(1);

      const state = getShowcaseState(1);
      expect(state!.finale_retry_number).toBe(1);
    });

    it("should increment multiple times", () => {
      incrementRetryNumber(1);
      incrementRetryNumber(1);
      const newRetry = incrementRetryNumber(1);

      expect(newRetry).toBe(3);

      const state = getShowcaseState(1);
      expect(state!.finale_retry_number).toBe(3);
    });

    it("should return new retry number", () => {
      const retry1 = incrementRetryNumber(1);
      const retry2 = incrementRetryNumber(1);

      expect(retry1).toBe(1);
      expect(retry2).toBe(2);
    });
  });

  describe("getPlayerBidForRetry", () => {
    it("should return player's bid for specific retry", () => {
      const bid = insertShowcaseBid({
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 25000,
        retry_number: 0,
      });

      const result = getPlayerBidForRetry(1, 1, 0);

      expect(result).not.toBeUndefined();
      expect(result!.id).toBe(bid.id);
    });

    it("should return undefined when bid not found", () => {
      const result = getPlayerBidForRetry(1, 999, 0);

      expect(result).toBeUndefined();
    });

    it("should return correct bid for specific retry number", () => {
      insertShowcaseBid({
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 25000,
        retry_number: 0,
      });

      const bid2 = insertShowcaseBid({
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 22000,
        retry_number: 1,
      });

      const result = getPlayerBidForRetry(1, 1, 1);

      expect(result).not.toBeUndefined();
      expect(result!.id).toBe(bid2.id);
      expect(result!.bid_amount).toBe(22000);
    });
  });

  describe("getShowcaseBidById", () => {
    it("should return bid by ID", () => {
      const bid = insertShowcaseBid({
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 25000,
        retry_number: 0,
      });

      const result = getShowcaseBidById(bid.id);

      expect(result).not.toBeUndefined();
      expect(result!.id).toBe(bid.id);
      expect(result!.player_id).toBe(1);
      expect(result!.bid_amount).toBe(25000);
    });

    it("should return undefined for non-existent ID", () => {
      const result = getShowcaseBidById(999);

      expect(result).toBeUndefined();
    });
  });
});
