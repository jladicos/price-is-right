import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import playersRoutes from "./players";
import { authRoutes } from "./auth";
import { initDatabase, closeDatabase } from "../db/connection";
import { login } from "../services/auth";
import Database from "better-sqlite3";

describe("Players API Routes", () => {
  let app: FastifyInstance;
  let db: Database.Database;
  let authToken: string;

  beforeEach(async () => {
    // Use in-memory database for tests
    db = initDatabase(":memory:");

    // Create a test user for authentication
    db.prepare(
      "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
    ).run("Test", "User", "TESTAUTH", "host");

    // Login to get auth token
    const { sessionToken } = login(db, "TESTAUTH");
    authToken = sessionToken;

    app = Fastify();
    await app.register(authRoutes);
    await app.register(playersRoutes, { prefix: "/api" });
  });

  afterEach(async () => {
    await app.close();
    closeDatabase();
  });

  describe("GET /api/players", () => {
    it("should return only auth user when no other players exist", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/players",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.players).toHaveLength(1);
      expect(body.total).toBe(1);
      expect(body.players[0].firstName).toBe("Test");
      expect(body.players[0].lastName).toBe("User");
    });

    it("should return all players with total count", async () => {
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
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.players).toHaveLength(3); // Includes auth user
      expect(body.total).toBe(3);
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
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      const body = JSON.parse(response.body);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const player = body.players.find((p: any) => p.accessCode === "ABC123");

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
        headers: {
          authorization: `Bearer ${authToken}`,
        },
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

    it("should return 403 when user is not a host", async () => {
      // Create a non-host player
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("Regular", "Player", "PLAYER01", "player");

      // Login as the non-host player
      const { sessionToken: playerToken } = login(db, "PLAYER01");

      const response = await app.inject({
        method: "GET",
        url: "/api/players",
        headers: {
          authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Host access required");
    });

    it("should return 401 when no auth token provided", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/players",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should filter players by search query", async () => {
      // Insert test players
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("Alice", "Wonder", "ALICE1", "player");

      const response = await app.inject({
        method: "GET",
        url: "/api/players?search=Alice",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(1);
      expect(body.players[0].firstName).toBe("Alice");
    });

    it("should filter players by role", async () => {
      // Insert test players
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("John", "Doe", "JOHN01", "player");

      const response = await app.inject({
        method: "GET",
        url: "/api/players?role=host",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body.players.forEach((player: any) => {
        expect(player.role).toBe("host");
      });
    });

    it("should filter players by active status", async () => {
      // Insert inactive player
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role, active) VALUES (?, ?, ?, ?, ?)",
      ).run("Inactive", "User", "INACT1", "player", 0);

      const response = await app.inject({
        method: "GET",
        url: "/api/players?active=false",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(1);
      expect(body.players[0].active).toBe(false);
    });

    it("should sort players by name", async () => {
      // Insert test players
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("Zoe", "Last", "ZOE001", "player");

      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("Alice", "First", "ALICE2", "player");

      const response = await app.inject({
        method: "GET",
        url: "/api/players?sortBy=name&sortOrder=asc",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // First should be alphabetically first
      expect(body.players[0].firstName).toBe("Alice");
    });

    it("should paginate results", async () => {
      // Insert multiple players
      for (let i = 0; i < 5; i++) {
        db.prepare(
          "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
        ).run(`Player${i}`, "Test", `PLR${i}`, "player");
      }

      const response = await app.inject({
        method: "GET",
        url: "/api/players?limit=2&offset=0",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.players.length).toBe(2);
      expect(body.total).toBeGreaterThan(2);
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
        headers: {
          authorization: `Bearer ${authToken}`,
        },
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
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Player not found");
    });

    it("should handle invalid id format gracefully", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/players/invalid",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      // Should return 404 (no player with that id)
      expect(response.statusCode).toBe(404);
    });

    it("should return 403 when user is not a host", async () => {
      // Create a non-host player
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("Regular", "Player", "PLAYER01", "player");

      // Login as the non-host player
      const { sessionToken: playerToken } = login(db, "PLAYER01");

      // Try to access any player by ID
      const response = await app.inject({
        method: "GET",
        url: "/api/players/1",
        headers: {
          authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Host access required");
    });

    it("should return 401 when no auth token provided", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/players/1",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("PUT /api/players/:id", () => {
    it("should update player name", async () => {
      const result = db
        .prepare(
          "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
        )
        .run("John", "Doe", "JOHN01", "player");

      const playerId = result.lastInsertRowid;

      const response = await app.inject({
        method: "PUT",
        url: `/api/players/${playerId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
          "content-type": "application/json",
        },
        payload: {
          firstName: "Johnny",
          lastName: "Doeson",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.player.firstName).toBe("Johnny");
      expect(body.player.lastName).toBe("Doeson");
    });

    it("should update player role from audience to host", async () => {
      const result = db
        .prepare(
          "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
        )
        .run("Jane", "Smith", "JANE01", "audience");

      const playerId = result.lastInsertRowid;

      const response = await app.inject({
        method: "PUT",
        url: `/api/players/${playerId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
          "content-type": "application/json",
        },
        payload: {
          role: "host",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.player.role).toBe("host");
    });

    it("should reject player -> host promotion", async () => {
      const result = db
        .prepare(
          "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
        )
        .run("Player", "One", "PLAY01", "player");

      const playerId = result.lastInsertRowid;

      const response = await app.inject({
        method: "PUT",
        url: `/api/players/${playerId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
          "content-type": "application/json",
        },
        payload: {
          role: "host",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Cannot promote a player to host");
    });

    it("should reject demoting the last host", async () => {
      // Get the auth user (only host)
      const authUser = db
        .prepare("SELECT * FROM players WHERE access_code = ?")
        .get("TESTAUTH") as { id: number };

      const response = await app.inject({
        method: "PUT",
        url: `/api/players/${authUser.id}`,
        headers: {
          authorization: `Bearer ${authToken}`,
          "content-type": "application/json",
        },
        payload: {
          role: "player",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Cannot demote the last host");
    });

    it("should allow demoting a host when multiple hosts exist", async () => {
      // Add another host
      const result = db
        .prepare(
          "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
        )
        .run("Another", "Host", "HOST02", "host");

      const newHostId = result.lastInsertRowid;

      // Now demote the new host
      const response = await app.inject({
        method: "PUT",
        url: `/api/players/${newHostId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
          "content-type": "application/json",
        },
        payload: {
          role: "audience",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.player.role).toBe("audience");
    });

    it("should return 404 for non-existent player", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/players/99999",
        headers: {
          authorization: `Bearer ${authToken}`,
          "content-type": "application/json",
        },
        payload: {
          firstName: "Nobody",
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 403 for non-host user", async () => {
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("Regular", "Player", "PLAYER01", "player");

      const { sessionToken: playerToken } = login(db, "PLAYER01");

      const response = await app.inject({
        method: "PUT",
        url: "/api/players/1",
        headers: {
          authorization: `Bearer ${playerToken}`,
          "content-type": "application/json",
        },
        payload: {
          firstName: "Hacker",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PUT /api/players/:id/reset-code", () => {
    it("should reset access code", async () => {
      const result = db
        .prepare(
          "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
        )
        .run("John", "Doe", "JOHN01", "player");

      const playerId = result.lastInsertRowid;

      const response = await app.inject({
        method: "PUT",
        url: `/api/players/${playerId}/reset-code`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.player.accessCode).not.toBe("JOHN01");
      expect(body.player.accessCode).toMatch(/^[A-Z0-9]{6}$/);
    });

    it("should clear session token when resetting code", async () => {
      const result = db
        .prepare(
          "INSERT INTO players (first_name, last_name, access_code, role, session_token) VALUES (?, ?, ?, ?, ?)",
        )
        .run("John", "Doe", "JOHN01", "player", "test-session");

      const playerId = result.lastInsertRowid;

      const response = await app.inject({
        method: "PUT",
        url: `/api/players/${playerId}/reset-code`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.player.sessionToken).toBeNull();
    });

    it("should return 404 for non-existent player", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/players/99999/reset-code",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 403 for non-host user", async () => {
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("Regular", "Player", "PLAYER01", "player");

      const { sessionToken: playerToken } = login(db, "PLAYER01");

      const response = await app.inject({
        method: "PUT",
        url: "/api/players/1/reset-code",
        headers: {
          authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PUT /api/players/:id/deactivate", () => {
    it("should deactivate a player", async () => {
      const result = db
        .prepare(
          "INSERT INTO players (first_name, last_name, access_code, role, active) VALUES (?, ?, ?, ?, ?)",
        )
        .run("John", "Doe", "JOHN01", "player", 1);

      const playerId = result.lastInsertRowid;

      const response = await app.inject({
        method: "PUT",
        url: `/api/players/${playerId}/deactivate`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.player.active).toBe(false);
    });

    it("should clear session token when deactivating", async () => {
      const result = db
        .prepare(
          "INSERT INTO players (first_name, last_name, access_code, role, session_token) VALUES (?, ?, ?, ?, ?)",
        )
        .run("John", "Doe", "JOHN01", "player", "test-session");

      const playerId = result.lastInsertRowid;

      const response = await app.inject({
        method: "PUT",
        url: `/api/players/${playerId}/deactivate`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.player.sessionToken).toBeNull();
    });

    it("should return 404 for non-existent player", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/players/99999/deactivate",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 403 for non-host user", async () => {
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("Regular", "Player", "PLAYER01", "player");

      const { sessionToken: playerToken } = login(db, "PLAYER01");

      const response = await app.inject({
        method: "PUT",
        url: "/api/players/1/deactivate",
        headers: {
          authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PUT /api/players/:id/activate", () => {
    it("should activate a player", async () => {
      const result = db
        .prepare(
          "INSERT INTO players (first_name, last_name, access_code, role, active) VALUES (?, ?, ?, ?, ?)",
        )
        .run("John", "Doe", "JOHN01", "player", 0);

      const playerId = result.lastInsertRowid;

      const response = await app.inject({
        method: "PUT",
        url: `/api/players/${playerId}/activate`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.player.active).toBe(true);
    });

    it("should return 404 for non-existent player", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/players/99999/activate",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 403 for non-host user", async () => {
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("Regular", "Player", "PLAYER01", "player");

      const { sessionToken: playerToken } = login(db, "PLAYER01");

      const response = await app.inject({
        method: "PUT",
        url: "/api/players/1/activate",
        headers: {
          authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
