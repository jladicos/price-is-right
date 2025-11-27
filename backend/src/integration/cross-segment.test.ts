import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDatabase, cleanupTestDatabase } from "../db/test-helper.js";
import { getDatabase } from "../db/connection.js";
import { createPlayer } from "../db/players.js";
import { addContestantToRow, getContestantsRow } from "../db/contestants.js";
import { createBid, getBidsForRound } from "../db/bids.js";
import { getCurrentState } from "../services/game-state.js";

/**
 * CROSS-SEGMENT INTEGRATION TESTS
 *
 * These tests verify that players can exist in multiple game segments simultaneously
 * without causing data corruption, duplicate entries, or incorrect filtering.
 *
 * Critical scenarios:
 * 1. Player wins in section_1, advances to section_2 while section_1 record remains
 * 2. Bids are correctly filtered by segment when player exists in multiple segments
 * 3. Game state correctly filters contestants by current segment
 * 4. Player positions are tracked separately per segment
 */
describe("Cross-Segment Integration Tests", () => {
  beforeEach(() => {
    setupTestDatabase();
  });

  afterEach(() => {
    cleanupTestDatabase();
  });

  describe("Player lifecycle across segments", () => {
    it("should allow player to exist in both section_1 and section_2 with different statuses", () => {
      const db = getDatabase();

      const player = createPlayer(db, {
        firstName: "CrossSegment",
        lastName: "Player",
        accessCode: "CROSS1",
        role: "player",
        photoFilename: "default.jpg",
      });

      // Add to section_1 as winner
      const section1Contestant = addContestantToRow(
        player.id,
        1,
        "section_1",
        "won",
      );

      // Add to section_2 as active (they advanced)
      const section2Contestant = addContestantToRow(
        player.id,
        2,
        "section_2",
        "active",
      );

      expect(section1Contestant.game_segment).toBe("section_1");
      expect(section1Contestant.status).toBe("won");

      expect(section2Contestant.game_segment).toBe("section_2");
      expect(section2Contestant.status).toBe("active");

      // Verify both entries exist in database
      const section1Contestants = getContestantsRow("section_1");
      const section2Contestants = getContestantsRow("section_2");

      expect(section1Contestants.find((c) => c.player_id === player.id)).toBeDefined();
      expect(section2Contestants.find((c) => c.player_id === player.id)).toBeDefined();
    });

    it("should track player positions separately in each segment", () => {
      const db = getDatabase();

      const player = createPlayer(db, {
        firstName: "MultiPosition",
        lastName: "Player",
        accessCode: "MULTI1",
        role: "player",
        photoFilename: "default.jpg",
      });

      // Position 1 in section_1
      const section1Contestant = addContestantToRow(
        player.id,
        1,
        "section_1",
        "won",
      );

      // Position 4 in section_2
      const section2Contestant = addContestantToRow(
        player.id,
        4,
        "section_2",
        "active",
      );

      expect(section1Contestant.position).toBe(1);
      expect(section2Contestant.position).toBe(4);

      // Positions should remain independent
      const section1Row = getContestantsRow("section_1");
      const section2Row = getContestantsRow("section_2");

      const s1Player = section1Row.find((c) => c.player_id === player.id);
      const s2Player = section2Row.find((c) => c.player_id === player.id);

      expect(s1Player!.position).toBe(1);
      expect(s2Player!.position).toBe(4);
    });
  });

  describe("Bidding with cross-segment players", () => {
    it("should not duplicate bids when querying by segment", () => {
      const db = getDatabase();

      // Player who won section_1 and is now in section_2
      const crossPlayer = createPlayer(db, {
        firstName: "Cross",
        lastName: "Player",
        accessCode: "CROSS",
        role: "player",
        photoFilename: "default.jpg",
      });

      addContestantToRow(crossPlayer.id, 1, "section_1", "won");
      addContestantToRow(crossPlayer.id, 2, "section_2", "active");

      // Players only in section_2
      const player2 = createPlayer(db, {
        firstName: "Section2",
        lastName: "Player2",
        accessCode: "S2P2",
        role: "player",
        photoFilename: "default.jpg",
      });
      addContestantToRow(player2.id, 3, "section_2", "active");

      const player3 = createPlayer(db, {
        firstName: "Section2",
        lastName: "Player3",
        accessCode: "S2P3",
        role: "player",
        photoFilename: "default.jpg",
      });
      addContestantToRow(player3.id, 4, "section_2", "active");

      // Create bids in section_2
      createBid(crossPlayer.id, "product-002", 1, "section_2", 2000, 0);
      createBid(player2.id, "product-002", 1, "section_2", 2100, 0);
      createBid(player3.id, "product-002", 1, "section_2", 2200, 0);

      // Get bids for section_2
      const section2Bids = getBidsForRound("section_2", 1, 0);

      // Should have exactly 3 bids, no duplicates
      expect(section2Bids).toHaveLength(3);

      // Each player should appear exactly once
      const playerIds = section2Bids.map((b) => b.player_id);
      const uniquePlayerIds = new Set(playerIds);
      expect(uniquePlayerIds.size).toBe(3);

      // Cross player should appear with section_2 data
      const crossPlayerBid = section2Bids.find(
        (b) => b.player_id === crossPlayer.id,
      );
      expect(crossPlayerBid).toBeDefined();
      expect(crossPlayerBid!.game_segment).toBe("section_2");
      expect(crossPlayerBid!.position).toBe(2); // section_2 position, not section_1
    });

    it("should keep section_1 and section_2 bids separate", () => {
      const db = getDatabase();

      const player = createPlayer(db, {
        firstName: "Dual",
        lastName: "Bidder",
        accessCode: "DUAL",
        role: "player",
        photoFilename: "default.jpg",
      });

      addContestantToRow(player.id, 1, "section_1", "won");
      addContestantToRow(player.id, 3, "section_2", "active");

      // Bid in section_1 (round 3)
      createBid(player.id, "product-001", 3, "section_1", 1500, 0);

      // Bid in section_2 (round 1)
      createBid(player.id, "product-002", 1, "section_2", 2500, 0);

      // Query section_1 bids
      const section1Bids = getBidsForRound("section_1", 3, 0);
      const section1PlayerBid = section1Bids.find(
        (b) => b.player_id === player.id,
      );
      expect(section1PlayerBid).toBeDefined();
      expect(section1PlayerBid!.bid_amount).toBe(1500);
      expect(section1PlayerBid!.game_segment).toBe("section_1");

      // Query section_2 bids
      const section2Bids = getBidsForRound("section_2", 1, 0);
      const section2PlayerBid = section2Bids.find(
        (b) => b.player_id === player.id,
      );
      expect(section2PlayerBid).toBeDefined();
      expect(section2PlayerBid!.bid_amount).toBe(2500);
      expect(section2PlayerBid!.game_segment).toBe("section_2");

      // Bids should not cross-contaminate
      expect(section1Bids).not.toContainEqual(
        expect.objectContaining({ bid_amount: 2500 }),
      );
      expect(section2Bids).not.toContainEqual(
        expect.objectContaining({ bid_amount: 1500 }),
      );
    });
  });

  describe("Game state with cross-segment players", () => {
    it("should return only current segment contestants in getCurrentState", () => {
      const db = getDatabase();

      // Create players
      const section1Player = createPlayer(db, {
        firstName: "Section1",
        lastName: "Only",
        accessCode: "S1ONLY",
        role: "player",
        photoFilename: "default.jpg",
      });

      const crossPlayer = createPlayer(db, {
        firstName: "Cross",
        lastName: "Segment",
        accessCode: "CROSS",
        role: "player",
        photoFilename: "default.jpg",
      });

      const section2Player = createPlayer(db, {
        firstName: "Section2",
        lastName: "Only",
        accessCode: "S2ONLY",
        role: "player",
        photoFilename: "default.jpg",
      });

      // Add contestants
      addContestantToRow(section1Player.id, 1, "section_1", "active");
      addContestantToRow(crossPlayer.id, 2, "section_1", "won");
      addContestantToRow(crossPlayer.id, 1, "section_2", "active");
      addContestantToRow(section2Player.id, 2, "section_2", "active");

      // Set current segment to section_2
      db.prepare(
        "UPDATE game_workflow SET current_segment = 'section_2'",
      ).run();

      const state = getCurrentState();

      // Should only return section_2 contestants
      expect(state.contestantsRow).toHaveLength(2);

      const playerIds = state.contestantsRow.map((c) => c.player_id);
      expect(playerIds).toContain(crossPlayer.id);
      expect(playerIds).toContain(section2Player.id);
      expect(playerIds).not.toContain(section1Player.id);

      // All should be from section_2
      state.contestantsRow.forEach((c) => {
        expect(c.game_segment).toBe("section_2");
      });
    });

    it("should switch contestants when current_segment changes", () => {
      const db = getDatabase();

      const player = createPlayer(db, {
        firstName: "Switch",
        lastName: "Test",
        accessCode: "SWITCH",
        role: "player",
        photoFilename: "default.jpg",
      });

      addContestantToRow(player.id, 1, "section_1", "won");
      addContestantToRow(player.id, 3, "section_2", "active");

      // Set to section_1
      db.prepare(
        "UPDATE game_workflow SET current_segment = 'section_1'",
      ).run();

      let state = getCurrentState();
      expect(state.contestantsRow).toHaveLength(1);
      expect(state.contestantsRow[0].game_segment).toBe("section_1");
      expect(state.contestantsRow[0].position).toBe(1);

      // Switch to section_2
      db.prepare(
        "UPDATE game_workflow SET current_segment = 'section_2'",
      ).run();

      state = getCurrentState();
      expect(state.contestantsRow).toHaveLength(1);
      expect(state.contestantsRow[0].game_segment).toBe("section_2");
      expect(state.contestantsRow[0].position).toBe(3); // Different position
    });
  });

  describe("Full section_1 to section_2 transition", () => {
    it("should handle complete workflow: section_1 winner -> wheel -> section_2 contestant", () => {
      const db = getDatabase();

      // Create a player who will go through the full journey
      const journeyPlayer = createPlayer(db, {
        firstName: "Journey",
        lastName: "Player",
        accessCode: "JOURNEY",
        role: "audience",
        photoFilename: "default.jpg",
      });

      // Step 1: Selected for section_1 at position 1
      const section1Contestant = addContestantToRow(
        journeyPlayer.id,
        1,
        "section_1",
        "pending_reveal",
      );
      expect(section1Contestant.status).toBe("pending_reveal");

      // Step 2: Revealed and became active
      db.prepare(
        "UPDATE contestants_row SET status = 'active' WHERE id = ?",
      ).run(section1Contestant.id);

      // Step 3: Bid in section_1
      createBid(journeyPlayer.id, "product-s1-1", 1, "section_1", 1200, 0);

      // Step 4: Won section_1
      db.prepare(
        "UPDATE contestants_row SET status = 'won' WHERE id = ?",
      ).run(section1Contestant.id);

      // Step 5: Participated in wheel (section_1_finale)
      db.prepare(
        "INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number) VALUES (?, ?, ?, ?, ?)",
      ).run(journeyPlayer.id, "section_1", 1, 0.85, 0);

      // Step 6: Advanced to section_2
      const section2Contestant = addContestantToRow(
        journeyPlayer.id,
        2,
        "section_2",
        "active",
      );

      // Step 7: Bid in section_2
      createBid(journeyPlayer.id, "product-s2-1", 1, "section_2", 2500, 0);

      // Verify full state
      // Both contestant records exist
      const allSection1 = getContestantsRow("section_1");
      const allSection2 = getContestantsRow("section_2");

      expect(allSection1.find((c) => c.player_id === journeyPlayer.id)).toBeDefined();
      expect(allSection2.find((c) => c.player_id === journeyPlayer.id)).toBeDefined();

      // Bids are separate
      const section1Bids = getBidsForRound("section_1", 1, 0);
      const section2Bids = getBidsForRound("section_2", 1, 0);

      const s1Bid = section1Bids.find((b) => b.player_id === journeyPlayer.id);
      const s2Bid = section2Bids.find((b) => b.player_id === journeyPlayer.id);

      expect(s1Bid).toBeDefined();
      expect(s1Bid!.bid_amount).toBe(1200);

      expect(s2Bid).toBeDefined();
      expect(s2Bid!.bid_amount).toBe(2500);

      // Wheel spin exists
      const wheelSpins = db
        .prepare(
          "SELECT * FROM wheel_spins WHERE player_id = ? AND game_segment = ?",
        )
        .all(journeyPlayer.id, "section_1");
      expect(wheelSpins).toHaveLength(1);

      // When in section_2, getCurrentState returns only section_2 data
      db.prepare(
        "UPDATE game_workflow SET current_segment = 'section_2'",
      ).run();

      const state = getCurrentState();
      const statePlayer = state.contestantsRow.find(
        (c) => c.player_id === journeyPlayer.id,
      );

      expect(statePlayer).toBeDefined();
      expect(statePlayer!.game_segment).toBe("section_2");
      expect(statePlayer!.position).toBe(2);
    });

    it("should handle 3 players with different cross-segment patterns", () => {
      const db = getDatabase();

      // Player 1: Only in section_1
      const player1 = createPlayer(db, {
        firstName: "Section1",
        lastName: "Only",
        accessCode: "P1",
        role: "player",
        photoFilename: "default.jpg",
      });
      addContestantToRow(player1.id, 1, "section_1", "active");

      // Player 2: Won section_1, now in section_2
      const player2 = createPlayer(db, {
        firstName: "Cross",
        lastName: "Segment",
        accessCode: "P2",
        role: "player",
        photoFilename: "default.jpg",
      });
      addContestantToRow(player2.id, 2, "section_1", "won");
      addContestantToRow(player2.id, 1, "section_2", "active");

      // Player 3: Only in section_2
      const player3 = createPlayer(db, {
        firstName: "Section2",
        lastName: "Only",
        accessCode: "P3",
        role: "player",
        photoFilename: "default.jpg",
      });
      addContestantToRow(player3.id, 2, "section_2", "active");

      // All 3 bid in their respective segments
      createBid(player1.id, "product-s1-1", 1, "section_1", 1000, 0);
      createBid(player2.id, "product-s1-2", 2, "section_1", 1500, 0);

      createBid(player2.id, "product-s2-1", 1, "section_2", 2000, 0);
      createBid(player3.id, "product-s2-1", 1, "section_2", 2100, 0);

      // Query section_1 bids
      const section1Bids = getBidsForRound("section_1", 1, 0);
      expect(section1Bids).toHaveLength(1); // Only player1 bid in round 1
      expect(section1Bids[0].player_id).toBe(player1.id);

      const section1Round2Bids = getBidsForRound("section_1", 2, 0);
      expect(section1Round2Bids).toHaveLength(1); // Only player2 bid in round 2
      expect(section1Round2Bids[0].player_id).toBe(player2.id);

      // Query section_2 bids
      const section2Bids = getBidsForRound("section_2", 1, 0);
      expect(section2Bids).toHaveLength(2); // Player2 and Player3

      // Player2 should appear once with section_2 bid, not section_1 bid
      const player2Section2Bid = section2Bids.find(
        (b) => b.player_id === player2.id,
      );
      expect(player2Section2Bid).toBeDefined();
      expect(player2Section2Bid!.bid_amount).toBe(2000);
      expect(player2Section2Bid!.position).toBe(1); // section_2 position
    });
  });

  describe("Edge cases and data integrity", () => {
    it("should prevent data corruption when updating contestant status across segments", () => {
      const db = getDatabase();

      const player = createPlayer(db, {
        firstName: "Status",
        lastName: "Test",
        accessCode: "STATUS",
        role: "player",
        photoFilename: "default.jpg",
      });

      const section1Contestant = addContestantToRow(
        player.id,
        1,
        "section_1",
        "won",
      );
      const section2Contestant = addContestantToRow(
        player.id,
        2,
        "section_2",
        "active",
      );

      // Update section_2 contestant to "won"
      db.prepare(
        "UPDATE contestants_row SET status = 'won' WHERE id = ?",
      ).run(section2Contestant.id);

      // Verify section_1 status unchanged
      const s1Updated = db
        .prepare("SELECT status FROM contestants_row WHERE id = ?")
        .get(section1Contestant.id) as { status: string };
      expect(s1Updated.status).toBe("won"); // Still won from before

      // Verify section_2 status updated
      const s2Updated = db
        .prepare("SELECT status FROM contestants_row WHERE id = ?")
        .get(section2Contestant.id) as { status: string };
      expect(s2Updated.status).toBe("won");

      // Both should still exist
      expect(s1Updated).toBeDefined();
      expect(s2Updated).toBeDefined();
    });

    it("should handle deleting bids from one segment without affecting other segment", () => {
      const db = getDatabase();

      const player = createPlayer(db, {
        firstName: "Delete",
        lastName: "Test",
        accessCode: "DELETE",
        role: "player",
        photoFilename: "default.jpg",
      });

      addContestantToRow(player.id, 1, "section_1", "won");
      addContestantToRow(player.id, 2, "section_2", "active");

      // Create bids in both segments
      createBid(player.id, "product-s1", 1, "section_1", 1500, 0);
      createBid(player.id, "product-s2", 1, "section_2", 2500, 0);

      // Delete section_1 bids
      db.prepare(
        "DELETE FROM bids WHERE game_segment = ? AND round_number = ?",
      ).run("section_1", 1);

      // Verify section_1 bids deleted
      const section1Bids = getBidsForRound("section_1", 1, 0);
      expect(section1Bids.find((b) => b.player_id === player.id)).toBeUndefined();

      // Verify section_2 bids still exist
      const section2Bids = getBidsForRound("section_2", 1, 0);
      expect(section2Bids.find((b) => b.player_id === player.id)).toBeDefined();
    });
  });
});
