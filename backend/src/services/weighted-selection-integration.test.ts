import { describe, it, expect } from "vitest";
import { createTestDb } from "../db/test-helper";
import { generateUniqueAccessCode } from "../utils/access-code";
import {
  selectWeightedRandom,
  selectWeightedRandomMultiple,
} from "../utils/weighted-selection";

/**
 * End-to-end integration test for weighted random selection
 * Verifies the weighted selection algorithm integrates correctly with database player data
 */
describe("Weighted Selection Integration", () => {
  it("should prioritize weight > 0 players over weight = 0 players when selecting from database", () => {
    const db = createTestDb();

    // Create players with different weights directly in database
    // Primary tier (weight > 0)
    const primaryPlayers = [];
    for (let i = 1; i <= 3; i++) {
      const code = generateUniqueAccessCode(db);
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role, weight) VALUES (?, ?, ?, ?, ?)",
      ).run(`Primary`, `Player${i}`, code, "player", 1.0);
      primaryPlayers.push({ access_code: code, weight: 1.0 });
    }

    // Backup tier (weight = 0)
    const backupPlayers = [];
    for (let i = 1; i <= 3; i++) {
      const code = generateUniqueAccessCode(db);
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role, weight) VALUES (?, ?, ?, ?, ?)",
      ).run(`Backup`, `Player${i}`, code, "player", 0.0);
      backupPlayers.push({ access_code: code, weight: 0.0 });
    }

    // Query all players from database
    const allPlayers = db
      .prepare(
        "SELECT access_code, weight FROM players WHERE role = ? ORDER BY weight DESC",
      )
      .all("player") as Array<{ access_code: string; weight: number }>;

    expect(allPlayers).toHaveLength(6);

    // Select 4 players using weighted selection (same as game would do)
    const selected = selectWeightedRandomMultiple(allPlayers, 4);

    expect(selected).toHaveLength(4);

    // Count selections from each tier
    const primaryCodes = primaryPlayers.map((p) => p.access_code);
    const backupCodes = backupPlayers.map((p) => p.access_code);

    const primarySelected = selected.filter((p) =>
      primaryCodes.includes(p.access_code),
    );
    const backupSelected = selected.filter((p) =>
      backupCodes.includes(p.access_code),
    );

    // Should select all 3 primary tier players first, then 1 backup
    expect(primarySelected).toHaveLength(3);
    expect(backupSelected).toHaveLength(1);

    db.close();
  });

  it("should respect weighted probabilities across multiple selections", () => {
    const db = createTestDb();

    // Create players with varying weights
    db.prepare(
      "INSERT INTO players (first_name, last_name, access_code, role, weight) VALUES (?, ?, ?, ?, ?)",
    ).run("High", "Weight", "HIGH01", "player", 1.0);

    db.prepare(
      "INSERT INTO players (first_name, last_name, access_code, role, weight) VALUES (?, ?, ?, ?, ?)",
    ).run("Low", "Weight", "LOW01", "player", 0.1);

    db.prepare(
      "INSERT INTO players (first_name, last_name, access_code, role, weight) VALUES (?, ?, ?, ?, ?)",
    ).run("Backup", "Weight", "BACK01", "player", 0.0);

    // Query players from database
    const players = db
      .prepare(
        "SELECT access_code, weight FROM players WHERE role = ? ORDER BY weight DESC",
      )
      .all("player") as Array<{ access_code: string; weight: number }>;

    // Run many selections to verify probability distribution
    const counts = {
      HIGH01: 0,
      LOW01: 0,
      BACK01: 0,
    };

    for (let i = 0; i < 100; i++) {
      const selected = selectWeightedRandom(players);
      if (selected) {
        counts[selected.access_code as keyof typeof counts]++;
      }
    }

    // HIGH should be selected most often
    expect(counts.HIGH01).toBeGreaterThan(counts.LOW01);
    // BACK should never be selected (others available)
    expect(counts.BACK01).toBe(0);

    db.close();
  });

  it("should fallback to weight=0 players when no weight>0 players available", () => {
    const db = createTestDb();

    // Create only backup tier players
    const backupPlayers = [];
    for (let i = 1; i <= 4; i++) {
      const code = generateUniqueAccessCode(db);
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role, weight) VALUES (?, ?, ?, ?, ?)",
      ).run(`Backup`, `Player${i}`, code, "player", 0.0);
      backupPlayers.push({ access_code: code });
    }

    // Query all players
    const allPlayers = db
      .prepare("SELECT access_code, weight FROM players WHERE role = ?")
      .all("player") as Array<{ access_code: string; weight: number }>;

    // Select using weighted selection
    const selected = selectWeightedRandom(allPlayers);

    // Should successfully select from backup tier
    expect(selected).toBeDefined();
    expect(selected?.weight).toBe(0.0);
    expect(backupPlayers.map((p) => p.access_code)).toContain(
      selected!.access_code,
    );

    db.close();
  });
});
