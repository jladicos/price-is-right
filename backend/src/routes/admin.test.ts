import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import adminRoutes from "./admin.js";
import { initDatabase, closeDatabase } from "../db/connection.js";
import Database from "better-sqlite3";

describe("Admin API Routes", () => {
  let app: FastifyInstance;
  let db: Database.Database;
  let hostToken: string;
  let playerToken: string;

  beforeEach(async () => {
    // Use in-memory database for tests
    db = initDatabase(":memory:");

    // Create test players
    db.prepare(
      "INSERT INTO players (first_name, last_name, access_code, role, active, session_token) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("Host", "User", "HOST123", "host", 1, "host-token-123");

    db.prepare(
      "INSERT INTO players (first_name, last_name, access_code, role, active, session_token) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("Player", "User", "PLAY456", "player", 1, "player-token-456");

    hostToken = "host-token-123";
    playerToken = "player-token-456";

    app = Fastify();
    await app.register(adminRoutes, { prefix: "/api" });
  });

  afterEach(async () => {
    await app.close();
    closeDatabase();
  });

  describe("GET /api/admin/export", () => {
    it("should export database when authenticated as host", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/export",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Verify structure
      expect(body).toHaveProperty("version", "1.0");
      expect(body).toHaveProperty("exportedAt");
      expect(body).toHaveProperty("players");
      expect(body).toHaveProperty("gameState");

      // Should include both test players
      expect(body.players).toHaveLength(2);
    });

    it("should set Content-Disposition header for file download", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/export",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe(
        "application/json; charset=utf-8",
      );
      expect(response.headers["content-disposition"]).toMatch(
        /^attachment; filename="/,
      );
      expect(response.headers["content-disposition"]).toMatch(
        /price-is-right-backup-\d{4}-\d{2}-\d{2}\.json"/,
      );
    });

    it("should export with timestamped filename", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/export",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const disposition = response.headers["content-disposition"] as string;
      const today = new Date().toISOString().split("T")[0];
      expect(disposition).toContain(today);
    });

    it("should NOT export session tokens", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/export",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Check all players don't have session tokens
      for (const player of body.players) {
        expect(player).not.toHaveProperty("sessionToken");
        expect(player).not.toHaveProperty("session_token");
      }
    });

    it("should return 401 when not authenticated", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/export",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 403 when authenticated as non-host", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/export",
        headers: {
          Authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should export game state correctly", async () => {
      // Disable game
      db.prepare(
        `UPDATE game_state SET value = 'false' WHERE key = 'game_enabled'`,
      ).run();

      const response = await app.inject({
        method: "GET",
        url: "/api/admin/export",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.gameState).toBeDefined();
      const gameEnabled = body.gameState.find(
        (s: { key: string; value: string }) => s.key === "game_enabled",
      );
      expect(gameEnabled).toBeDefined();
      expect(gameEnabled.value).toBe("false");
    });
  });

  describe("POST /api/admin/import", () => {
    it("should import database when authenticated as host", async () => {
      const importData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        players: [
          {
            id: 100,
            firstName: "Imported",
            lastName: "Player",
            email: null,
            accessCode: "IMP001",
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
            value: "false",
            updatedAt: "2025-01-01 00:00:00",
          },
        ],
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/admin/import",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: importData,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("message", "Database imported successfully");
      expect(body).toHaveProperty("playersImported", 1);
      expect(body).toHaveProperty("gameStateImported", 1);

      // Verify data was actually imported
      const players = db.prepare("SELECT * FROM players").all();
      expect(players).toHaveLength(1);
      expect(players[0]).toMatchObject({
        first_name: "Imported",
        last_name: "Player",
      });
    });

    it("should replace existing players on import", async () => {
      // Verify we have 2 players initially
      let players = db.prepare("SELECT * FROM players").all();
      expect(players).toHaveLength(2);

      const importData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        players: [
          {
            id: 1,
            firstName: "New",
            lastName: "Player",
            email: null,
            accessCode: "NEW001",
            photoFilename: "default.jpg",
            role: "host",
            active: 1,
            createdAt: "2025-01-01 00:00:00",
            updatedAt: "2025-01-01 00:00:00",
          },
        ],
        gameState: [
          {
            key: "game_enabled",
            value: "true",
            updatedAt: "2025-01-01 00:00:00",
          },
        ],
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/admin/import",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: importData,
      });

      expect(response.statusCode).toBe(200);

      // Should only have 1 player now
      players = db.prepare("SELECT * FROM players").all();
      expect(players).toHaveLength(1);
      expect(players[0]).toMatchObject({
        first_name: "New",
      });
    });

    it("should return 401 when not authenticated", async () => {
      const importData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        players: [],
        gameState: [],
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/admin/import",
        headers: {
          "Content-Type": "application/json",
        },
        payload: importData,
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 403 when authenticated as non-host", async () => {
      const importData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        players: [],
        gameState: [],
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/admin/import",
        headers: {
          Authorization: `Bearer ${playerToken}`,
          "Content-Type": "application/json",
        },
        payload: importData,
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 400 with invalid request body", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/admin/import",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: "not an object",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("error");
    });

    it("should return 400 with missing version field", async () => {
      const invalidData = {
        exportedAt: new Date().toISOString(),
        players: [],
        gameState: [],
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/admin/import",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: invalidData,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Invalid export file format");
    });

    it("should return 400 with unsupported version", async () => {
      const futureVersion = {
        version: "2.0",
        exportedAt: new Date().toISOString(),
        players: [],
        gameState: [],
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/admin/import",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: futureVersion,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Unsupported export version");
    });

    it("should handle import with no players", async () => {
      const emptyImport = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        players: [],
        gameState: [
          {
            key: "game_enabled",
            value: "true",
            updatedAt: "2025-01-01 00:00:00",
          },
        ],
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/admin/import",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: emptyImport,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.playersImported).toBe(0);
      expect(body.gameStateImported).toBe(1);

      // Verify all players were deleted
      const players = db.prepare("SELECT * FROM players").all();
      expect(players).toHaveLength(0);
    });

    it("should update game state on import", async () => {
      // Verify initial state
      let gameState = db
        .prepare("SELECT value FROM game_state WHERE key = 'game_enabled'")
        .get() as { value: string };
      expect(gameState.value).toBe("true");

      const importData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        players: [],
        gameState: [
          {
            key: "game_enabled",
            value: "false",
            updatedAt: "2025-01-01 00:00:00",
          },
        ],
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/admin/import",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: importData,
      });

      expect(response.statusCode).toBe(200);

      // Verify game state was updated
      gameState = db
        .prepare("SELECT value FROM game_state WHERE key = 'game_enabled'")
        .get() as {
        value: string;
      };
      expect(gameState.value).toBe("false");
    });
  });

  describe("Round-Trip (Export → Import)", () => {
    it("should preserve data through API export/import cycle", async () => {
      // Add additional test data
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, photo_filename, role, active) VALUES (?, ?, ?, ?, ?, ?)",
      ).run("Alice", "Anderson", "ALIC01", "alice.jpg", "audience", 1);

      // Set game disabled
      db.prepare(
        `UPDATE game_state SET value = 'false' WHERE key = 'game_enabled'`,
      ).run();

      // Verify we have 3 players initially
      let players = db.prepare("SELECT * FROM players ORDER BY id").all();
      expect(players).toHaveLength(3);

      // Export
      const exportResponse = await app.inject({
        method: "GET",
        url: "/api/admin/export",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(exportResponse.statusCode).toBe(200);
      const exportedData = JSON.parse(exportResponse.body);

      // Verify export has correct data
      expect(exportedData.players).toHaveLength(3);
      expect(
        exportedData.gameState.find(
          (s: { key: string; value: string }) => s.key === "game_enabled",
        )?.value,
      ).toBe("false");

      // Import (this replaces all data)
      const importResponse = await app.inject({
        method: "POST",
        url: "/api/admin/import",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: exportedData,
      });

      expect(importResponse.statusCode).toBe(200);
      const importBody = JSON.parse(importResponse.body);
      expect(importBody.playersImported).toBe(3);

      // Verify players were preserved
      players = db.prepare("SELECT * FROM players ORDER BY id").all();
      expect(players).toHaveLength(3);
      expect(
        players.some((p: { first_name: string }) => p.first_name === "Alice"),
      ).toBe(true);

      // Verify game state was preserved
      const gameState = db
        .prepare("SELECT value FROM game_state WHERE key = 'game_enabled'")
        .get() as { value: string };
      expect(gameState.value).toBe("false");
    });
  });
});
