import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { getGameEnabled, setGameEnabled } from "./game-state.js";
import { runMigrations } from "./migrator.js";

describe("Game State Functions", () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database for each test
    db = new Database(":memory:");
    runMigrations(db);
  });

  describe("getGameEnabled", () => {
    it("should return true by default (from migration)", () => {
      const enabled = getGameEnabled(db);
      expect(enabled).toBe(true);
    });

    it("should return false when game is disabled", () => {
      setGameEnabled(db, false);
      const enabled = getGameEnabled(db);
      expect(enabled).toBe(false);
    });

    it("should return true when game is enabled", () => {
      setGameEnabled(db, true);
      const enabled = getGameEnabled(db);
      expect(enabled).toBe(true);
    });

    it("should handle missing game_enabled key gracefully", () => {
      // Delete the game_enabled key
      db.prepare("DELETE FROM game_state WHERE key = 'game_enabled'").run();

      // Should default to true when key doesn't exist
      const enabled = getGameEnabled(db);
      expect(enabled).toBe(true);
    });
  });

  describe("setGameEnabled", () => {
    it("should set game to disabled", () => {
      setGameEnabled(db, false);

      const row = db
        .prepare("SELECT value FROM game_state WHERE key = 'game_enabled'")
        .get() as { value: string } | undefined;

      expect(row).toBeDefined();
      expect(row?.value).toBe("false");
    });

    it("should set game to enabled", () => {
      setGameEnabled(db, true);

      const row = db
        .prepare("SELECT value FROM game_state WHERE key = 'game_enabled'")
        .get() as { value: string } | undefined;

      expect(row).toBeDefined();
      expect(row?.value).toBe("true");
    });

    it("should toggle game state multiple times", () => {
      // Start: true (from migration)
      expect(getGameEnabled(db)).toBe(true);

      // Toggle to false
      setGameEnabled(db, false);
      expect(getGameEnabled(db)).toBe(false);

      // Toggle to true
      setGameEnabled(db, true);
      expect(getGameEnabled(db)).toBe(true);

      // Toggle to false again
      setGameEnabled(db, false);
      expect(getGameEnabled(db)).toBe(false);
    });

    it("should update updated_at timestamp on each change", (done) => {
      // Set initial value
      setGameEnabled(db, false);
      const row1 = db
        .prepare("SELECT updated_at FROM game_state WHERE key = 'game_enabled'")
        .get() as { updated_at: string };

      // Wait 1 second to ensure timestamp difference (SQLite datetime has second precision)
      setTimeout(() => {
        // Update again
        setGameEnabled(db, true);
        const row2 = db
          .prepare(
            "SELECT updated_at FROM game_state WHERE key = 'game_enabled'",
          )
          .get() as { updated_at: string };

        // Timestamps should be different
        expect(row2.updated_at).not.toBe(row1.updated_at);
        done();
      }, 1100);
    });

    it("should use upsert logic (INSERT or UPDATE)", () => {
      // First call should INSERT
      setGameEnabled(db, false);
      const count1 = (
        db
          .prepare(
            "SELECT COUNT(*) as count FROM game_state WHERE key = 'game_enabled'",
          )
          .get() as {
          count: number;
        }
      ).count;
      expect(count1).toBe(1);

      // Second call should UPDATE (not insert a duplicate)
      setGameEnabled(db, true);
      const count2 = (
        db
          .prepare(
            "SELECT COUNT(*) as count FROM game_state WHERE key = 'game_enabled'",
          )
          .get() as {
          count: number;
        }
      ).count;
      expect(count2).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle rapid state changes", () => {
      for (let i = 0; i < 100; i++) {
        setGameEnabled(db, i % 2 === 0);
      }

      // Should end up false (i=99, odd)
      expect(getGameEnabled(db)).toBe(false);
    });

    it("should handle boolean conversion correctly", () => {
      // Set to false
      setGameEnabled(db, false);
      expect(getGameEnabled(db)).toBe(false);

      // Set to true
      setGameEnabled(db, true);
      expect(getGameEnabled(db)).toBe(true);
    });

    it("should persist state across reads", () => {
      setGameEnabled(db, false);

      // Read multiple times
      expect(getGameEnabled(db)).toBe(false);
      expect(getGameEnabled(db)).toBe(false);
      expect(getGameEnabled(db)).toBe(false);

      // State should remain consistent
      expect(getGameEnabled(db)).toBe(false);
    });
  });
});
