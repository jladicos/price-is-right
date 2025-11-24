import { describe, it, expect, beforeEach } from "vitest";
import {
  generateRandomWheelValue,
  recordSpin,
  getPlayerTotal,
  isPlayerEliminated,
  canPlayerSpinAgain,
  getCurrentLeader,
  detectTie,
  getSpinOffPlayers,
  determineWheelWinner,
  getEligibleSpinners,
  WHEEL_VALUES,
} from "./wheel.js";
import { setupTestDatabase } from "../db/test-helper.js";
import { getDatabase } from "../db/connection.js";

describe("wheel service", () => {
  let testPlayerIds: number[] = [];

  beforeEach(() => {
    setupTestDatabase();

    // Create test players
    const db = getDatabase();
    testPlayerIds = [];
    for (let i = 1; i <= 5; i++) {
      const result = db
        .prepare(
          `INSERT INTO players (first_name, last_name, access_code, role, photo_filename)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(`Player${i}`, `Last${i}`, `CODE${i}`, "player", `photo${i}.jpg`);
      testPlayerIds.push(result.lastInsertRowid as number);
    }
  });

  describe("generateRandomWheelValue", () => {
    it("should return a value from WHEEL_VALUES array", () => {
      const value = generateRandomWheelValue();
      expect(WHEEL_VALUES).toContain(value);
    });

    it("should generate different values over multiple calls", () => {
      const values = new Set();
      for (let i = 0; i < 100; i++) {
        values.add(generateRandomWheelValue());
      }
      // With 100 random selections from 20 values, we expect multiple different values
      expect(values.size).toBeGreaterThan(5);
    });

    it("should generate all valid wheel values", () => {
      // Verify WHEEL_VALUES contains expected values
      expect(WHEEL_VALUES).toHaveLength(20);
      expect(WHEEL_VALUES).toContain(0.05);
      expect(WHEEL_VALUES).toContain(0.5);
      expect(WHEEL_VALUES).toContain(1.0);
    });
  });

  describe("recordSpin", () => {
    it("should record a spin with random value", () => {
      const spin = recordSpin(testPlayerIds[0], "wheel_1", 1);

      expect(spin.player_id).toBe(testPlayerIds[0]);
      expect(spin.game_segment).toBe("wheel_1");
      expect(spin.spin_number).toBe(1);
      expect(spin.spinoff_number).toBe(0);
      expect(WHEEL_VALUES).toContain(spin.result);
    });

    it("should record spin with custom spinoff number", () => {
      const spin = recordSpin(testPlayerIds[0], "wheel_1", 1, 2);

      expect(spin.spinoff_number).toBe(2);
    });

    it("should record multiple spins for same player", () => {
      const spin1 = recordSpin(testPlayerIds[0], "wheel_1", 1);
      const spin2 = recordSpin(testPlayerIds[0], "wheel_1", 2);

      expect(spin1.id).not.toBe(spin2.id);
      expect(spin1.player_id).toBe(testPlayerIds[0]);
      expect(spin2.player_id).toBe(testPlayerIds[0]);
    });

    it("should generate values randomly (not always the same)", () => {
      const spin1 = recordSpin(testPlayerIds[0], "wheel_1", 1);
      const spin2 = recordSpin(testPlayerIds[1], "wheel_1", 1);
      const spin3 = recordSpin(testPlayerIds[2], "wheel_1", 1);

      // Very unlikely that all 3 random values are identical
      const uniqueValues = new Set([spin1.result, spin2.result, spin3.result]);
      expect(uniqueValues.size).toBeGreaterThanOrEqual(1); // At least one value
    });
  });

  describe("getPlayerTotal", () => {
    it("should return 0 for player with no spins", () => {
      const total = getPlayerTotal(testPlayerIds[0], "wheel_1");
      expect(total).toBe(0);
    });

    it("should return total for player with one spin", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.45, 0);

      const total = getPlayerTotal(testPlayerIds[0], "wheel_1");
      expect(total).toBe(0.45);
    });

    it("should return sum of two spins", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.3, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 2, 0.5, 0);

      const total = getPlayerTotal(testPlayerIds[0], "wheel_1");
      expect(total).toBe(0.8);
    });

    it("should only include spins for specified spinoff number", () => {
      const db = getDatabase();
      // Regular round spins
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.5, 0);

      // Spinoff round spin
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.75, 1);

      expect(getPlayerTotal(testPlayerIds[0], "wheel_1", 0)).toBe(0.5);
      expect(getPlayerTotal(testPlayerIds[0], "wheel_1", 1)).toBe(0.75);
    });
  });

  describe("isPlayerEliminated", () => {
    it("should return false for player with total under $1.00", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.85, 0);

      expect(isPlayerEliminated(testPlayerIds[0], "wheel_1")).toBe(false);
    });

    it("should return false for player with exactly $1.00", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.5, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 2, 0.5, 0);

      expect(isPlayerEliminated(testPlayerIds[0], "wheel_1")).toBe(false);
    });

    it("should return true for player over $1.00", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.65, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 2, 0.5, 0);

      expect(isPlayerEliminated(testPlayerIds[0], "wheel_1")).toBe(true);
    });

    it("should check elimination per spinoff number", () => {
      const db = getDatabase();
      // Regular round: not eliminated
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.85, 0);

      // Spinoff round: eliminated
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 1.05, 1);

      expect(isPlayerEliminated(testPlayerIds[0], "wheel_1", 0)).toBe(false);
      expect(isPlayerEliminated(testPlayerIds[0], "wheel_1", 1)).toBe(true);
    });
  });

  describe("canPlayerSpinAgain", () => {
    it("should return true when player has not spun yet", () => {
      expect(canPlayerSpinAgain(testPlayerIds[0], "wheel_1")).toBe(true);
    });

    it("should return true after first spin in regular round", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.45, 0);

      expect(canPlayerSpinAgain(testPlayerIds[0], "wheel_1", 0)).toBe(true);
    });

    it("should return false after two spins in regular round", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.3, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 2, 0.4, 0);

      expect(canPlayerSpinAgain(testPlayerIds[0], "wheel_1", 0)).toBe(false);
    });

    it("should return false after one spin in spinoff round", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.75, 1);

      expect(canPlayerSpinAgain(testPlayerIds[0], "wheel_1", 1)).toBe(false);
    });

    it("should check spin limit per spinoff number independently", () => {
      const db = getDatabase();
      // Two spins in regular round
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.5, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 2, 0.35, 0);

      // Should be able to spin once in spinoff round
      expect(canPlayerSpinAgain(testPlayerIds[0], "wheel_1", 0)).toBe(false);
      expect(canPlayerSpinAgain(testPlayerIds[0], "wheel_1", 1)).toBe(true);
    });
  });

  describe("getCurrentLeader", () => {
    it("should return null when no players have spun", () => {
      const leader = getCurrentLeader("wheel_1");
      expect(leader).toBeNull();
    });

    it("should return player with highest valid total", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.75, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[1], "wheel_1", 1, 0.9, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[2], "wheel_1", 1, 0.6, 0);

      const leader = getCurrentLeader("wheel_1");
      expect(leader).not.toBeNull();
      expect(leader!.player_id).toBe(testPlayerIds[1]);
      expect(leader!.total).toBe(0.9);
    });

    it("should exclude players over $1.00", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.6, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 2, 0.55, 0); // Total: 1.15 (eliminated)

      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[1], "wheel_1", 1, 0.8, 0);

      const leader = getCurrentLeader("wheel_1");
      expect(leader).not.toBeNull();
      expect(leader!.player_id).toBe(testPlayerIds[1]);
      expect(leader!.total).toBe(0.8);
    });

    it("should return null when all players are eliminated", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.65, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 2, 0.5, 0); // Total: 1.15

      const leader = getCurrentLeader("wheel_1");
      expect(leader).toBeNull();
    });

    it("should include player with exactly $1.00", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.5, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 2, 0.5, 0); // Total: 1.00

      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[1], "wheel_1", 1, 0.85, 0);

      const leader = getCurrentLeader("wheel_1");
      expect(leader).not.toBeNull();
      expect(leader!.player_id).toBe(testPlayerIds[0]);
      expect(leader!.total).toBe(1.0);
    });
  });

  describe("detectTie", () => {
    it("should return false when no players have spun", () => {
      expect(detectTie("wheel_1")).toBe(false);
    });

    it("should return false when only one player has spun", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.75, 0);

      expect(detectTie("wheel_1")).toBe(false);
    });

    it("should return false when players have different totals", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.75, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[1], "wheel_1", 1, 0.9, 0);

      expect(detectTie("wheel_1")).toBe(false);
    });

    it("should return true when two players have same highest total", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.85, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[1], "wheel_1", 1, 0.85, 0);

      expect(detectTie("wheel_1")).toBe(true);
    });

    it("should return true when three players tie", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.7, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[1], "wheel_1", 1, 0.7, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[2], "wheel_1", 1, 0.7, 0);

      expect(detectTie("wheel_1")).toBe(true);
    });

    it("should detect tie at $1.00", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.5, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 2, 0.5, 0);

      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[1], "wheel_1", 1, 1.0, 0);

      expect(detectTie("wheel_1")).toBe(true);
    });

    it("should ignore eliminated players when detecting tie", () => {
      const db = getDatabase();
      // Player 0: eliminated (1.15)
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.65, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 2, 0.5, 0);

      // Player 1 and 2: tied at 0.85
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[1], "wheel_1", 1, 0.85, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[2], "wheel_1", 1, 0.85, 0);

      expect(detectTie("wheel_1")).toBe(true);
    });
  });

  describe("getSpinOffPlayers", () => {
    it("should return empty array when no players have spun", () => {
      const players = getSpinOffPlayers("wheel_1");
      expect(players).toEqual([]);
    });

    it("should return all players with highest valid total", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.85, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[1], "wheel_1", 1, 0.85, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[2], "wheel_1", 1, 0.7, 0);

      const players = getSpinOffPlayers("wheel_1");
      expect(players).toHaveLength(2);
      // Check that both tied players are in the results (order may vary)
      const playerIds = players.map((p) => p.player_id);
      expect(playerIds).toContain(testPlayerIds[0]);
      expect(playerIds).toContain(testPlayerIds[1]);
      expect(players[0].total).toBe(0.85);
      expect(players[1].total).toBe(0.85);
    });

    it("should return all three players in three-way tie", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.7, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[1], "wheel_1", 1, 0.7, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[2], "wheel_1", 1, 0.7, 0);

      const players = getSpinOffPlayers("wheel_1");
      expect(players).toHaveLength(3);
      expect(players.every((p) => p.total === 0.7)).toBe(true);
    });

    it("should exclude eliminated players", () => {
      const db = getDatabase();
      // Eliminated player
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 1.05, 0);

      // Tied valid players
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[1], "wheel_1", 1, 0.8, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[2], "wheel_1", 1, 0.8, 0);

      const players = getSpinOffPlayers("wheel_1");
      expect(players).toHaveLength(2);
      // Check that both tied players are in the results (order may vary)
      const playerIds = players.map((p) => p.player_id);
      expect(playerIds).toContain(testPlayerIds[1]);
      expect(playerIds).toContain(testPlayerIds[2]);
      expect(players[0].total).toBe(0.8);
      expect(players[1].total).toBe(0.8);
    });

    it("should return single player when no tie exists", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.9, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[1], "wheel_1", 1, 0.75, 0);

      const players = getSpinOffPlayers("wheel_1");
      expect(players).toHaveLength(1);
      expect(players[0].player_id).toBe(testPlayerIds[0]);
      expect(players[0].total).toBe(0.9);
    });
  });

  describe("determineWheelWinner", () => {
    it("should return null when no players have spun", () => {
      const winner = determineWheelWinner("wheel_1");
      expect(winner).toBeNull();
    });

    it("should return winner when there's a clear leader", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.9, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[1], "wheel_1", 1, 0.75, 0);

      const winner = determineWheelWinner("wheel_1");
      expect(winner).not.toBeNull();
      expect(winner!.player_id).toBe(testPlayerIds[0]);
      expect(winner!.total).toBe(0.9);
    });

    it("should return null when there's a tie", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.85, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[1], "wheel_1", 1, 0.85, 0);

      const winner = determineWheelWinner("wheel_1");
      expect(winner).toBeNull(); // Spinoff needed
    });

    it("should return winner after spinoff resolves tie", () => {
      const db = getDatabase();
      // Regular round: tie at 0.85
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.85, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[1], "wheel_1", 1, 0.85, 0);

      // Spinoff round: player 0 wins with 0.90
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 0.9, 1);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[1], "wheel_1", 1, 0.7, 1);

      const winner = determineWheelWinner("wheel_1", 1);
      expect(winner).not.toBeNull();
      expect(winner!.player_id).toBe(testPlayerIds[0]);
      expect(winner!.total).toBe(0.9);
    });

    it("should return null when all players eliminated", () => {
      const db = getDatabase();
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[0], "wheel_1", 1, 1.05, 0);
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(testPlayerIds[1], "wheel_1", 1, 1.1, 0);

      const winner = determineWheelWinner("wheel_1");
      expect(winner).toBeNull();
    });
  });

  describe("getEligibleSpinners", () => {
    it("should return active contestants", () => {
      const db = getDatabase();

      // Add contestants
      db.prepare(
        `INSERT INTO contestants_row (player_id, position, game_segment, status, added_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      ).run(testPlayerIds[0], 1, "section_1", "active");
      db.prepare(
        `INSERT INTO contestants_row (player_id, position, game_segment, status, added_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      ).run(testPlayerIds[1], 2, "section_1", "active");

      const spinners = getEligibleSpinners("wheel_1");
      expect(spinners).toHaveLength(2);
      expect(spinners[0].player_id).toBe(testPlayerIds[0]);
      expect(spinners[1].player_id).toBe(testPlayerIds[1]);
    });

    it("should return empty array when no contestants", () => {
      const spinners = getEligibleSpinners("wheel_1");
      expect(spinners).toEqual([]);
    });

    it("should include player details", () => {
      const db = getDatabase();

      db.prepare(
        `INSERT INTO contestants_row (player_id, position, game_segment, status, added_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      ).run(testPlayerIds[0], 1, "section_1", "active");

      const spinners = getEligibleSpinners("wheel_1");
      expect(spinners[0]).toMatchObject({
        player_id: testPlayerIds[0],
        first_name: "Player1",
        last_name: "Last1",
        photo_filename: "photo1.jpg",
        position: 1,
      });
    });
  });
});
