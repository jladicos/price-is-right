import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import playersRoutes from "./players";
import { initDatabase, closeDatabase } from "../db/connection";
import Database from "better-sqlite3";

describe("Players API Routes", () => {
  let app: FastifyInstance;
  let db: Database.Database;

  beforeEach(async () => {
    // Use in-memory database for tests
    db = initDatabase(":memory:");

    app = Fastify();
    await app.register(playersRoutes, { prefix: "/api" });
  });

  afterEach(async () => {
    await app.close();
    closeDatabase();
  });

  describe("GET /api/players", () => {
    it("should return empty array when no players exist", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/players",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.players).toEqual([]);
    });

    it("should return all players", async () => {
      // Insert test players
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("John", "Doe", "ABC123", "player");

      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("Jane", "Smith", "XYZ789", "host");

      const response = await app.inject({
        method: "GET",
        url: "/api/players",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.players).toHaveLength(2);
      expect(body.players[0]).toHaveProperty("firstName");
      expect(body.players[0]).toHaveProperty("lastName");
      expect(body.players[0]).toHaveProperty("accessCode");
      expect(body.players[0]).toHaveProperty("role");
    });

    it("should return players with camelCase field names", async () => {
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role, photo_filename) VALUES (?, ?, ?, ?, ?)",
      ).run("John", "Doe", "ABC123", "player", "john.jpg");

      const response = await app.inject({
        method: "GET",
        url: "/api/players",
      });

      const body = JSON.parse(response.body);
      const player = body.players[0];

      // Check camelCase conversion
      expect(player.firstName).toBe("John");
      expect(player.lastName).toBe("Doe");
      expect(player.accessCode).toBe("ABC123");
      expect(player.photoFilename).toBe("john.jpg");

      // Should not have snake_case fields
      expect(player.first_name).toBeUndefined();
      expect(player.last_name).toBeUndefined();
      expect(player.access_code).toBeUndefined();
    });

    it("should convert active field from integer to boolean", async () => {
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role, active) VALUES (?, ?, ?, ?, ?)",
      ).run("John", "Doe", "ABC123", "player", 1);

      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role, active) VALUES (?, ?, ?, ?, ?)",
      ).run("Jane", "Smith", "XYZ789", "player", 0);

      const response = await app.inject({
        method: "GET",
        url: "/api/players",
      });

      const body = JSON.parse(response.body);

      // Find players by access code to avoid relying on order
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const john = body.players.find((p: any) => p.accessCode === "ABC123");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jane = body.players.find((p: any) => p.accessCode === "XYZ789");

      expect(john.active).toBe(true);
      expect(jane.active).toBe(false);
      expect(typeof john.active).toBe("boolean");
      expect(typeof jane.active).toBe("boolean");
    });
  });

  describe("GET /api/players/:id", () => {
    it("should return a single player by id", async () => {
      const result = db
        .prepare(
          "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
        )
        .run("John", "Doe", "ABC123", "player");

      const playerId = result.lastInsertRowid;

      const response = await app.inject({
        method: "GET",
        url: `/api/players/${playerId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.player).toBeDefined();
      expect(body.player.firstName).toBe("John");
      expect(body.player.lastName).toBe("Doe");
      expect(body.player.accessCode).toBe("ABC123");
    });

    it("should return 404 for non-existent player", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/players/99999",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Player not found");
    });

    it("should handle invalid id format gracefully", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/players/invalid",
      });

      // Should return 404 (no player with that id)
      expect(response.statusCode).toBe(404);
    });
  });
});
