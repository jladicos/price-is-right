import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDatabase } from "../db/test-helper.js";
import { getDatabase } from "../db/connection.js";
import {
  startWheelPhase,
  processWheelSpin,
  completePlayerWheelTurn,
  startWheelSpinOff,
  determineWheelWinner,
  getCurrentState,
  startNewGame,
} from "./game-state.js";
import { updateGameWorkflow } from "../db/game-workflow.js";
import { addContestantToRow } from "../db/contestants.js";
import { getEligibleSpinners } from "./wheel.js";

describe("Game State - Wheel Integration", () => {
  beforeEach(() => {
    setupTestDatabase();
  });

  /**
   * Helper function to set up a game with bidding winners ready for wheel phase
   * Creates 4 contestants, with 3 of them marked as bidding winners
   */
  function setupGameWithBiddingWinners(segment: string) {
    const db = getDatabase();

    // Create test players
    const players: number[] = [];
    for (let i = 0; i < 4; i++) {
      const result = db
        .prepare(
          `INSERT INTO players (first_name, last_name, role, active, access_code, photo_filename, weight)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          `Player${i}`,
          `Last${i}`,
          "audience",
          1,
          `code${i}`,
          `photo${i}.jpg`,
          1,
        );
      players.push(result.lastInsertRowid as number);
    }

    // Add contestants to row - first 3 will be winners, 4th will not
    for (let i = 0; i < 3; i++) {
      addContestantToRow(players[i], i + 1, segment, "won");
    }
    addContestantToRow(players[3], 4, segment, "active");

    // Manually insert winning bids for first 3 players (simulate 3 bidding rounds)
    // Each round has a different winner (player 0, 1, 2 respectively)
    for (let round = 1; round <= 3; round++) {
      // Insert bids for all 4 contestants
      for (let i = 0; i < 4; i++) {
        db.prepare(
          `INSERT INTO bids (player_id, game_segment, round_number, retry_number, bid_amount, product_id, is_winner)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          players[i],
          segment,
          round,
          0,
          (i + 1) * 1000 + round * 100,
          `product_${round}`,
          i === round - 1 ? 1 : 0, // Player 0 wins round 1, player 1 wins round 2, player 2 wins round 3
        );
      }
    }

    // Set up game workflow for bidding phase
    updateGameWorkflow({
      current_segment: segment,
      current_segment_index: 2, // After 3 rounds
      phase_type: "bidding",
      phase_metadata: JSON.stringify({
        product_id: "product_3",
        round_number: 3,
        retry_number: 0,
      }),
    });

    return { players, winners: [players[0], players[1], players[2]] };
  }

  describe("startWheelPhase", () => {
    it("should start wheel phase with eligible spinners", () => {
      setupGameWithBiddingWinners("section_1");

      const workflow = startWheelPhase("section_1");

      expect(workflow.phase_type).toBe("wheel");
      expect(workflow.phase_metadata).toBeTruthy();

      const metadata = JSON.parse(workflow.phase_metadata!);
      expect(metadata.currentSpinner).toBeDefined();
      expect(metadata.spinnerIndex).toBe(0);
      expect(metadata.totalSpinners).toBeGreaterThan(0);
      expect(metadata.spinoffNumber).toBe(0);
      expect(metadata.needsSpinoff).toBe(false);
      expect(metadata.winnerId).toBeNull();
    });

    it("should throw error if game not started", () => {
      startNewGame();

      expect(() => startWheelPhase("section_1")).toThrow(
        "Cannot start wheel phase - game not started",
      );
    });

    it("should throw error if no eligible spinners", () => {
      const db = getDatabase();

      // Create players but don't make them bidding winners
      for (let i = 0; i < 3; i++) {
        db.prepare(
          `INSERT INTO players (first_name, last_name, role, active, access_code, photo_filename, weight)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          `Player${i}`,
          `Last${i}`,
          "audience",
          1,
          `code${i}`,
          `photo${i}.jpg`,
          1,
        );
      }

      updateGameWorkflow({
        phase_type: "bidding",
      });

      expect(() => startWheelPhase("section_1")).toThrow(
        "No eligible spinners for segment section_1",
      );
    });

    it("should clear previous wheel spins for segment", () => {
      const { players } = setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      // Record some spins
      processWheelSpin(players[0], "section_1");

      // Start again
      startWheelPhase("section_1");

      // Check spins were cleared
      const state = getCurrentState();
      expect(state.wheelSpins).toHaveLength(0);
    });
  });

  describe("processWheelSpin", () => {
    it("should record a spin for eligible player", () => {
      const { players } = setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const result = processWheelSpin(players[0], "section_1");

      expect(result.spin).toBeDefined();
      expect(result.spin.player_id).toBe(players[0]);
      expect(result.spin.game_segment).toBe("section_1");
      expect(result.spin.result).toBeGreaterThan(0);
      expect(result.spin.result).toBeLessThanOrEqual(1.0);
      expect(result.total).toBe(result.spin.result);
      expect(result.eliminated).toBe(result.total > 1.0);
      expect(result.canSpinAgain).toBeDefined();
    });

    it("should throw error if wrong phase", () => {
      const { players } = setupGameWithBiddingWinners("section_1");

      expect(() => processWheelSpin(players[0], "section_1")).toThrow(
        "Cannot spin - current phase is bidding",
      );
    });

    it("should throw error if player not eligible", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const nonWinner = db
        .prepare(
          `INSERT INTO players (first_name, last_name, role, active, access_code, photo_filename, weight)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("NonWinner", "Test", "audience", 1, "code999", "photo999.jpg", 1);

      expect(() =>
        processWheelSpin(nonWinner.lastInsertRowid as number, "section_1"),
      ).toThrow("is not eligible to spin");
    });

    it("should throw error if player already eliminated", () => {
      const { players } = setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();

      // Manually create spins that eliminate player (total > 1.00)
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(players[0], "section_1", 1, 0.6, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(players[0], "section_1", 2, 0.5, 0);

      expect(() => processWheelSpin(players[0], "section_1")).toThrow(
        "is eliminated and cannot spin",
      );
    });

    it("should throw error if max spins reached", () => {
      const { players } = setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();

      // Manually create 2 spins (max for regular round)
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(players[0], "section_1", 1, 0.35, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(players[0], "section_1", 2, 0.4, 0);

      expect(() => processWheelSpin(players[0], "section_1")).toThrow(
        "has reached maximum spins",
      );
    });

    it("should update metadata with last spin result", () => {
      const { players } = setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      processWheelSpin(players[0], "section_1");

      const state = getCurrentState();
      const metadata = state.workflow.phase_metadata
        ? JSON.parse(state.workflow.phase_metadata)
        : {};

      expect(metadata.lastSpin).toBeDefined();
      expect(metadata.lastSpin.playerId).toBe(players[0]);
      expect(metadata.lastSpin.value).toBeGreaterThan(0);
      expect(metadata.lastSpin.total).toBeDefined();
      expect(metadata.lastSpin.eliminated).toBeDefined();
    });
  });

  describe("completePlayerWheelTurn", () => {
    it("should advance to next player when not all finished", () => {
      const { players } = setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      // Player 0 spins once
      processWheelSpin(players[0], "section_1");

      // Complete turn
      const result = completePlayerWheelTurn(players[0], "section_1");

      expect(result.allPlayersFinished).toBe(false);
      expect(result.needsSpinoff).toBe(false);
      expect(result.winnerId).toBeNull();

      // Check current spinner advanced
      const state = getCurrentState();
      expect(state.currentSpinner).not.toBe(players[0]);
    });

    it("should detect winner when all players finished", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Give each player maximum spins (2 spins) with different totals, none eliminated
      eligibleSpinners.forEach((spinner, index) => {
        const firstSpin = 0.3 + index * 0.05; // Different first spins
        const secondSpin = 0.2; // Same second spin
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(spinner.player_id, "section_1", 1, firstSpin, 0);
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(spinner.player_id, "section_1", 2, secondSpin, 0);
      });

      // Complete turn for last player
      const result = completePlayerWheelTurn(
        eligibleSpinners[eligibleSpinners.length - 1].player_id,
        "section_1",
      );

      expect(result.allPlayersFinished).toBe(true);
      expect(result.needsSpinoff).toBe(false);
      expect(result.winnerId).toBeDefined();
    });

    it("should detect tie when all players finished with same total", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Give first two players same total (0.75) with 2 spins each
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.5, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 2, 0.25, 0);

      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 1, 0.4, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 2, 0.35, 0);

      // Give others lower totals with 2 spins
      for (let i = 2; i < eligibleSpinners.length; i++) {
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(eligibleSpinners[i].player_id, "section_1", 1, 0.3, 0);
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(eligibleSpinners[i].player_id, "section_1", 2, 0.15, 0);
      }

      const result = completePlayerWheelTurn(
        eligibleSpinners[eligibleSpinners.length - 1].player_id,
        "section_1",
      );

      expect(result.allPlayersFinished).toBe(true);
      expect(result.needsSpinoff).toBe(true);
      expect(result.winnerId).toBeNull();
      expect(result.tiedPlayerIds).toHaveLength(2);
    });

    it("should throw error if wrong phase", () => {
      const { players } = setupGameWithBiddingWinners("section_1");

      expect(() => completePlayerWheelTurn(players[0], "section_1")).toThrow(
        "Cannot complete turn - current phase is bidding",
      );
    });
  });

  describe("startWheelSpinOff", () => {
    it("should initialize spinoff round", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Create a tie
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.75, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 1, 0.75, 0);

      for (let i = 2; i < eligibleSpinners.length; i++) {
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(eligibleSpinners[i].player_id, "section_1", 1, 0.5, 0);
      }

      const workflow = startWheelSpinOff("section_1", 1);

      expect(workflow.phase_type).toBe("wheel");
      const metadata = JSON.parse(workflow.phase_metadata!);
      expect(metadata.spinoffNumber).toBe(1);
      expect(metadata.totalSpinners).toBe(2);
      expect(metadata.tiedPlayerIds).toHaveLength(2);
      expect(metadata.needsSpinoff).toBe(false);
      expect(metadata.winnerId).toBeNull();
    });

    it("should throw error if no tie exists", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Give players different totals (no tie)
      eligibleSpinners.forEach((spinner, index) => {
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(spinner.player_id, "section_1", 1, 0.5 + index * 0.1, 0);
      });

      expect(() => startWheelSpinOff("section_1", 1)).toThrow(
        "Cannot start spinoff - no tie detected",
      );
    });

    it("should throw error if wrong phase", () => {
      setupGameWithBiddingWinners("section_1");

      expect(() => startWheelSpinOff("section_1", 1)).toThrow(
        "Cannot start spinoff - current phase is bidding",
      );
    });
  });

  describe("determineWheelWinner", () => {
    it("should return winner when clear leader exists", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Give players different totals
      eligibleSpinners.forEach((spinner, index) => {
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(spinner.player_id, "section_1", 1, 0.4 + index * 0.1, 0);
      });

      const result = determineWheelWinner("section_1");

      expect(result.isTie).toBe(false);
      expect(result.winnerId).toBeDefined();
      expect(result.tiedPlayerIds).toHaveLength(0);
    });

    it("should return tie info when players tied", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Create a tie
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.85, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 1, 0.85, 0);

      for (let i = 2; i < eligibleSpinners.length; i++) {
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(eligibleSpinners[i].player_id, "section_1", 1, 0.5, 0);
      }

      const result = determineWheelWinner("section_1");

      expect(result.isTie).toBe(true);
      expect(result.winnerId).toBeNull();
      expect(result.tiedPlayerIds).toHaveLength(2);
    });
  });

  describe("getCurrentState with wheel phase", () => {
    it("should include wheel spins in state", () => {
      const { players } = setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      processWheelSpin(players[0], "section_1");

      const state = getCurrentState();

      expect(state.workflow.phase_type).toBe("wheel");
      expect(state.wheelSpins).toBeDefined();
      expect(state.wheelSpins).toHaveLength(1);
      expect(state.currentSpinner).toBeDefined();
      expect(state.playerTotals).toBeDefined();
      expect(state.spinoffNumber).toBe(0);
    });

    it("should include player totals and elimination status", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Give some players spins
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.5, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 1, 0.65, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 2, 0.5, 0); // 1.15 - eliminated

      const state = getCurrentState();

      expect(state.playerTotals).toBeDefined();
      expect(state.playerTotals!.length).toBeGreaterThan(0);

      const player1Total = state.playerTotals!.find(
        (p) => p.player_id === eligibleSpinners[1].player_id,
      );
      expect(player1Total).toBeDefined();
      expect(player1Total!.total).toBe(1.15);
      expect(player1Total!.eliminated).toBe(true);
    });

    it("should not include wheel data when not in wheel phase", () => {
      setupGameWithBiddingWinners("section_1");

      const state = getCurrentState();

      expect(state.workflow.phase_type).toBe("bidding");
      expect(state.wheelSpins).toBeUndefined();
      expect(state.currentSpinner).toBeUndefined();
      expect(state.playerTotals).toBeUndefined();
    });
  });

  describe("Edge Cases & Critical Scenarios", () => {
    it("should handle all players eliminated (all over $1.00)", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // All players go over $1.00
      eligibleSpinners.forEach((spinner) => {
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(spinner.player_id, "section_1", 1, 0.6, 0);
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(spinner.player_id, "section_1", 2, 0.5, 0); // 1.10 total
      });

      const result = determineWheelWinner("section_1");

      // Should return null when no valid players
      expect(result.isTie).toBe(false);
      expect(result.winnerId).toBeNull();
      expect(result.tiedPlayerIds).toHaveLength(0);
    });

    it("should handle perfect $1.00 on first spin", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Player spins exactly $1.00
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 1.0, 0);

      // Player should NOT be eliminated
      const eliminated = db
        .prepare(
          `SELECT * FROM wheel_spins 
           WHERE player_id = ? AND game_segment = ? AND spinoff_number = ?`,
        )
        .all(eligibleSpinners[0].player_id, "section_1", 0) as Array<{
        result: number;
      }>;

      const total = eliminated.reduce((sum, spin) => sum + spin.result, 0);
      expect(total).toBe(1.0);
      expect(total).not.toBeGreaterThan(1.0); // Should be exactly 1.00, not eliminated
    });

    it("should handle multiple players with perfect $1.00 (tie scenario)", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Two players get exactly $1.00
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.5, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 2, 0.5, 0); // Exactly 1.00

      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 1, 1.0, 0); // Exactly 1.00

      // Give third player lower total
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[2].player_id, "section_1", 1, 0.75, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[2].player_id, "section_1", 2, 0.2, 0); // 0.95

      const result = determineWheelWinner("section_1");

      // Should detect tie between two players with $1.00
      expect(result.isTie).toBe(true);
      expect(result.winnerId).toBeNull();
      expect(result.tiedPlayerIds).toHaveLength(2);
    });

    it("should properly isolate segments (section_1 vs section_2)", () => {
      const db = getDatabase();

      // Set up section_1
      const section1Players: number[] = [];
      for (let i = 0; i < 3; i++) {
        const result = db
          .prepare(
            `INSERT INTO players (first_name, last_name, role, active, access_code, photo_filename, weight)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            `Section1Player${i}`,
            `Last${i}`,
            "audience",
            1,
            `s1code${i}`,
            `photo${i}.jpg`,
            1,
          );
        section1Players.push(result.lastInsertRowid as number);
        addContestantToRow(
          result.lastInsertRowid as number,
          i + 1,
          "section_1",
          "won",
        );
      }

      // Set up section_2 with different players
      const section2Players: number[] = [];
      for (let i = 0; i < 3; i++) {
        const result = db
          .prepare(
            `INSERT INTO players (first_name, last_name, role, active, access_code, photo_filename, weight)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            `Section2Player${i}`,
            `Last${i}`,
            "audience",
            1,
            `s2code${i}`,
            `photo${i}.jpg`,
            1,
          );
        section2Players.push(result.lastInsertRowid as number);
        addContestantToRow(
          result.lastInsertRowid as number,
          i + 1,
          "section_2",
          "won",
        );
      }

      // Add bids for section_1
      section1Players.forEach((playerId) => {
        db.prepare(
          `INSERT INTO bids (player_id, game_segment, round_number, retry_number, bid_amount, product_id, is_winner)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(playerId, "section_1", 1, 0, 1000, "product_1", 1);
      });

      // Add bids for section_2
      section2Players.forEach((playerId) => {
        db.prepare(
          `INSERT INTO bids (player_id, game_segment, round_number, retry_number, bid_amount, product_id, is_winner)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(playerId, "section_2", 1, 0, 2000, "product_2", 1);
      });

      updateGameWorkflow({
        current_segment: "section_1",
        phase_type: "bidding",
      });

      startWheelPhase("section_1");

      // Add spins to section_1
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(section1Players[0], "section_1", 1, 0.75, 0);

      // Verify section_2 has no spins
      const section2Spins = db
        .prepare(`SELECT * FROM wheel_spins WHERE game_segment = ?`)
        .all("section_2");

      expect(section2Spins).toHaveLength(0);

      // Verify section_1 has spins
      const section1Spins = db
        .prepare(`SELECT * FROM wheel_spins WHERE game_segment = ?`)
        .all("section_1");

      expect(section1Spins).toHaveLength(1);
    });

    it("should handle player with 1 spin choosing to stay", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Player spins once and gets a good value
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.85, 0);

      // Verify they have only 1 spin
      const spins = db
        .prepare(
          `SELECT * FROM wheel_spins WHERE player_id = ? AND game_segment = ?`,
        )
        .all(eligibleSpinners[0].player_id, "section_1");

      expect(spins).toHaveLength(1);

      // They should still be able to complete their turn
      const result = completePlayerWheelTurn(
        eligibleSpinners[0].player_id,
        "section_1",
      );

      expect(result.allPlayersFinished).toBe(false); // Others haven't spun yet
    });

    it("should enforce spinoff has only 1 spin per player", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Create a tie to trigger spinoff
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.9, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 1, 0.9, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[2].player_id, "section_1", 1, 0.7, 0);

      // All need 2 spins to be "done" in regular round
      eligibleSpinners.forEach((spinner) => {
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(spinner.player_id, "section_1", 2, 0.05, 0);
      });

      startWheelSpinOff("section_1", 1);

      // Give first tied player 1 spinoff spin
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.5, 1);

      // Verify they can't spin again in spinoff
      expect(() =>
        processWheelSpin(eligibleSpinners[0].player_id, "section_1"),
      ).toThrow("has reached maximum spins");
    });

    it("should verify winner has highest valid total", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Give players different totals
      const totals = [0.95, 0.8, 0.7]; // Player 0 should win with 0.95
      eligibleSpinners.forEach((spinner, index) => {
        if (index < totals.length) {
          db.prepare(
            `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
             VALUES (?, ?, ?, ?, ?)`,
          ).run(spinner.player_id, "section_1", 1, totals[index], 0);
          db.prepare(
            `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
             VALUES (?, ?, ?, ?, ?)`,
          ).run(spinner.player_id, "section_1", 2, 0.05, 0);
        }
      });

      const result = determineWheelWinner("section_1");

      expect(result.isTie).toBe(false);
      expect(result.winnerId).toBe(eligibleSpinners[0].player_id); // Player with 0.95 + 0.05 = 1.00
    });

    it("should throw error when completing turn for player with no spins", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const eligibleSpinners = getEligibleSpinners("section_1");

      // Try to complete turn without any spins
      expect(() =>
        completePlayerWheelTurn(eligibleSpinners[0].player_id, "section_1"),
      ).toThrow(); // Should fail because player hasn't met minimum requirements
    });

    it("should handle when not all players are truly finished (some can still spin)", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Give all players just 1 spin each (they could still spin again)
      eligibleSpinners.forEach((spinner) => {
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(spinner.player_id, "section_1", 1, 0.75, 0);
      });

      // Try to complete turn for last player
      const result = completePlayerWheelTurn(
        eligibleSpinners[eligibleSpinners.length - 1].player_id,
        "section_1",
      );

      // Should NOT be all finished since everyone can still spin again
      expect(result.allPlayersFinished).toBe(false);
    });

    it("should handle multiple consecutive spinoffs", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Round 1: Create initial tie
      eligibleSpinners.forEach((spinner, index) => {
        if (index < 2) {
          db.prepare(
            `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
             VALUES (?, ?, ?, ?, ?)`,
          ).run(spinner.player_id, "section_1", 1, 0.85, 0);
        } else {
          db.prepare(
            `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
             VALUES (?, ?, ?, ?, ?)`,
          ).run(spinner.player_id, "section_1", 1, 0.7, 0);
        }
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(spinner.player_id, "section_1", 2, 0.05, 0);
      });

      // Start spinoff 1
      const workflow1 = startWheelSpinOff("section_1", 1);
      const metadata1 = JSON.parse(workflow1.phase_metadata!);
      expect(metadata1.spinoffNumber).toBe(1);
      expect(metadata1.totalSpinners).toBe(2);

      // Spinoff 1: Both players tie AGAIN
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.95, 1);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 1, 0.95, 1);

      // Start spinoff 2
      const workflow2 = startWheelSpinOff("section_1", 2);
      const metadata2 = JSON.parse(workflow2.phase_metadata!);
      expect(metadata2.spinoffNumber).toBe(2);
      expect(metadata2.totalSpinners).toBe(2);

      // Spinoff 2: Different results
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.8, 2);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 1, 0.75, 2);

      // Now should have a winner
      const winner = determineWheelWinner("section_1");
      expect(winner.isTie).toBe(false);
      expect(winner.winnerId).toBe(eligibleSpinners[0].player_id);
    });

    it("should throw error when starting spinoff while previous spinoff incomplete", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Create initial tie
      eligibleSpinners.forEach((spinner, index) => {
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(spinner.player_id, "section_1", 1, index < 2 ? 0.9 : 0.7, 0);
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(spinner.player_id, "section_1", 2, 0.05, 0);
      });

      startWheelSpinOff("section_1", 1);

      // Only one player spins in spinoff 1
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.8, 1);

      // Try to start spinoff 2 before spinoff 1 is complete
      expect(() => startWheelSpinOff("section_1", 2)).toThrow(
        "Cannot start spinoff - no tie detected",
      );
    });

    it("should handle metadata currentSpinner correctly across turns", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const eligibleSpinners = getEligibleSpinners("section_1");

      // Check initial current spinner
      let state = getCurrentState();
      const initialSpinner = state.currentSpinner;
      expect(initialSpinner).toBe(eligibleSpinners[0].player_id);

      // First player spins
      processWheelSpin(eligibleSpinners[0].player_id, "section_1");
      completePlayerWheelTurn(eligibleSpinners[0].player_id, "section_1");

      // Current spinner should advance to second player
      state = getCurrentState();
      expect(state.currentSpinner).toBe(eligibleSpinners[1].player_id);
      expect(state.currentSpinner).not.toBe(initialSpinner);
    });

    it("should properly track elimination status in metadata after player eliminated", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Eliminate first player
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.6, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 2, 0.5, 0); // 1.10 - eliminated

      const state = getCurrentState();
      const eliminatedPlayer = state.playerTotals?.find(
        (p) => p.player_id === eligibleSpinners[0].player_id,
      );

      expect(eliminatedPlayer).toBeDefined();
      expect(eliminatedPlayer!.eliminated).toBe(true);
      expect(eliminatedPlayer!.total).toBe(1.1);
    });

    it("should handle three-way tie scenario", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // setupGameWithBiddingWinners creates 3 bidding winners (players 0, 1, 2)
      // getEligibleSpinners now returns only bidding winners (is_winner = 1)
      // So we have 3 eligible spinners, and we'll tie all 3 at 0.85

      eligibleSpinners.forEach((spinner) => {
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(spinner.player_id, "section_1", 1, 0.4, 0);
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(spinner.player_id, "section_1", 2, 0.45, 0); // Total: 0.85
      });

      const result = determineWheelWinner("section_1");

      expect(result.isTie).toBe(true);
      expect(result.winnerId).toBeNull();
      expect(result.tiedPlayerIds).toHaveLength(3); // All three bidding winners tied
    });

    it("should handle when player gets exactly $1.00 on second spin", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Player gets 0.45 first, then 0.55 to make exactly $1.00
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.45, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 2, 0.55, 0);

      // Others get lower totals
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 1, 0.8, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[2].player_id, "section_1", 1, 0.75, 0);

      // Give them second spins to be "done"
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 2, 0.05, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[2].player_id, "section_1", 2, 0.05, 0);

      const result = determineWheelWinner("section_1");

      expect(result.isTie).toBe(false);
      expect(result.winnerId).toBe(eligibleSpinners[0].player_id);
    });

    it("should validate spinoff number matches metadata", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Metadata says spinoffNumber = 0 (regular round)
      const state = getCurrentState();
      const metadata = JSON.parse(state.workflow.phase_metadata!);
      expect(metadata.spinoffNumber).toBe(0);

      // Try to manually insert a spin with wrong spinoff number
      // This tests data integrity - spins should match current metadata
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.75, 99); // Wrong spinoff

      // When we get player total for current round, it shouldn't include wrong spinoff
      const db2 = getDatabase();
      const correctSpins = db2
        .prepare(
          `SELECT * FROM wheel_spins 
           WHERE player_id = ? AND game_segment = ? AND spinoff_number = ?`,
        )
        .all(eligibleSpinners[0].player_id, "section_1", 0);

      expect(correctSpins).toHaveLength(0); // Shouldn't find the wrong spinoff spin
    });

    it("should handle when only one player isn't eliminated", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Eliminate all but last player
      for (let i = 0; i < eligibleSpinners.length - 1; i++) {
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(eligibleSpinners[i].player_id, "section_1", 1, 0.6, 0);
        db.prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(eligibleSpinners[i].player_id, "section_1", 2, 0.5, 0); // 1.10 - eliminated
      }

      // Last player gets valid total
      const lastPlayer = eligibleSpinners[eligibleSpinners.length - 1];
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(lastPlayer.player_id, "section_1", 1, 0.75, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(lastPlayer.player_id, "section_1", 2, 0.1, 0); // 0.85

      const result = determineWheelWinner("section_1");

      expect(result.isTie).toBe(false);
      expect(result.winnerId).toBe(lastPlayer.player_id);
    });
  });

  describe("REGRESSION: Wheel Turn Advancement With Eliminations (Bug Fix)", () => {
    /**
     * CRITICAL REGRESSION TEST
     * Bug: Eliminated player reappeared as current spinner
     * Symptom: Player 1 eliminated (>$1.00), Player 2 completed turn, then Player 1 showed up again
     * Root Cause: completePlayerWheelTurn() didn't skip eliminated players when advancing
     * Fix: Added while loop to find next non-eliminated player who can spin
     */
    it("should skip eliminated player when advancing to next turn", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Player 0: Spins and gets $1.05 (ELIMINATED - went over)
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.55, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 2, 0.5, 0); // Total: $1.05 (OVER)

      // Complete Player 0's turn
      completePlayerWheelTurn(eligibleSpinners[0].player_id, "section_1");

      const state1 = getCurrentState();
      // Should advance to Player 1, not stay on Player 0
      expect(state1.currentSpinner).toBe(eligibleSpinners[1].player_id);
      expect(state1.currentSpinner).not.toBe(eligibleSpinners[0].player_id);

      // Player 1: Spins and stays at $0.85
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 1, 0.85, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 2, 0.0, 0); // Chose to stay

      completePlayerWheelTurn(eligibleSpinners[1].player_id, "section_1");

      const state2 = getCurrentState();
      // CRITICAL: Should skip Player 0 (eliminated) and go to Player 2
      expect(state2.currentSpinner).toBe(eligibleSpinners[2].player_id);
      expect(state2.currentSpinner).not.toBe(eligibleSpinners[0].player_id); // Must not be eliminated player!

      // Player 2: Spins and stays at $0.90
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[2].player_id, "section_1", 1, 0.9, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[2].player_id, "section_1", 2, 0.0, 0);

      completePlayerWheelTurn(eligibleSpinners[2].player_id, "section_1");

      const state3 = getCurrentState();
      // All turns complete, Player 2 wins with $0.90
      expect(state3.currentSpinner).toBeNull(); // Game should be over
    });

    it("should handle all players eliminated except one", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Player 0 goes over
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.6, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 2, 0.5, 0); // $1.10 - OVER

      completePlayerWheelTurn(eligibleSpinners[0].player_id, "section_1");

      // Should advance to Player 1
      let state = getCurrentState();
      expect(state.currentSpinner).toBe(eligibleSpinners[1].player_id);

      // Player 1 goes over
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 1, 0.65, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 2, 0.5, 0); // $1.15 - OVER

      completePlayerWheelTurn(eligibleSpinners[1].player_id, "section_1");

      // Should skip both eliminated players and go to Player 2
      state = getCurrentState();
      expect(state.currentSpinner).toBe(eligibleSpinners[2].player_id);

      // Player 2 should win automatically (only non-eliminated player)
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[2].player_id, "section_1", 1, 0.75, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[2].player_id, "section_1", 2, 0.05, 0);

      completePlayerWheelTurn(eligibleSpinners[2].player_id, "section_1");

      const finalState = getCurrentState();
      expect(finalState.currentSpinner).toBeNull(); // Game over

      // Verify Player 2 is the winner
      const winner = determineWheelWinner("section_1");
      expect(winner.winnerId).toBe(eligibleSpinners[2].player_id);
    });

    it("should handle multiple consecutive eliminated players", () => {
      // Set up game with 4 players instead of 3
      const db = getDatabase();

      // Create 4 test players
      const players: number[] = [];
      for (let i = 0; i < 4; i++) {
        const result = db
          .prepare(
            `INSERT INTO players (first_name, last_name, role, active, access_code, photo_filename, weight)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            `Player${i}`,
            `Last${i}`,
            "audience",
            1,
            `code${i}`,
            `photo${i}.jpg`,
            1,
          );
        players.push(result.lastInsertRowid as number);
      }

      // Add all 4 as bidding winners
      for (let i = 0; i < 4; i++) {
        addContestantToRow(players[i], i + 1, "section_1", "won");
        db.prepare(
          `INSERT INTO bids (player_id, game_segment, round_number, retry_number, bid_amount, product_id, is_winner)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          players[i],
          "section_1",
          i + 1,
          0,
          1000 + i * 100,
          "product_1",
          1,
        );
      }

      // Set up game workflow for bidding phase (required before starting wheel phase)
      updateGameWorkflow({
        current_segment: "section_1",
        current_segment_index: 3,
        phase_type: "bidding",
        phase_metadata: JSON.stringify({
          product_id: "product_4",
          round_number: 4,
          retry_number: 0,
        }),
      });

      startWheelPhase("section_1");

      const eligibleSpinners = getEligibleSpinners("section_1");
      expect(eligibleSpinners).toHaveLength(4);

      // Player 0: Eliminated
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.6, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 2, 0.5, 0); // $1.10

      completePlayerWheelTurn(eligibleSpinners[0].player_id, "section_1");

      // Player 1: Eliminated
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 1, 0.7, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 2, 0.4, 0); // $1.10

      completePlayerWheelTurn(eligibleSpinners[1].player_id, "section_1");

      // Player 2: Valid score
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[2].player_id, "section_1", 1, 0.85, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[2].player_id, "section_1", 2, 0.0, 0);

      completePlayerWheelTurn(eligibleSpinners[2].player_id, "section_1");

      // CRITICAL: Should skip Players 0 and 1 (both eliminated) and advance to Player 3
      const state = getCurrentState();
      expect(state.currentSpinner).toBe(eligibleSpinners[3].player_id);
      expect(state.currentSpinner).not.toBe(eligibleSpinners[0].player_id);
      expect(state.currentSpinner).not.toBe(eligibleSpinners[1].player_id);

      // Player 3: Valid score (wins)
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[3].player_id, "section_1", 1, 0.9, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[3].player_id, "section_1", 2, 0.0, 0);

      completePlayerWheelTurn(eligibleSpinners[3].player_id, "section_1");

      const finalState = getCurrentState();
      expect(finalState.currentSpinner).toBeNull();

      const winner = determineWheelWinner("section_1");
      expect(winner.winnerId).toBe(eligibleSpinners[3].player_id); // Player 3 wins with $0.90
    });

    it("should clear currentSpinner when wheel phase ends with winner", () => {
      setupGameWithBiddingWinners("section_1");
      startWheelPhase("section_1");

      const db = getDatabase();
      const eligibleSpinners = getEligibleSpinners("section_1");

      // Give all players different valid totals, Player 2 wins with highest
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 1, 0.75, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[0].player_id, "section_1", 2, 0.05, 0); // $0.80

      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 1, 0.8, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[1].player_id, "section_1", 2, 0.1, 0); // $0.90

      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[2].player_id, "section_1", 1, 0.85, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(eligibleSpinners[2].player_id, "section_1", 2, 0.1, 0); // $0.95 - WINNER

      // Complete final player's turn
      completePlayerWheelTurn(eligibleSpinners[2].player_id, "section_1");

      const state = getCurrentState();
      // CRITICAL REGRESSION: currentSpinner must be cleared when game ends
      expect(state.currentSpinner).toBeNull();
    });
  });
});
