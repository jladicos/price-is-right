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

  // Helper function to create minimal valid export data
  function createMinimalExport(
    overrides: Partial<DatabaseExport> = {},
  ): DatabaseExport {
    return {
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
      gameWorkflow: [
        {
          id: 1,
          currentSegment: "section_1",
          currentSegmentIndex: 0,
          phaseType: "not_started",
          phaseMetadata: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      contestantsRow: [],
      bids: [],
      wheelSpins: [],
      showcaseBids: [],
      ...overrides,
    };
  }

  describe("exportDatabase", () => {
    it("should export empty database with correct structure", () => {
      const exported = exportDatabase(db);

      expect(exported).toHaveProperty("version", "1.0");
      expect(exported).toHaveProperty("exportedAt");
      expect(exported).toHaveProperty("players");
      expect(exported).toHaveProperty("gameState");
      expect(exported).toHaveProperty("gameWorkflow");
      expect(exported).toHaveProperty("contestantsRow");
      expect(exported).toHaveProperty("bids");
      expect(exported).toHaveProperty("wheelSpins");
      expect(exported).toHaveProperty("showcaseBids");
      expect(Array.isArray(exported.players)).toBe(true);
      expect(Array.isArray(exported.gameState)).toBe(true);
      expect(Array.isArray(exported.gameWorkflow)).toBe(true);
      expect(Array.isArray(exported.contestantsRow)).toBe(true);
      expect(Array.isArray(exported.bids)).toBe(true);
      expect(Array.isArray(exported.wheelSpins)).toBe(true);
      expect(Array.isArray(exported.showcaseBids)).toBe(true);
      expect(exported.players).toHaveLength(0);
      expect(exported.gameWorkflow).toHaveLength(1); // Default workflow row
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
      const futureVersion = createMinimalExport({ version: "2.0" });

      expect(() => importDatabase(db, futureVersion)).toThrow(
        "Unsupported export version: 2.0",
      );
    });

    it("should import empty database successfully", () => {
      const emptyData = createMinimalExport();

      expect(() => importDatabase(db, emptyData)).not.toThrow();

      // Verify database is empty
      const players = db.prepare("SELECT * FROM players").all();
      expect(players).toHaveLength(0);
    });

    it("should import players correctly", () => {
      const data = createMinimalExport({
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
      });

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
      const data = createMinimalExport({
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
      });

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
      const data = createMinimalExport({
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
      });

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
      const data = createMinimalExport({
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
      });

      importDatabase(db, data);

      const players = db.prepare("SELECT * FROM players").all();
      expect(players[0].id).toBe(42);
    });

    it("should reset autoincrement sequence after import", () => {
      const data = createMinimalExport({
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
      });

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
      const invalidData = createMinimalExport({
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
      });

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
      const data = createMinimalExport({
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
            updatedAt: "2025-01-01 00:00:00",
          },
        ],
        gameState: [
          {
            key: "game_enabled",
            value: "false",
            updatedAt: new Date().toISOString(),
          },
        ],
      });

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
      const data = createMinimalExport({
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
      });

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

  describe("Wheel Spins Export/Import", () => {
    it("should export wheel spins with correct fields", () => {
      // Create player
      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, photo_filename, role, active)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("Test", "Player", "TEST01", "default.jpg", "player", 1);

      // Create wheel spins
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(1, "section_1", 1, 65, 0);

      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(1, "section_1", 2, 30, 0);

      const exported = exportDatabase(db);

      expect(exported.wheelSpins).toHaveLength(2);
      expect(exported.wheelSpins[0]).toMatchObject({
        playerId: 1,
        gameSegment: "section_1",
        spinNumber: 1,
        result: 65,
        spinoffNumber: 0,
      });
      expect(exported.wheelSpins[0]).toHaveProperty("id");
      expect(exported.wheelSpins[0]).toHaveProperty("createdAt");
      expect(exported.wheelSpins[1]).toMatchObject({
        playerId: 1,
        gameSegment: "section_1",
        spinNumber: 2,
        result: 30,
        spinoffNumber: 0,
      });
    });

    it("should import wheel spins correctly", () => {
      const data = createMinimalExport({
        players: [
          {
            id: 1,
            firstName: "Test",
            lastName: "Player",
            email: null,
            accessCode: "TEST01",
            photoFilename: "default.jpg",
            role: "player",
            active: 1,
            createdAt: "2025-01-01 00:00:00",
            updatedAt: "2025-01-01 00:00:00",
          },
        ],
        wheelSpins: [
          {
            id: 1,
            playerId: 1,
            gameSegment: "section_1",
            spinNumber: 1,
            result: 75,
            spinoffNumber: 0,
            createdAt: "2025-01-01 00:00:00",
          },
          {
            id: 2,
            playerId: 1,
            gameSegment: "section_1",
            spinNumber: 2,
            result: 25,
            spinoffNumber: 0,
            createdAt: "2025-01-01 00:00:00",
          },
        ],
      });

      importDatabase(db, data);

      const wheelSpins = db
        .prepare("SELECT * FROM wheel_spins ORDER BY id")
        .all();
      expect(wheelSpins).toHaveLength(2);
      expect(wheelSpins[0]).toMatchObject({
        id: 1,
        player_id: 1,
        game_segment: "section_1",
        spin_number: 1,
        result: 75,
        spinoff_number: 0,
      });
      expect(wheelSpins[1]).toMatchObject({
        id: 2,
        player_id: 1,
        game_segment: "section_1",
        spin_number: 2,
        result: 25,
        spinoff_number: 0,
      });
    });

    it("should clear existing wheel spins before import", () => {
      // Create existing player and spin
      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, photo_filename, role, active)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("Existing", "Player", "EXIST1", "default.jpg", "player", 1);

      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(1, "section_1", 1, 50, 0);

      // Verify spin exists
      let wheelSpins = db.prepare("SELECT * FROM wheel_spins").all();
      expect(wheelSpins).toHaveLength(1);

      // Import new data
      const data = createMinimalExport({
        players: [
          {
            id: 2,
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
        wheelSpins: [
          {
            id: 10,
            playerId: 2,
            gameSegment: "section_2",
            spinNumber: 1,
            result: 100,
            spinoffNumber: 0,
            createdAt: "2025-01-01 00:00:00",
          },
        ],
      });

      importDatabase(db, data);

      // Should only have new spin
      wheelSpins = db.prepare("SELECT * FROM wheel_spins").all();
      expect(wheelSpins).toHaveLength(1);
      expect(wheelSpins[0]).toMatchObject({
        id: 10,
        player_id: 2,
        result: 100,
      });
    });

    it("should preserve wheel spin IDs from import", () => {
      const data = createMinimalExport({
        players: [
          {
            id: 1,
            firstName: "Test",
            lastName: "Player",
            email: null,
            accessCode: "TEST01",
            photoFilename: "default.jpg",
            role: "player",
            active: 1,
            createdAt: "2025-01-01 00:00:00",
            updatedAt: "2025-01-01 00:00:00",
          },
        ],
        wheelSpins: [
          {
            id: 42,
            playerId: 1,
            gameSegment: "section_1",
            spinNumber: 1,
            result: 100,
            spinoffNumber: 0,
            createdAt: "2025-01-01 00:00:00",
          },
        ],
      });

      importDatabase(db, data);

      const wheelSpins = db
        .prepare("SELECT * FROM wheel_spins")
        .all() as Array<{
        id: number;
      }>;
      expect(wheelSpins[0].id).toBe(42);
    });

    it("should reset wheel_spins autoincrement sequence after import", () => {
      const data = createMinimalExport({
        players: [
          {
            id: 1,
            firstName: "Test",
            lastName: "Player",
            email: null,
            accessCode: "TEST01",
            photoFilename: "default.jpg",
            role: "player",
            active: 1,
            createdAt: "2025-01-01 00:00:00",
            updatedAt: "2025-01-01 00:00:00",
          },
        ],
        wheelSpins: [
          {
            id: 100,
            playerId: 1,
            gameSegment: "section_1",
            spinNumber: 1,
            result: 50,
            spinoffNumber: 0,
            createdAt: "2025-01-01 00:00:00",
          },
        ],
      });

      importDatabase(db, data);

      // Add new wheel spin without specifying ID
      const result = db
        .prepare(
          `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(1, "section_2", 1, 75, 0);

      // Should get ID 101 (max was 100)
      expect(result.lastInsertRowid).toBe(101);
    });

    it("should handle spinoff wheel spins correctly", () => {
      const data = createMinimalExport({
        players: [
          {
            id: 1,
            firstName: "Player",
            lastName: "One",
            email: null,
            accessCode: "P1",
            photoFilename: "default.jpg",
            role: "player",
            active: 1,
            createdAt: "2025-01-01 00:00:00",
            updatedAt: "2025-01-01 00:00:00",
          },
          {
            id: 2,
            firstName: "Player",
            lastName: "Two",
            email: null,
            accessCode: "P2",
            photoFilename: "default.jpg",
            role: "player",
            active: 1,
            createdAt: "2025-01-01 00:00:00",
            updatedAt: "2025-01-01 00:00:00",
          },
        ],
        wheelSpins: [
          // Regular round spins
          {
            id: 1,
            playerId: 1,
            gameSegment: "section_1",
            spinNumber: 1,
            result: 50,
            spinoffNumber: 0,
            createdAt: "2025-01-01 00:00:00",
          },
          {
            id: 2,
            playerId: 2,
            gameSegment: "section_1",
            spinNumber: 1,
            result: 50,
            spinoffNumber: 0,
            createdAt: "2025-01-01 00:00:00",
          },
          // Spinoff round 1
          {
            id: 3,
            playerId: 1,
            gameSegment: "section_1",
            spinNumber: 1,
            result: 75,
            spinoffNumber: 1,
            createdAt: "2025-01-01 00:00:00",
          },
          {
            id: 4,
            playerId: 2,
            gameSegment: "section_1",
            spinNumber: 1,
            result: 75,
            spinoffNumber: 1,
            createdAt: "2025-01-01 00:00:00",
          },
          // Spinoff round 2
          {
            id: 5,
            playerId: 1,
            gameSegment: "section_1",
            spinNumber: 1,
            result: 85,
            spinoffNumber: 2,
            createdAt: "2025-01-01 00:00:00",
          },
          {
            id: 6,
            playerId: 2,
            gameSegment: "section_1",
            spinNumber: 1,
            result: 90,
            spinoffNumber: 2,
            createdAt: "2025-01-01 00:00:00",
          },
        ],
      });

      importDatabase(db, data);

      const wheelSpins = db
        .prepare("SELECT * FROM wheel_spins ORDER BY id")
        .all() as Array<{
        spinoff_number: number;
        player_id: number;
        result: number;
      }>;
      expect(wheelSpins).toHaveLength(6);

      // Verify regular round
      const regularSpins = wheelSpins.filter((s) => s.spinoff_number === 0);
      expect(regularSpins).toHaveLength(2);

      // Verify spinoff round 1
      const spinoff1 = wheelSpins.filter((s) => s.spinoff_number === 1);
      expect(spinoff1).toHaveLength(2);

      // Verify spinoff round 2
      const spinoff2 = wheelSpins.filter((s) => s.spinoff_number === 2);
      expect(spinoff2).toHaveLength(2);
      expect(spinoff2[1]).toMatchObject({
        player_id: 2,
        result: 90,
        spinoff_number: 2,
      });
    });

    it("should preserve wheel spins through round-trip export/import", () => {
      // Create players
      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, photo_filename, role, active)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("Alice", "Anderson", "ALIC01", "default.jpg", "player", 1);

      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, photo_filename, role, active)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run("Bob", "Brown", "BOB001", "default.jpg", "player", 1);

      // Create wheel spins for both players
      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(1, "section_1", 1, 60, 0);

      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(1, "section_1", 2, 35, 0);

      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(2, "section_1", 1, 100, 0);

      // Export
      const exported = exportDatabase(db);

      // Create new database and import
      const db2 = new Database(":memory:");
      runMigrations(db2);
      importDatabase(db2, exported);

      // Verify wheel spins match
      const originalSpins = db
        .prepare("SELECT * FROM wheel_spins ORDER BY id")
        .all();
      const importedSpins = db2
        .prepare("SELECT * FROM wheel_spins ORDER BY id")
        .all();

      expect(importedSpins).toHaveLength(originalSpins.length);
      expect(importedSpins).toHaveLength(3);

      expect(importedSpins[0]).toMatchObject({
        player_id: 1,
        game_segment: "section_1",
        spin_number: 1,
        result: 60,
        spinoff_number: 0,
      });

      expect(importedSpins[1]).toMatchObject({
        player_id: 1,
        game_segment: "section_1",
        spin_number: 2,
        result: 35,
        spinoff_number: 0,
      });

      expect(importedSpins[2]).toMatchObject({
        player_id: 2,
        game_segment: "section_1",
        spin_number: 1,
        result: 100,
        spinoff_number: 0,
      });
    });
  });
});
