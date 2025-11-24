import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createWheelSpin,
  getWheelSpinsForPlayer,
  getAllWheelSpinsForSegment,
  getPlayerWheelTotal,
  getPlayerSpinCount,
  deleteWheelSpinsForSegment,
  deleteAllWheelSpins,
  getPlayerTotalsForSegment,
} from "./wheel-spins.js";
import { setupTestDatabase, cleanupTestDatabase } from "./test-helper.js";
import { getDatabase } from "./connection.js";

describe("wheel-spins database", () => {
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

  // Counter to ensure unique access codes
  let playerCounter = 0;

  // Helper function to add a player
  function addPlayer(
    firstName: string,
    lastName: string,
    email: string,
    photo: string,
  ): { id: number } {
    const db = getDatabase();
    const result = db
      .prepare(
        `INSERT INTO players (first_name, last_name, email, access_code, role, photo_filename)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        firstName,
        lastName,
        email,
        `CODE_${Date.now()}_${playerCounter++}`,
        "player",
        photo,
      );
    return { id: result.lastInsertRowid as number };
  }

  describe("createWheelSpin", () => {
    it("should create a wheel spin with all required fields", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      const spin = createWheelSpin(player.id, "wheel_1", 1, 0.45, 0);

      expect(spin).toBeDefined();
      expect(spin.id).toBeGreaterThan(0);
      expect(spin.player_id).toBe(player.id);
      expect(spin.game_segment).toBe("wheel_1");
      expect(spin.spin_number).toBe(1);
      expect(spin.result).toBe(0.45);
      expect(spin.spinoff_number).toBe(0);
      expect(spin.created_at).toBeDefined();
    });

    it("should create spin with default spinoff_number of 0", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      const spin = createWheelSpin(player.id, "wheel_1", 1, 0.75);

      expect(spin.spinoff_number).toBe(0);
    });

    it("should create multiple spins for same player", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      const spin1 = createWheelSpin(player.id, "wheel_1", 1, 0.3);
      const spin2 = createWheelSpin(player.id, "wheel_1", 2, 0.5);

      expect(spin1.id).not.toBe(spin2.id);
      expect(spin1.player_id).toBe(player.id);
      expect(spin2.player_id).toBe(player.id);
    });

    it("should create spins with different values", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      const spin1 = createWheelSpin(player.id, "wheel_1", 1, 0.05);
      const spin2 = createWheelSpin(player.id, "wheel_1", 1, 1.0);

      expect(spin1.result).toBe(0.05);
      expect(spin2.result).toBe(1.0);
    });

    it("should create spinoff spins", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      const spin = createWheelSpin(player.id, "wheel_1", 1, 0.85, 1);

      expect(spin.spinoff_number).toBe(1);
    });
  });

  describe("getWheelSpinsForPlayer", () => {
    it("should return all spins for a player in a segment", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      createWheelSpin(player.id, "wheel_1", 1, 0.3);
      createWheelSpin(player.id, "wheel_1", 2, 0.5);

      const spins = getWheelSpinsForPlayer(player.id, "wheel_1");

      expect(spins).toHaveLength(2);
      expect(spins[0].result).toBe(0.3);
      expect(spins[1].result).toBe(0.5);
    });

    it("should return empty array if player has no spins", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      const spins = getWheelSpinsForPlayer(player.id, "wheel_1");

      expect(spins).toHaveLength(0);
    });

    it("should only return spins for specified segment", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      createWheelSpin(player.id, "wheel_1", 1, 0.3);
      createWheelSpin(player.id, "wheel_2", 1, 0.5);

      const spins = getWheelSpinsForPlayer(player.id, "wheel_1");

      expect(spins).toHaveLength(1);
      expect(spins[0].game_segment).toBe("wheel_1");
    });

    it("should return spins in chronological order", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      const spin1 = createWheelSpin(player.id, "wheel_1", 1, 0.3);
      const spin2 = createWheelSpin(player.id, "wheel_1", 2, 0.5);

      const spins = getWheelSpinsForPlayer(player.id, "wheel_1");

      expect(spins[0].id).toBe(spin1.id);
      expect(spins[1].id).toBe(spin2.id);
    });
  });

  describe("getAllWheelSpinsForSegment", () => {
    it("should return all spins for a segment with player info", () => {
      const player1 = addPlayer(
        "Alice",
        "Smith",
        "alice@example.com",
        "alice.jpg",
      );
      const player2 = addPlayer("Bob", "Jones", "bob@example.com", "bob.jpg");

      createWheelSpin(player1.id, "wheel_1", 1, 0.3);
      createWheelSpin(player2.id, "wheel_1", 1, 0.5);

      const spins = getAllWheelSpinsForSegment("wheel_1");

      expect(spins).toHaveLength(2);
      expect(spins[0].first_name).toBe("Alice");
      expect(spins[1].first_name).toBe("Bob");
    });

    it("should return empty array if no spins in segment", () => {
      const spins = getAllWheelSpinsForSegment("wheel_1");

      expect(spins).toHaveLength(0);
    });

    it("should only return spins for specified segment", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      createWheelSpin(player.id, "wheel_1", 1, 0.3);
      createWheelSpin(player.id, "wheel_2", 1, 0.5);

      const spins = getAllWheelSpinsForSegment("wheel_1");

      expect(spins).toHaveLength(1);
      expect(spins[0].game_segment).toBe("wheel_1");
    });
  });

  describe("getPlayerWheelTotal", () => {
    it("should return sum of player's spins", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      createWheelSpin(player.id, "wheel_1", 1, 0.3);
      createWheelSpin(player.id, "wheel_1", 2, 0.5);

      const total = getPlayerWheelTotal(player.id, "wheel_1");

      expect(total).toBe(0.8);
    });

    it("should return 0 if player has no spins", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      const total = getPlayerWheelTotal(player.id, "wheel_1");

      expect(total).toBe(0);
    });

    it("should only sum spins for specified segment", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      createWheelSpin(player.id, "wheel_1", 1, 0.3);
      createWheelSpin(player.id, "wheel_2", 1, 0.5);

      const total = getPlayerWheelTotal(player.id, "wheel_1");

      expect(total).toBe(0.3);
    });

    it("should handle single spin", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      createWheelSpin(player.id, "wheel_1", 1, 0.65);

      const total = getPlayerWheelTotal(player.id, "wheel_1");

      expect(total).toBe(0.65);
    });

    it("should only sum spins for specified spinoff_number", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      createWheelSpin(player.id, "wheel_1", 1, 0.3, 0);
      createWheelSpin(player.id, "wheel_1", 2, 0.5, 0);
      createWheelSpin(player.id, "wheel_1", 1, 0.85, 1);

      const regularTotal = getPlayerWheelTotal(player.id, "wheel_1", 0);
      const spinoffTotal = getPlayerWheelTotal(player.id, "wheel_1", 1);

      expect(regularTotal).toBe(0.8);
      expect(spinoffTotal).toBe(0.85);
    });
  });

  describe("getPlayerSpinCount", () => {
    it("should return number of spins for player", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      createWheelSpin(player.id, "wheel_1", 1, 0.3);
      createWheelSpin(player.id, "wheel_1", 2, 0.5);

      const count = getPlayerSpinCount(player.id, "wheel_1");

      expect(count).toBe(2);
    });

    it("should return 0 if player has no spins", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      const count = getPlayerSpinCount(player.id, "wheel_1");

      expect(count).toBe(0);
    });

    it("should only count spins for specified segment", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      createWheelSpin(player.id, "wheel_1", 1, 0.3);
      createWheelSpin(player.id, "wheel_2", 1, 0.5);

      const count = getPlayerSpinCount(player.id, "wheel_1");

      expect(count).toBe(1);
    });

    it("should only count spins for specified spinoff_number", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      createWheelSpin(player.id, "wheel_1", 1, 0.3, 0);
      createWheelSpin(player.id, "wheel_1", 2, 0.5, 0);
      createWheelSpin(player.id, "wheel_1", 1, 0.85, 1);

      const regularCount = getPlayerSpinCount(player.id, "wheel_1", 0);
      const spinoffCount = getPlayerSpinCount(player.id, "wheel_1", 1);

      expect(regularCount).toBe(2);
      expect(spinoffCount).toBe(1);
    });
  });

  describe("deleteWheelSpinsForSegment", () => {
    it("should delete all spins for a segment", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      createWheelSpin(player.id, "wheel_1", 1, 0.3);
      createWheelSpin(player.id, "wheel_1", 2, 0.5);

      deleteWheelSpinsForSegment("wheel_1");

      const spins = getAllWheelSpinsForSegment("wheel_1");
      expect(spins).toHaveLength(0);
    });

    it("should only delete spins for specified segment", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      createWheelSpin(player.id, "wheel_1", 1, 0.3);
      createWheelSpin(player.id, "wheel_2", 1, 0.5);

      deleteWheelSpinsForSegment("wheel_1");

      const wheel1Spins = getAllWheelSpinsForSegment("wheel_1");
      const wheel2Spins = getAllWheelSpinsForSegment("wheel_2");

      expect(wheel1Spins).toHaveLength(0);
      expect(wheel2Spins).toHaveLength(1);
    });

    it("should not error if no spins exist", () => {
      expect(() => {
        deleteWheelSpinsForSegment("wheel_1");
      }).not.toThrow();
    });
  });

  describe("deleteAllWheelSpins", () => {
    it("should delete all wheel spins", () => {
      const player = addPlayer(
        "Test",
        "Player",
        "test@example.com",
        "photo.jpg",
      );

      createWheelSpin(player.id, "wheel_1", 1, 0.3);
      createWheelSpin(player.id, "wheel_2", 1, 0.5);

      deleteAllWheelSpins();

      const wheel1Spins = getAllWheelSpinsForSegment("wheel_1");
      const wheel2Spins = getAllWheelSpinsForSegment("wheel_2");

      expect(wheel1Spins).toHaveLength(0);
      expect(wheel2Spins).toHaveLength(0);
    });

    it("should not error if no spins exist", () => {
      expect(() => {
        deleteAllWheelSpins();
      }).not.toThrow();
    });
  });

  describe("getPlayerTotalsForSegment", () => {
    it("should return totals for all players in segment", () => {
      const player1 = addPlayer(
        "Alice",
        "Smith",
        "alice@example.com",
        "alice.jpg",
      );
      const player2 = addPlayer("Bob", "Jones", "bob@example.com", "bob.jpg");

      createWheelSpin(player1.id, "wheel_1", 1, 0.3);
      createWheelSpin(player1.id, "wheel_1", 2, 0.5);
      createWheelSpin(player2.id, "wheel_1", 1, 0.65);

      const totals = getPlayerTotalsForSegment("wheel_1");

      expect(totals).toHaveLength(2);
      expect(totals[0].player_id).toBe(player1.id);
      expect(totals[0].total).toBe(0.8);
      expect(totals[0].spin_count).toBe(2);
      expect(totals[1].player_id).toBe(player2.id);
      expect(totals[1].total).toBe(0.65);
      expect(totals[1].spin_count).toBe(1);
    });

    it("should return results ordered by total descending", () => {
      const player1 = addPlayer(
        "Alice",
        "Smith",
        "alice@example.com",
        "alice.jpg",
      );
      const player2 = addPlayer("Bob", "Jones", "bob@example.com", "bob.jpg");

      createWheelSpin(player1.id, "wheel_1", 1, 0.3);
      createWheelSpin(player2.id, "wheel_1", 1, 0.85);

      const totals = getPlayerTotalsForSegment("wheel_1");

      expect(totals[0].player_id).toBe(player2.id);
      expect(totals[0].total).toBe(0.85);
      expect(totals[1].player_id).toBe(player1.id);
      expect(totals[1].total).toBe(0.3);
    });

    it("should return empty array if no spins in segment", () => {
      const totals = getPlayerTotalsForSegment("wheel_1");

      expect(totals).toHaveLength(0);
    });

    it("should include player info", () => {
      const player = addPlayer(
        "Alice",
        "Smith",
        "alice@example.com",
        "alice.jpg",
      );

      createWheelSpin(player.id, "wheel_1", 1, 0.65);

      const totals = getPlayerTotalsForSegment("wheel_1");

      expect(totals[0].first_name).toBe("Alice");
      expect(totals[0].last_name).toBe("Smith");
      expect(totals[0].photo_filename).toBe("alice.jpg");
    });

    it("should only return totals for specified spinoff_number", () => {
      const player1 = addPlayer(
        "Alice",
        "Smith",
        "alice@example.com",
        "alice.jpg",
      );
      const player2 = addPlayer("Bob", "Jones", "bob@example.com", "bob.jpg");

      // Regular spins
      createWheelSpin(player1.id, "wheel_1", 1, 0.3, 0);
      createWheelSpin(player2.id, "wheel_1", 1, 0.5, 0);

      // Spinoff spins
      createWheelSpin(player1.id, "wheel_1", 1, 0.85, 1);
      createWheelSpin(player2.id, "wheel_1", 1, 0.9, 1);

      const regularTotals = getPlayerTotalsForSegment("wheel_1", 0);
      const spinoffTotals = getPlayerTotalsForSegment("wheel_1", 1);

      expect(regularTotals).toHaveLength(2);
      expect(regularTotals[0].total).toBe(0.5);
      expect(regularTotals[1].total).toBe(0.3);

      expect(spinoffTotals).toHaveLength(2);
      expect(spinoffTotals[0].total).toBe(0.9);
      expect(spinoffTotals[1].total).toBe(0.85);
    });
  });

  afterEach(() => {
    cleanupTestDatabase();
  });
});
