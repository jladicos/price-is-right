import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDatabase } from "../db/connection.js";
import { setupTestDatabase, cleanupTestDatabase } from "../db/test-helper.js";
import {
  addContestantToRow,
  copyContestantsToNextSegment,
  getAllContestantRows,
  isPlayerBiddingWinner,
} from "../db/contestants.js";
import { updateGameWorkflow } from "../db/game-workflow.js";

describe("Section 2 Transition Behavior", () => {
  beforeEach(() => {
    setupTestDatabase();

    const db = getDatabase();

    // Create 10 test players - first 5 for section_1, rest are audience
    for (let i = 1; i <= 5; i++) {
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run(`Player${i}`, `Last${i}`, `CODE${i}`, "player");
    }

    // Create audience members (players 6-10)
    for (let i = 6; i <= 10; i++) {
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role, weight) VALUES (?, ?, ?, ?, ?)",
      ).run(`Player${i}`, `Last${i}`, `CODE${i}`, "audience", 1.0);
    }

    // Simulate section_1 completion with 2 bidding winners (realistic)
    // Set up section_1 with 5 contestants
    for (let i = 1; i <= 5; i++) {
      addContestantToRow(i, i, "section_1", "active");
    }

    // Mark players 2, 3 as bidding winners (they go to wheel)
    db.prepare(
      `
      INSERT INTO bids (game_segment, round_number, player_id, bid_amount, product_id, is_winner)
      VALUES ('section_1', 0, 2, 1000, 'prod-1', 1)
    `,
    ).run();

    db.prepare(
      `
      INSERT INTO bids (game_segment, round_number, player_id, bid_amount, product_id, is_winner)
      VALUES ('section_1', 1, 3, 1100, 'prod-2', 1)
    `,
    ).run();

    // After the last bidding round, player 3 is replaced with player 6 (pending_reveal)
    // This simulates the auto-replacement that happens when advancing from bidding phase
    addContestantToRow(6, 3, "section_1", "pending_reveal");

    // Players 1, 4, 5 are active non-winners (should move to section_2)
    // Player 6 is pending_reveal (should also move to section_2)

    // Set up for wheel phase
    updateGameWorkflow({
      current_segment: "section_1",
      current_segment_index: 0,
      phase_type: "wheel",
    });

    // Simulate wheel completion - player 2 wins overall
    db.prepare(
      `
      INSERT INTO wheel_spins (player_id, game_segment, spin_number, result)
      VALUES (2, 'section_1', 1, 100)
    `,
    ).run();

    // Now transition to section_2 (this is where our logic should create empty position)
    copyContestantsToNextSegment("section_1", "section_2");

    updateGameWorkflow({
      current_segment: "section_2",
      current_segment_index: 0,
      phase_type: "contestant_selection",
      phase_metadata: JSON.stringify({ skip_auto_fill: true }),
    });
  });

  afterEach(() => {
    cleanupTestDatabase();
  });

  it("should have 1 less contestant than podiums when moving from wheel to section_2", () => {
    const section2Rows = getAllContestantRows("section_2");

    // After wheel→section_2 transition, should have 4 total contestants:
    // - 3 non-bidding-winners from section_1 (players 1, 4, 5 - status='active')
    // - 1 pending_reveal from section_1 (player 6 - status='pending_reveal')
    // Total = 4 contestants for 5 podiums (1 less than podiums)
    expect(section2Rows.length).toBe(4);
  });

  it("should have exactly one unrevealed player position at start of section_2", () => {
    const section2Rows = getAllContestantRows("section_2");

    // Count positions that are revealed (status='active')
    const revealedCount = section2Rows.filter(
      (r) => r.status === "active",
    ).length;

    // Should have exactly 3 revealed (the 3 active non-winners from section_1)
    expect(revealedCount).toBe(3);

    // Should have exactly 1 pending_reveal (carried over from section_1)
    const unrevealedPositions = section2Rows.filter(
      (r) => r.status === "pending_reveal",
    );
    expect(unrevealedPositions.length).toBe(1);

    // The unrevealed contestant should have a player_id assigned (player 6)
    expect(unrevealedPositions[0].player_id).toBe(6);
  });

  it("should place unrevealed contestant at position 3 (where last bidding winner was)", () => {
    // After copying, pending_reveal contestant (player 6) should be at position 3
    // (This is where player 3 was, the last bidding winner)

    // Find the pending_reveal position in section_2
    const section2Rows = getAllContestantRows("section_2");
    const pendingRevealContestant = section2Rows.find(
      (r) => r.status === "pending_reveal",
    );

    expect(pendingRevealContestant).toBeDefined();
    // Should be at position 3 (carried over from section_1)
    expect(pendingRevealContestant!.position).toBe(3);
    expect(pendingRevealContestant!.player_id).toBe(6);
  });

  it("should preserve non-winners from section_1 in their original positions (excluding bidding winners)", () => {
    // Non-winners were players 1, 4, 5 (active) plus player 6 (pending_reveal)
    // Bidding winners (players 2, 3) should NOT be in section_2

    const section2Rows = getAllContestantRows("section_2");

    // Check that we have player 1 at position 1 with status='active'
    const pos1 = section2Rows.find((r) => r.position === 1);
    expect(pos1?.player_id).toBe(1);
    expect(pos1?.status).toBe("active");

    // Check that pending_reveal contestant is at position 3 (player 6)
    const pos3 = section2Rows.find((r) => r.position === 3);
    expect(pos3?.status).toBe("pending_reveal");
    expect(pos3?.player_id).toBe(6);

    // Check that we have player 4 at position 4 with status='active'
    const pos4 = section2Rows.find((r) => r.position === 4);
    expect(pos4?.player_id).toBe(4);
    expect(pos4?.status).toBe("active");

    // Check that we have player 5 at position 5 with status='active'
    const pos5 = section2Rows.find((r) => r.position === 5);
    expect(pos5?.player_id).toBe(5);
    expect(pos5?.status).toBe("active");

    // Verify bidding winners (2, 3) are NOT in section_2 at all
    expect(isPlayerBiddingWinner(2, "section_1")).toBe(true);
    expect(isPlayerBiddingWinner(3, "section_1")).toBe(true);

    const hasPlayer2 = section2Rows.some((r) => r.player_id === 2);
    const hasPlayer3 = section2Rows.some((r) => r.player_id === 3);

    expect(hasPlayer2).toBe(false);
    expect(hasPlayer3).toBe(false);
  });
});
