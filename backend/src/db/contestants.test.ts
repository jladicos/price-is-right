import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  addContestantToRow,
  getContestantsRow,
  getActiveContestants,
  getAllActiveContestants,
  revealContestant,
  updateContestantStatus,
  replaceContestant,
  clearContestantsRow,
  getBiddingOrder,
  getContestantById,
  findNextEmptyPosition,
  copyContestantsToNextSegment,
} from "./contestants.js";
import { getDatabase } from "./connection.js";
import { setupTestDatabase, cleanupTestDatabase } from "./test-helper.js";

describe("Contestants Database Functions", () => {
  beforeEach(() => {
    setupTestDatabase();

    // Create test players
    const db = getDatabase();
    for (let i = 1; i <= 10; i++) {
      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, role)
         VALUES (?, ?, ?, ?)`,
      ).run(`Player${i}`, `Last${i}`, `CODE${i}`, "audience");
    }
  });

  afterEach(() => {
    cleanupTestDatabase();
  });

  describe("addContestantToRow", () => {
    it("should add a contestant to the row", () => {
      const contestant = addContestantToRow(
        1,
        1,
        "section_1",
        "pending_reveal",
      );

      expect(contestant.player_id).toBe(1);
      expect(contestant.position).toBe(1);
      expect(contestant.game_segment).toBe("section_1");
      expect(contestant.status).toBe("pending_reveal");
      expect(contestant.id).toBeGreaterThan(0);
    });

    it("should auto-generate id", () => {
      const contestant1 = addContestantToRow(1, 1, "section_1", "active");
      const contestant2 = addContestantToRow(2, 2, "section_1", "active");

      expect(contestant1.id).toBeDefined();
      expect(contestant2.id).toBeDefined();
      expect(contestant2.id).toBeGreaterThan(contestant1.id);
    });

    it("should set timestamps", () => {
      const contestant = addContestantToRow(1, 1, "section_1", "active");

      expect(contestant.added_at).toMatch(
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      );
      expect(contestant.created_at).toMatch(
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      );
      expect(contestant.updated_at).toMatch(
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      );
    });

    it("should set revealed_at to null initially", () => {
      const contestant = addContestantToRow(
        1,
        1,
        "section_1",
        "pending_reveal",
      );
      expect(contestant.revealed_at).toBeNull();
    });

    it("should allow adding same player to different segments", () => {
      const c1 = addContestantToRow(1, 1, "section_1", "active");
      const c2 = addContestantToRow(1, 1, "section_2", "active");

      expect(c1.game_segment).toBe("section_1");
      expect(c2.game_segment).toBe("section_2");
    });

    it("should allow adding same player multiple times to same segment", () => {
      // This can happen during replacement scenarios
      const c1 = addContestantToRow(1, 1, "section_1", "active");
      const c2 = addContestantToRow(1, 2, "section_1", "active");

      expect(c1.id).not.toBe(c2.id);
      expect(c1.position).toBe(1);
      expect(c2.position).toBe(2);
    });
  });

  describe("getContestantsRow", () => {
    beforeEach(() => {
      // Add contestants in random order
      addContestantToRow(3, 3, "section_1", "active");
      addContestantToRow(1, 1, "section_1", "pending_reveal");
      addContestantToRow(5, 5, "section_1", "won");
      addContestantToRow(2, 2, "section_1", "active");
    });

    it("should return all contestants for a segment", () => {
      const contestants = getContestantsRow("section_1");
      expect(contestants.length).toBe(4);
    });

    it("should return contestants ordered by position", () => {
      const contestants = getContestantsRow("section_1");

      expect(contestants[0].position).toBe(1);
      expect(contestants[1].position).toBe(2);
      expect(contestants[2].position).toBe(3);
      expect(contestants[3].position).toBe(5);
    });

    it("should include player info", () => {
      const contestants = getContestantsRow("section_1");

      expect(contestants[0].first_name).toBe("Player1");
      expect(contestants[0].last_name).toBe("Last1");
      expect(contestants[0].photo_filename).toBe("default.jpg");
    });

    it("should return empty array for segment with no contestants", () => {
      const contestants = getContestantsRow("section_2");
      expect(contestants).toEqual([]);
    });

    it("should not include contestants from other segments", () => {
      addContestantToRow(10, 1, "section_2", "active");

      const section1 = getContestantsRow("section_1");
      const section2 = getContestantsRow("section_2");

      expect(section1.length).toBe(4);
      expect(section2.length).toBe(1);
    });
  });

  describe("getActiveContestants", () => {
    beforeEach(() => {
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 2, "section_1", "pending_reveal");
      addContestantToRow(3, 3, "section_1", "won");
      addContestantToRow(4, 4, "section_1", "replaced");
    });

    it("should only return active and pending_reveal contestants", () => {
      const contestants = getActiveContestants("section_1");

      expect(contestants.length).toBe(2);
      expect(contestants.some((c) => c.status === "active")).toBe(true);
      expect(contestants.some((c) => c.status === "pending_reveal")).toBe(true);
    });

    it("should not include won or replaced contestants", () => {
      const contestants = getActiveContestants("section_1");

      expect(contestants.some((c) => c.status === "won")).toBe(false);
      expect(contestants.some((c) => c.status === "replaced")).toBe(false);
    });

    it("should return empty array if no active contestants", () => {
      clearContestantsRow("section_1");
      const contestants = getActiveContestants("section_1");
      expect(contestants).toEqual([]);
    });
  });

  describe("getAllActiveContestants", () => {
    it("should return active contestants from all segments", () => {
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 2, "section_1", "pending_reveal");
      addContestantToRow(3, 3, "section_2", "active");
      addContestantToRow(4, 4, "section_1", "replaced");

      const contestants = getAllActiveContestants();

      // Should get 3 contestants (2 from section_1, 1 from section_2)
      expect(contestants.length).toBe(3);
      expect(contestants.some((c) => c.game_segment === "section_1")).toBe(
        true,
      );
      expect(contestants.some((c) => c.game_segment === "section_2")).toBe(
        true,
      );
    });

    it("should include won contestants but exclude replaced", () => {
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 2, "section_2", "replaced");
      addContestantToRow(3, 3, "section_1", "won");

      const contestants = getAllActiveContestants();

      // Should include 'active' and 'won' (winners stay visible on podium)
      expect(contestants.length).toBe(2);
      expect(contestants.some((c) => c.status === "active")).toBe(true);
      expect(contestants.some((c) => c.status === "won")).toBe(true);
      expect(contestants.some((c) => c.status === "replaced")).toBe(false);
    });

    it("should return only won contestants when no active exist", () => {
      addContestantToRow(1, 1, "section_1", "replaced");
      addContestantToRow(2, 2, "section_2", "won");

      const contestants = getAllActiveContestants();

      // Should return the 'won' contestant (winners stay visible)
      expect(contestants.length).toBe(1);
      expect(contestants[0].status).toBe("won");
    });

    it("should order by position", () => {
      addContestantToRow(1, 3, "section_1", "active");
      addContestantToRow(2, 1, "section_2", "active");
      addContestantToRow(3, 2, "section_1", "active");

      const contestants = getAllActiveContestants();

      expect(contestants[0].position).toBe(1);
      expect(contestants[1].position).toBe(2);
      expect(contestants[2].position).toBe(3);
    });
  });

  describe("revealContestant", () => {
    it("should update status to active", () => {
      const contestant = addContestantToRow(
        1,
        1,
        "section_1",
        "pending_reveal",
      );
      const revealed = revealContestant(contestant.id);

      expect(revealed.status).toBe("active");
    });

    it("should set revealed_at timestamp", () => {
      const contestant = addContestantToRow(
        1,
        1,
        "section_1",
        "pending_reveal",
      );
      expect(contestant.revealed_at).toBeNull();

      const revealed = revealContestant(contestant.id);

      expect(revealed.revealed_at).not.toBeNull();
      expect(revealed.revealed_at).toMatch(
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      );
    });

    it("should update updated_at timestamp", () => {
      const contestant = addContestantToRow(
        1,
        1,
        "section_1",
        "pending_reveal",
      );

      const revealed = revealContestant(contestant.id);

      // Timestamp should be valid
      expect(revealed.updated_at).toMatch(
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      );
    });

    it("should preserve other fields", () => {
      const contestant = addContestantToRow(
        1,
        1,
        "section_1",
        "pending_reveal",
      );
      const revealed = revealContestant(contestant.id);

      // Verify immutable fields unchanged
      expect(revealed.id).toBe(contestant.id);
      expect(revealed.player_id).toBe(contestant.player_id);
      expect(revealed.position).toBe(contestant.position);
      expect(revealed.game_segment).toBe(contestant.game_segment);
      expect(revealed.added_at).toBe(contestant.added_at);
      expect(revealed.created_at).toBe(contestant.created_at);
    });
  });

  describe("updateContestantStatus", () => {
    it("should update status", () => {
      const contestant = addContestantToRow(1, 1, "section_1", "active");
      const updated = updateContestantStatus(contestant.id, "won");

      expect(updated.status).toBe("won");
    });

    it("should update updated_at timestamp", () => {
      const contestant = addContestantToRow(1, 1, "section_1", "active");
      const updated = updateContestantStatus(contestant.id, "replaced");

      expect(updated.updated_at).toMatch(
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      );
    });

    it("should preserve other fields", () => {
      const contestant = addContestantToRow(1, 1, "section_1", "active");
      const updated = updateContestantStatus(contestant.id, "won");

      // Verify immutable fields unchanged
      expect(updated.id).toBe(contestant.id);
      expect(updated.player_id).toBe(contestant.player_id);
      expect(updated.position).toBe(contestant.position);
      expect(updated.game_segment).toBe(contestant.game_segment);
      expect(updated.added_at).toBe(contestant.added_at);
      expect(updated.revealed_at).toBe(contestant.revealed_at);
      expect(updated.created_at).toBe(contestant.created_at);
    });
  });

  describe("replaceContestant", () => {
    it("should mark old contestant as replaced", () => {
      const old = addContestantToRow(1, 2, "section_1", "active");
      const result = replaceContestant(old.id, 5, "pending_reveal");

      expect(result.old.status).toBe("replaced");
    });

    it("should add new contestant in same position", () => {
      const old = addContestantToRow(1, 2, "section_1", "active");
      const result = replaceContestant(old.id, 5, "pending_reveal");

      expect(result.new.position).toBe(2); // Same as old
      expect(result.new.player_id).toBe(5); // New player
    });

    it("should preserve game segment", () => {
      const old = addContestantToRow(1, 2, "section_1", "active");
      const result = replaceContestant(old.id, 5, "pending_reveal");

      expect(result.new.game_segment).toBe("section_1");
    });

    it("should use provided status for new contestant", () => {
      const old = addContestantToRow(1, 2, "section_1", "active");
      const result = replaceContestant(old.id, 5, "active");

      expect(result.new.status).toBe("active");
    });

    it("should be atomic (transaction)", () => {
      const old = addContestantToRow(1, 2, "section_1", "active");

      // Should complete both updates together
      const result = replaceContestant(old.id, 5, "pending_reveal");

      expect(result.old.status).toBe("replaced");
      expect(result.new.status).toBe("pending_reveal");
    });

    it("should throw error if old contestant not found", () => {
      expect(() => replaceContestant(9999, 5, "active")).toThrow(
        "Contestant 9999 not found",
      );
    });
  });

  describe("clearContestantsRow", () => {
    beforeEach(() => {
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 2, "section_1", "pending_reveal");
      addContestantToRow(3, 3, "section_1", "won");
      addContestantToRow(4, 4, "section_1", "replaced");
    });

    it("should mark active and pending_reveal contestants as replaced", () => {
      clearContestantsRow("section_1");

      const contestants = getContestantsRow("section_1");

      const active = contestants.filter((c) => c.status === "active");
      const pending = contestants.filter((c) => c.status === "pending_reveal");

      expect(active.length).toBe(0);
      expect(pending.length).toBe(0);
    });

    it("should not affect already won or replaced contestants", () => {
      clearContestantsRow("section_1");

      const contestants = getContestantsRow("section_1");

      const won = contestants.filter((c) => c.status === "won");
      const replaced = contestants.filter((c) => c.status === "replaced");

      expect(won.length).toBe(1);
      expect(replaced.length).toBe(3); // Original 1 + 2 newly replaced
    });

    it("should not affect other segments", () => {
      addContestantToRow(5, 1, "section_2", "active");

      clearContestantsRow("section_1");

      const section2 = getActiveContestants("section_2");
      expect(section2.length).toBe(1);
    });
  });

  describe("getBiddingOrder", () => {
    it("should return most recently added contestant first", () => {
      // Add in specific order with time differences
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 2, "section_1", "active");
      addContestantToRow(3, 3, "section_1", "active");

      const order = getBiddingOrder("section_1");

      // Most recent (position 3) should be first
      expect(order[0]).toBe(3);
    });

    it("should continue in circular order after most recent", () => {
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 2, "section_1", "active");
      addContestantToRow(3, 3, "section_1", "active");
      addContestantToRow(4, 4, "section_1", "active");
      addContestantToRow(5, 5, "section_1", "active");

      const order = getBiddingOrder("section_1");

      // Should be [5, 1, 2, 3, 4] (5 is most recent, then wrap around)
      expect(order).toEqual([5, 1, 2, 3, 4]);
    });

    it("should handle middle position as most recent", () => {
      // Fill positions 1, 2, 4, 5, then 3 last
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 2, "section_1", "active");
      addContestantToRow(4, 4, "section_1", "active");
      addContestantToRow(5, 5, "section_1", "active");
      addContestantToRow(3, 3, "section_1", "active"); // Most recent

      const order = getBiddingOrder("section_1");

      // Should be [3, 4, 5, 1, 2] (3 is most recent, then 4, 5, wrap to 1, 2)
      expect(order).toEqual([3, 4, 5, 1, 2]);
    });

    it("should only include active contestants", () => {
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 2, "section_1", "won");
      addContestantToRow(3, 3, "section_1", "active");

      const order = getBiddingOrder("section_1");

      // Should only include positions 1 and 3
      expect(order.length).toBe(2);
      expect(order.includes(2)).toBe(false);
    });

    it("should return empty array if no active contestants", () => {
      const order = getBiddingOrder("section_1");
      expect(order).toEqual([]);
    });
  });

  describe("getContestantById", () => {
    it("should return contestant by id", () => {
      const added = addContestantToRow(1, 1, "section_1", "active");
      const found = getContestantById(added.id);

      // Verify full contestant object matches
      expect(found).toEqual(added);
    });

    it("should return undefined if not found", () => {
      const found = getContestantById(9999);
      expect(found).toBeUndefined();
    });
  });

  describe("findNextEmptyPosition", () => {
    it("should return position 1 when row is empty", () => {
      const position = findNextEmptyPosition("section_1");
      expect(position).toBe(1);
    });

    it("should return next available position", () => {
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 2, "section_1", "active");

      const position = findNextEmptyPosition("section_1");
      expect(position).toBe(3);
    });

    it("should skip filled positions", () => {
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 3, "section_1", "active");

      const position = findNextEmptyPosition("section_1");
      expect(position).toBe(2); // Position 2 is empty
    });

    it("should return null when all 5 positions filled", () => {
      for (let i = 1; i <= 5; i++) {
        addContestantToRow(i, i, "section_1", "active");
      }

      const position = findNextEmptyPosition("section_1");
      expect(position).toBeNull();
    });

    it("should consider active, pending_reveal, and won contestants", () => {
      addContestantToRow(1, 1, "section_1", "won");
      addContestantToRow(2, 2, "section_1", "replaced");

      const position = findNextEmptyPosition("section_1");
      // Position 1 is occupied by 'won' (winners stay visible)
      // Position 2 is available ('replaced' doesn't occupy)
      expect(position).toBe(2);
    });

    it("should check ALL segments (contestants persist across sections)", () => {
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 2, "section_1", "active");

      // When checking for section_2, it should see positions 1 and 2 are occupied
      // (even though they're from section_1) because contestants persist
      const section2Position = findNextEmptyPosition("section_2");
      expect(section2Position).toBe(3); // First empty position globally
    });

    it("should detect occupied positions across different segments", () => {
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 3, "section_2", "active");
      addContestantToRow(3, 5, "section_1", "active");

      const position = findNextEmptyPosition("section_2");
      expect(position).toBe(2); // Positions 1, 3, 5 occupied; next empty is 2
    });
  });

  describe("edge cases and data integrity", () => {
    it("should handle replacing a contestant that was already replaced", () => {
      const c1 = addContestantToRow(1, 1, "section_1", "active");
      const r1 = replaceContestant(c1.id, 2, "active");

      // Now replace the replacement
      const r2 = replaceContestant(r1.new.id, 3, "active");

      expect(r2.old.status).toBe("replaced");
      expect(r2.new.player_id).toBe(3);
      expect(r2.new.position).toBe(1); // Still position 1
    });

    it("should maintain referential integrity with players", () => {
      // This will fail if player_id foreign key doesn't exist
      const db = getDatabase();

      expect(() => {
        db.prepare(
          `INSERT INTO contestants_row (player_id, position, game_segment, status)
           VALUES (9999, 1, 'section_1', 'active')`,
        ).run();
      }).toThrow(/FOREIGN KEY constraint failed/i);
    });
  });

  describe("getBiddingOrder edge cases", () => {
    it("should handle only position 5 filled (no wraparound needed)", () => {
      addContestantToRow(1, 5, "section_1", "active");

      const order = getBiddingOrder("section_1");
      expect(order).toEqual([5]);
    });

    it("should handle positions [5, 1] (wraparound when highest is most recent)", () => {
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 5, "section_1", "active"); // Most recent

      const order = getBiddingOrder("section_1");
      expect(order).toEqual([5, 1]); // 5 first, then wraps to 1
    });

    it("should handle non-contiguous positions with middle most recent", () => {
      // Positions 1, 3, 5 with 3 being most recent
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 5, "section_1", "active");
      addContestantToRow(3, 3, "section_1", "active"); // Most recent

      const order = getBiddingOrder("section_1");
      expect(order).toEqual([3, 5, 1]); // 3, then higher (5), then wrap (1)
    });

    it("should handle position 1 as most recent (no wraparound to lower)", () => {
      addContestantToRow(2, 2, "section_1", "active");
      addContestantToRow(3, 3, "section_1", "active");
      addContestantToRow(1, 1, "section_1", "active"); // Most recent

      const order = getBiddingOrder("section_1");
      expect(order).toEqual([1, 2, 3]); // 1 first, then 2, 3 in order
    });

    it("should only include active contestants, not pending_reveal", () => {
      addContestantToRow(1, 1, "section_1", "pending_reveal");
      addContestantToRow(2, 2, "section_1", "active");
      addContestantToRow(3, 3, "section_1", "active");

      const order = getBiddingOrder("section_1");
      // Should not include position 1 (pending_reveal status)
      expect(order).toEqual([3, 2]);
    });
  });

  describe("position boundary tests", () => {
    it("should allow position 1 (minimum valid)", () => {
      const contestant = addContestantToRow(1, 1, "section_1", "active");
      expect(contestant.position).toBe(1);
    });

    it("should allow position 5 (maximum valid)", () => {
      const contestant = addContestantToRow(1, 5, "section_1", "active");
      expect(contestant.position).toBe(5);
    });

    it("should allow position 0 (database does not prevent it)", () => {
      // Note: The database schema doesn't have CHECK constraints on position
      // This test documents current behavior - may want to add constraints later
      const contestant = addContestantToRow(1, 0, "section_1", "active");
      expect(contestant.position).toBe(0);
    });

    it("should allow position 6 (database does not prevent it)", () => {
      // Note: The database schema doesn't have CHECK constraints on position
      // This test documents current behavior - may want to add constraints later
      const contestant = addContestantToRow(1, 6, "section_1", "active");
      expect(contestant.position).toBe(6);
    });
  });

  describe("timestamp validation", () => {
    it("should set added_at with valid datetime format", () => {
      const contestant = addContestantToRow(1, 1, "section_1", "active");
      expect(contestant.added_at).toMatch(
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      );
    });

    it("should set created_at with valid datetime format", () => {
      const contestant = addContestantToRow(1, 1, "section_1", "active");
      expect(contestant.created_at).toMatch(
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      );
    });

    it("should set updated_at with valid datetime format", () => {
      const contestant = addContestantToRow(1, 1, "section_1", "active");
      expect(contestant.updated_at).toMatch(
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      );
    });

    it("should have added_at and created_at equal on creation", () => {
      const contestant = addContestantToRow(1, 1, "section_1", "active");
      // On creation, these should be the same (or very close)
      expect(contestant.added_at).toBe(contestant.created_at);
    });
  });

  describe("copyContestantsToNextSegment", () => {
    it("should copy contestants preserving their original positions", () => {
      const db = getDatabase();

      // Setup: Create 5 contestants in section_1
      addContestantToRow(1, 1, "section_1", "active"); // Player 1 at pos 1 (non-winner)
      addContestantToRow(2, 2, "section_1", "active"); // Player 2 at pos 2 (non-winner)
      addContestantToRow(3, 3, "section_1", "active"); // Player 3 at pos 3 (non-winner)
      addContestantToRow(4, 4, "section_1", "active"); // Player 4 at pos 4 (non-winner)
      addContestantToRow(5, 5, "section_1", "won"); // Player 5 at pos 5 (BIDDING WINNER)

      // Add a pending_reveal contestant at position 5 (simulating end of last bidding round)
      addContestantToRow(6, 5, "section_1", "pending_reveal"); // Player 6 replaces winner

      // Mark player 5 as a bidding winner in bids table
      db.prepare(
        `INSERT INTO bids (player_id, product_id, game_segment, round_number, bid_amount, is_winner)
         VALUES (5, 'product1', 'section_1', 1, 1000, 1)`,
      ).run();

      // Copy from section_1 to section_2
      copyContestantsToNextSegment("section_1", "section_2");

      // Verify section_2 has 5 contestants:
      // - 4 non-winners in their original positions (status='active')
      // - 1 pending_reveal contestant at position 5 (carried over from section_1)
      const section2Contestants = getContestantsRow("section_2");
      expect(section2Contestants).toHaveLength(5);

      // Check each non-winner contestant is in their original position
      const pos1 = section2Contestants.find((c) => c.position === 1);
      expect(pos1?.player_id).toBe(1);
      expect(pos1?.status).toBe("active");

      const pos2 = section2Contestants.find((c) => c.position === 2);
      expect(pos2?.player_id).toBe(2);
      expect(pos2?.status).toBe("active");

      const pos3 = section2Contestants.find((c) => c.position === 3);
      expect(pos3?.player_id).toBe(3);
      expect(pos3?.status).toBe("active");

      const pos4 = section2Contestants.find((c) => c.position === 4);
      expect(pos4?.player_id).toBe(4);
      expect(pos4?.status).toBe("active");

      // Position 5 should have the pending_reveal contestant (player 6, carried over)
      const pos5 = section2Contestants.find((c) => c.position === 5);
      expect(pos5).toBeDefined();
      expect(pos5?.status).toBe("pending_reveal");
      expect(pos5?.player_id).toBe(6); // Should be player 6 (carried over from section_1)
    });

    it("should exclude ALL bidding winners (both wheel winner and losers)", () => {
      const db = getDatabase();

      // Setup: 5 contestants, 3 won bidding rounds (participated in wheel)
      addContestantToRow(1, 1, "section_1", "active"); // Non-winner
      addContestantToRow(2, 2, "section_1", "won"); // Bidding winner (wheel loser)
      addContestantToRow(3, 3, "section_1", "won"); // Bidding winner (wheel loser)
      addContestantToRow(4, 4, "section_1", "active"); // Non-winner
      addContestantToRow(5, 5, "section_1", "won"); // Bidding winner (wheel winner)

      // Add pending_reveal contestant at position 5 (simulating end of last bidding round)
      addContestantToRow(6, 5, "section_1", "pending_reveal");

      // Mark players 2, 3, 5 as bidding winners
      db.prepare(
        `INSERT INTO bids (player_id, product_id, game_segment, round_number, bid_amount, is_winner)
         VALUES (2, 'product1', 'section_1', 1, 1000, 1)`,
      ).run();
      db.prepare(
        `INSERT INTO bids (player_id, product_id, game_segment, round_number, bid_amount, is_winner)
         VALUES (3, 'product2', 'section_1', 2, 1000, 1)`,
      ).run();
      db.prepare(
        `INSERT INTO bids (player_id, product_id, game_segment, round_number, bid_amount, is_winner)
         VALUES (5, 'product3', 'section_1', 3, 1000, 1)`,
      ).run();

      // Copy to section_2
      copyContestantsToNextSegment("section_1", "section_2");

      // Should have 3 contestants:
      // - 2 non-winners at positions 1 and 4 (status='active')
      // - 1 pending_reveal contestant at position 5 (player 6, carried over)
      const section2Contestants = getContestantsRow("section_2");
      expect(section2Contestants).toHaveLength(3);

      // Check that only non-winners were copied (plus pending_reveal)
      const activeContestants = section2Contestants.filter(
        (c) => c.status === "active",
      );
      const playerIds = activeContestants.map((c) => c.player_id);
      expect(playerIds).toContain(1); // Non-winner
      expect(playerIds).toContain(4); // Non-winner
      expect(playerIds).not.toContain(2); // Bidding winner (excluded)
      expect(playerIds).not.toContain(3); // Bidding winner (excluded)
      expect(playerIds).not.toContain(5); // Bidding winner (excluded)

      // Verify positions are preserved for non-winners
      expect(section2Contestants.find((c) => c.player_id === 1)?.position).toBe(
        1,
      );
      expect(section2Contestants.find((c) => c.player_id === 4)?.position).toBe(
        4,
      );

      // Verify there's a pending_reveal contestant (player 6) at position 5
      const pendingReveal = section2Contestants.find(
        (c) => c.status === "pending_reveal",
      );
      expect(pendingReveal).toBeDefined();
      expect(pendingReveal?.position).toBe(5);
      expect(pendingReveal?.player_id).toBe(6);
    });

    it("should preserve status when copying contestants", () => {
      const db = getDatabase();

      // Setup: Various statuses in section_1
      addContestantToRow(1, 1, "section_1", "pending_reveal");
      addContestantToRow(2, 2, "section_1", "active");
      addContestantToRow(3, 3, "section_1", "replaced"); // Will NOT be copied (only active/pending_reveal)
      addContestantToRow(4, 4, "section_1", "won"); // Bidding winner (will be excluded)

      // Mark player 4 as bidding winner
      db.prepare(
        `INSERT INTO bids (player_id, product_id, game_segment, round_number, bid_amount, is_winner)
         VALUES (4, 'product1', 'section_1', 1, 1000, 1)`,
      ).run();

      // Copy to section_2
      copyContestantsToNextSegment("section_1", "section_2");

      // Should have 2 contestants:
      // - Player 1 with status='pending_reveal' (preserved)
      // - Player 2 with status='active' (preserved)
      const section2Contestants = getContestantsRow("section_2");
      expect(section2Contestants).toHaveLength(2);

      // Check that status was preserved
      const player1 = section2Contestants.find((c) => c.player_id === 1);
      expect(player1?.status).toBe("pending_reveal");
      expect(player1?.position).toBe(1);

      const player2 = section2Contestants.find((c) => c.player_id === 2);
      expect(player2?.status).toBe("active");
      expect(player2?.position).toBe(2);

      // Player 3 (replaced) and Player 4 (bidding winner) should NOT be copied
      expect(
        section2Contestants.find((c) => c.player_id === 3),
      ).toBeUndefined();
      expect(
        section2Contestants.find((c) => c.player_id === 4),
      ).toBeUndefined();
    });

    it("should handle empty source segment gracefully", () => {
      // No contestants in section_1
      copyContestantsToNextSegment("section_1", "section_2");

      // section_2 should be empty
      const section2Contestants = getContestantsRow("section_2");
      expect(section2Contestants).toHaveLength(0);
    });

    it("should handle segment with only bidding winners (all excluded)", () => {
      const db = getDatabase();

      // All active contestants are bidding winners, but there's a pending_reveal
      addContestantToRow(1, 1, "section_1", "won");
      addContestantToRow(2, 2, "section_1", "won");
      addContestantToRow(3, 3, "section_1", "won");
      // Add a pending_reveal contestant (realistic: added after last bidding round)
      addContestantToRow(4, 3, "section_1", "pending_reveal");

      // Mark 1, 2, 3 as bidding winners
      db.prepare(
        `INSERT INTO bids (player_id, product_id, game_segment, round_number, bid_amount, is_winner)
         VALUES (1, 'product1', 'section_1', 1, 1000, 1)`,
      ).run();
      db.prepare(
        `INSERT INTO bids (player_id, product_id, game_segment, round_number, bid_amount, is_winner)
         VALUES (2, 'product2', 'section_1', 2, 1000, 1)`,
      ).run();
      db.prepare(
        `INSERT INTO bids (player_id, product_id, game_segment, round_number, bid_amount, is_winner)
         VALUES (3, 'product3', 'section_1', 3, 1000, 1)`,
      ).run();

      copyContestantsToNextSegment("section_1", "section_2");

      // section_2 should have 1 pending_reveal contestant (player 4, carried over)
      // No active contestants because all were bidding winners
      const section2Contestants = getContestantsRow("section_2");
      expect(section2Contestants).toHaveLength(1);
      expect(section2Contestants[0].status).toBe("pending_reveal");
      expect(section2Contestants[0].player_id).toBe(4);
      expect(section2Contestants[0].position).toBe(3);
    });

    it("should not affect source segment", () => {
      // Setup section_1
      addContestantToRow(1, 1, "section_1", "active");
      addContestantToRow(2, 2, "section_1", "active");
      addContestantToRow(3, 3, "section_1", "won");

      // Get original count
      const originalContestants = getContestantsRow("section_1");
      const originalCount = originalContestants.length;

      // Copy to section_2
      copyContestantsToNextSegment("section_1", "section_2");

      // section_1 should be unchanged
      const afterContestants = getContestantsRow("section_1");
      expect(afterContestants).toHaveLength(originalCount);
      expect(afterContestants).toEqual(originalContestants);
    });
  });
});
