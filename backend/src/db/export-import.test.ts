import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import {
  exportDatabase,
  importDatabase,
  type DatabaseExport,
} from "./export-import.js";
import { runMigrations } from "./migrator.js";

describe("Export/Import Database Functions", () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database for each test
    db = new Database(":memory:");
    runMigrations(db);
  });

  describe("exportDatabase", () => {
    it("should export empty database with correct structure", () => {
      const exported = exportDatabase(db);

      expect(exported).toHaveProperty("version", "1.0");
      expect(exported).toHaveProperty("exportedAt");
      expect(exported).toHaveProperty("players");
      expect(exported).toHaveProperty("gameState");
      expect(Array.isArray(exported.players)).toBe(true);
      expect(Array.isArray(exported.gameState)).toBe(true);
      expect(exported.players).toHaveLength(0);
    });

    it("should export players with correct fields", () => {
      // Insert test player
      db.prepare(
        `INSERT INTO players (first_name, last_name, email, access_code, photo_filename, role, active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        "John",
        "Doe",
        "john@example.com",
        "JOHN01",
        "john.jpg",
        "player",
        1,
      );

      const exported = exportDatabase(db);

      expect(exported.players).toHaveLength(1);
      const player = exported.players[0];
      expect(player).toHaveProperty("id");
      expect(player).toHaveProperty("firstName", "John");
      expect(player).toHaveProperty("lastName", "Doe");
      expect(player).toHaveProperty("email", "john@example.com");
      expect(player).toHaveProperty("accessCode", "JOHN01");
      expect(player).toHaveProperty("photoFilename", "john.jpg");
      expect(player).toHaveProperty("role", "player");
      expect(player).toHaveProperty("active", 1);
      expect(player).toHaveProperty("createdAt");
      expect(player).toHaveProperty("updatedAt");
    });

    it("should NOT export session tokens (security)", () => {
      // Insert player with session token
      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, photo_filename, role, active, session_token)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        "Jane",
        "Smith",
        "JANE01",
        "default.jpg",
        "host",
        1,
        "secret-session-token-123",
      );

      const exported = exportDatabase(db);

      expect(exported.players).toHaveLength(1);
      const player = exported.players[0];
      // Should NOT have sessionToken property
      expect(player).not.toHaveProperty("sessionToken");
      expect(player).not.toHaveProperty("session_token");
    });

    it("should export multiple players in order by id", () => {
      // Insert players in random order
      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, photo_filename, role, active)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("Charlie", "Brown", "CHAR01", "default.jpg", "audience", 1);

      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, photo_filename, role, active)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("Alice", "Anderson", "ALIC01", "default.jpg", "player", 1);

      const exported = exportDatabase(db);

      expect(exported.players).toHaveLength(2);
      // Should be ordered by id (insertion order)
      expect(exported.players[0].firstName).toBe("Charlie");
      expect(exported.players[1].firstName).toBe("Alice");
    });

    it("should export game state", () => {
      const exported = exportDatabase(db);

      expect(exported.gameState).toHaveLength(1);
      const gameState = exported.gameState[0];
      expect(gameState).toHaveProperty("key", "game_enabled");
      expect(gameState).toHaveProperty("value", "true");
      expect(gameState).toHaveProperty("updatedAt");
    });

    it("should export timestamp in ISO format", () => {
      const exported = exportDatabase(db);

      // Should be valid ISO 8601 date
      expect(() => new Date(exported.exportedAt)).not.toThrow();
      expect(new Date(exported.exportedAt).toISOString()).toBe(
        exported.exportedAt,
      );
    });

    it("should export active and inactive players", () => {
      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, photo_filename, role, active)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("Active", "Player", "ACT001", "default.jpg", "player", 1);

      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, photo_filename, role, active)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("Inactive", "Player", "INA001", "default.jpg", "player", 0);

      const exported = exportDatabase(db);

      expect(exported.players).toHaveLength(2);
      expect(
        exported.players.find((p) => p.firstName === "Active")?.active,
      ).toBe(1);
      expect(
        exported.players.find((p) => p.firstName === "Inactive")?.active,
      ).toBe(0);
    });
  });

  describe("importDatabase", () => {
    it("should reject invalid data structure", () => {
      const invalidData = { foo: "bar" } as unknown as DatabaseExport;

      expect(() => importDatabase(db, invalidData)).toThrow(
        "Invalid export file format",
      );
    });

    it("should reject unsupported version", () => {
      const futureVersion: DatabaseExport = {
        version: "2.0",
        exportedAt: new Date().toISOString(),
        players: [],
        gameState: [],
      };

      expect(() => importDatabase(db, futureVersion)).toThrow(
        "Unsupported export version: 2.0",
      );
    });

    it("should import empty database successfully", () => {
      const emptyData: DatabaseExport = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        players: [],
        gameState: [
          {
            key: "game_enabled",
            value: "true",
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      expect(() => importDatabase(db, emptyData)).not.toThrow();

      // Verify database is empty
      const players = db.prepare("SELECT * FROM players").all();
      expect(players).toHaveLength(0);
    });

    it("should import players correctly", () => {
      const data: DatabaseExport = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        players: [
          {
            id: 1,
            firstName: "Test",
            lastName: "User",
            email: "test@example.com",
            accessCode: "TEST01",
            photoFilename: "test.jpg",
            role: "player",
            active: 1,
            createdAt: "2025-01-01 00:00:00",
            updatedAt: "2025-01-01 00:00:00",
          },
        ],
        gameState: [
          {
            key: "game_enabled",
            value: "true",
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      importDatabase(db, data);

      const players = db.prepare("SELECT * FROM players").all();
      expect(players).toHaveLength(1);
      expect(players[0]).toMatchObject({
        first_name: "Test",
        last_name: "User",
        email: "test@example.com",
        access_code: "TEST01",
        photo_filename: "test.jpg",
        role: "player",
        active: 1,
      });
    });

    it("should clear existing players before import", () => {
      // Add existing player
      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, photo_filename, role, active)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("Existing", "Player", "EXIST1", "default.jpg", "player", 1);

      // Verify player exists
      let players = db.prepare("SELECT * FROM players").all();
      expect(players).toHaveLength(1);

      // Import new data
      const data: DatabaseExport = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        players: [
          {
            id: 100,
            firstName: "New",
            lastName: "Player",
            email: null,
            accessCode: "NEW001",
            photoFilename: "default.jpg",
            role: "player",
            active: 1,
            createdAt: "2025-01-01 00:00:00",
            updatedAt: "2025-01-01 00:00:00",
          },
        ],
        gameState: [
          {
            key: "game_enabled",
            value: "true",
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      importDatabase(db, data);

      // Should only have new player
      players = db.prepare("SELECT * FROM players").all();
      expect(players).toHaveLength(1);
      expect(players[0]).toMatchObject({
        first_name: "New",
        last_name: "Player",
      });
    });

    it("should import game state correctly", () => {
      const data: DatabaseExport = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        players: [],
        gameState: [
          {
            key: "game_enabled",
            value: "false",
            updatedAt: "2025-01-01 00:00:00",
          },
          {
            key: "custom_setting",
            value: "test_value",
            updatedAt: "2025-01-01 00:00:00",
          },
        ],
      };

      importDatabase(db, data);

      const gameState = db
        .prepare("SELECT * FROM game_state ORDER BY key")
        .all();
      expect(gameState).toHaveLength(2);
      expect(gameState[0]).toMatchObject({
        key: "custom_setting",
        value: "test_value",
      });
      expect(gameState[1]).toMatchObject({
        key: "game_enabled",
        value: "false",
      });
    });

    it("should preserve player IDs from import", () => {
      const data: DatabaseExport = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        players: [
          {
            id: 42,
            firstName: "Player",
            lastName: "42",
            email: null,
            accessCode: "P42001",
            photoFilename: "default.jpg",
            role: "player",
            active: 1,
            createdAt: "2025-01-01 00:00:00",
            updatedAt: "2025-01-01 00:00:00",
          },
        ],
        gameState: [
          {
            key: "game_enabled",
            value: "true",
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      importDatabase(db, data);

      const players = db.prepare("SELECT * FROM players").all();
      expect(players[0].id).toBe(42);
    });

    it("should reset autoincrement sequence after import", () => {
      const data: DatabaseExport = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        players: [
          {
            id: 100,
            firstName: "Player",
            lastName: "100",
            email: null,
            accessCode: "P100",
            photoFilename: "default.jpg",
            role: "player",
            active: 1,
            createdAt: "2025-01-01 00:00:00",
            updatedAt: "2025-01-01 00:00:00",
          },
        ],
        gameState: [
          {
            key: "game_enabled",
            value: "true",
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      importDatabase(db, data);

      // Add new player without specifying ID
      const result = db
        .prepare(
          `INSERT INTO players (first_name, last_name, access_code, photo_filename, role, active)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run("New", "Player", "NEW001", "default.jpg", "player", 1);

      // Should get ID 101 (max was 100)
      expect(result.lastInsertRowid).toBe(101);
    });

    it("should be transactional (all or nothing)", () => {
      // Create data with invalid player entry that will cause constraint violation
      const invalidData: DatabaseExport = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        players: [
          {
            id: 1,
            firstName: "Valid",
            lastName: "Player",
            email: null,
            accessCode: "VAL001",
            photoFilename: "default.jpg",
            role: "player",
            active: 1,
            createdAt: "2025-01-01 00:00:00",
            updatedAt: "2025-01-01 00:00:00",
          },
          {
            id: 2,
            firstName: "Invalid",
            lastName: "Player",
            email: null,
            accessCode: "VAL001", // Duplicate access code!
            photoFilename: "default.jpg",
            role: "player",
            active: 1,
            createdAt: "2025-01-01 00:00:00",
            updatedAt: "2025-01-01 00:00:00",
          },
        ],
        gameState: [
          {
            key: "game_enabled",
            value: "true",
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      // Add existing player to verify rollback
      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, photo_filename, role, active)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("Existing", "Player", "EXIST1", "default.jpg", "player", 1);

      // Import should fail
      expect(() => importDatabase(db, invalidData)).toThrow();

      // Original player should still exist (transaction rolled back)
      const players = db.prepare("SELECT * FROM players").all();
      expect(players).toHaveLength(1);
      expect(players[0]).toMatchObject({
        first_name: "Existing",
      });
    });

    it("should import multiple players correctly", () => {
      const data: DatabaseExport = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        players: [
          {
            id: 1,
            firstName: "Alice",
            lastName: "Anderson",
            email: "alice@example.com",
            accessCode: "ALIC01",
            photoFilename: "alice.jpg",
            role: "host",
            active: 1,
            createdAt: "2025-01-01 00:00:00",
            updatedAt: "2025-01-01 00:00:00",
          },
          {
            id: 2,
            firstName: "Bob",
            lastName: "Brown",
            email: null,
            accessCode: "BOB001",
            photoFilename: "default.jpg",
            role: "player",
            active: 0,
            createdAt: "2025-01-02 00:00:00",
            updatedAt: "2025-01-02 00:00:00",
          },
          {
            id: 3,
            firstName: "Charlie",
            lastName: "Chen",
            email: null,
            accessCode: "CHAR01",
            photoFilename: "default.jpg",
            role: "audience",
            active: 1,
            createdAt: "2025-01-03 00:00:00",
            updatedAt: "2025-01-03 00:00:00",
          },
        ],
        gameState: [
          {
            key: "game_enabled",
            value: "false",
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      importDatabase(db, data);

      const players = db.prepare("SELECT * FROM players ORDER BY id").all();
      expect(players).toHaveLength(3);
      expect(players[0]).toMatchObject({
        first_name: "Alice",
        role: "host",
        active: 1,
      });
      expect(players[1]).toMatchObject({
        first_name: "Bob",
        role: "player",
        active: 0,
      });
      expect(players[2]).toMatchObject({
        first_name: "Charlie",
        role: "audience",
        active: 1,
      });
    });

    it("should clear session tokens on import (not imported)", () => {
      const data: DatabaseExport = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        players: [
          {
            id: 1,
            firstName: "Test",
            lastName: "User",
            email: null,
            accessCode: "TEST01",
            photoFilename: "default.jpg",
            role: "player",
            active: 1,
            createdAt: "2025-01-01 00:00:00",
            updatedAt: "2025-01-01 00:00:00",
          },
        ],
        gameState: [
          {
            key: "game_enabled",
            value: "true",
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      importDatabase(db, data);

      const players = db.prepare("SELECT * FROM players").all();
      expect(players[0].session_token).toBeNull();
    });
  });

  describe("Round-Trip (Export → Import)", () => {
    it("should preserve data through export/import cycle", () => {
      // Create test data
      db.prepare(
        `INSERT INTO players (first_name, last_name, email, access_code, photo_filename, role, active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        "John",
        "Doe",
        "john@example.com",
        "JOHN01",
        "john.jpg",
        "player",
        1,
      );

      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, photo_filename, role, active)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("Jane", "Smith", "JANE01", "jane.jpg", "host", 1);

      // Update game state
      db.prepare(
        `UPDATE game_state SET value = 'false' WHERE key = 'game_enabled'`,
      ).run();

      // Export
      const exported = exportDatabase(db);

      // Create new database and import
      const db2 = new Database(":memory:");
      runMigrations(db2);
      importDatabase(db2, exported);

      // Verify players match
      const originalPlayers = db
        .prepare("SELECT * FROM players ORDER BY id")
        .all();
      const importedPlayers = db2
        .prepare("SELECT * FROM players ORDER BY id")
        .all();

      expect(importedPlayers).toHaveLength(originalPlayers.length);
      expect(importedPlayers[0]).toMatchObject({
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        access_code: "JOHN01",
      });
      expect(importedPlayers[1]).toMatchObject({
        first_name: "Jane",
        last_name: "Smith",
        access_code: "JANE01",
      });

      // Verify game state matches
      const originalGameState = db
        .prepare("SELECT value FROM game_state WHERE key = 'game_enabled'")
        .get() as { value: string };
      const importedGameState = db2
        .prepare("SELECT value FROM game_state WHERE key = 'game_enabled'")
        .get() as { value: string };

      expect(importedGameState.value).toBe(originalGameState.value);
      expect(importedGameState.value).toBe("false");
    });
  });
});
