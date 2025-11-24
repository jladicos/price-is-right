import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import { authenticateRequest } from "./auth";
import { initDatabase, closeDatabase } from "../db/connection";
import { login } from "../services/auth";
import Database from "better-sqlite3";

describe("Auth Middleware", () => {
  let app: FastifyInstance;
  let db: Database.Database;
  let validToken: string;

  beforeEach(async () => {
    // Use in-memory database for tests
    db = initDatabase(":memory:");

    // Create test player
    db.prepare(
      "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
    ).run("Test", "User", "TEST123", "player");

    // Get valid token
    const result = login(db, "TEST123");
    validToken = result.sessionToken;

    // Create test Fastify app with protected route
    app = Fastify();

    // Add a test route that uses the auth middleware
    app.get(
      "/protected",
      {
        preHandler: authenticateRequest,
      },
      async (request, reply) => {
        return reply.send({
          message: "success",
          player: request.player,
        });
      },
    );
  });

  afterEach(async () => {
    await app.close();
    closeDatabase();
  });

  describe("Valid authentication", () => {
    it("should allow access with valid Bearer token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("success");
      expect(body.player).toBeDefined();
      expect(body.player.firstName).toBe("Test");
    });

    it("should attach player object to request", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      const body = JSON.parse(response.body);
      expect(body.player.id).toBeDefined();
      expect(body.player.firstName).toBe("Test");
      expect(body.player.lastName).toBe("User");
      expect(body.player.accessCode).toBe("TEST123");
      expect(body.player.role).toBe("player");
      expect(body.player.active).toBe(true);
    });
  });

  describe("Missing authorization header", () => {
    it("should return 401 when authorization header is missing", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/protected",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Unauthorized");
      expect(body.message).toBe("Missing authorization header");
    });
  });

  describe("Malformed authorization header", () => {
    it("should return 401 when missing Bearer prefix", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: validToken, // Missing "Bearer"
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Unauthorized");
      expect(body.message).toBe("Invalid authorization header format");
    });

    it("should return 401 when using wrong scheme (Basic)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: `Basic ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid authorization header format");
    });

    it("should return 401 when authorization header has no token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: "Bearer",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid authorization header format");
    });

    it("should return 401 when authorization header has extra parts", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: `Bearer ${validToken} extra-part`,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid authorization header format");
    });

    it("should return 401 with empty string after Bearer", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: "Bearer ",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 401 with only whitespace after Bearer", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: "Bearer   ",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("Invalid session token", () => {
    it("should return 401 with completely invalid token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: "Bearer invalid-token-12345",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Unauthorized");
      expect(body.message).toBe("Invalid or expired session");
    });

    it("should return 401 with empty token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: "Bearer ",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 401 with valid format but non-existent token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: "Bearer 12345678901234567890123456789012",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid or expired session");
    });
  });

  describe("Player state changes", () => {
    it("should return 401 when player is deactivated", async () => {
      // Deactivate the player
      db.prepare("UPDATE players SET active = 0 WHERE access_code = ?").run(
        "TEST123",
      );

      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid or expired session");
    });

    it("should return 401 when session token is cleared", async () => {
      // Clear the session token
      db.prepare(
        "UPDATE players SET session_token = NULL WHERE access_code = ?",
      ).run("TEST123");

      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid or expired session");
    });

    it("should return 401 when session token is replaced by new login", async () => {
      // Login again to replace token
      login(db, "TEST123");

      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid or expired session");
    });
  });

  describe("Case sensitivity", () => {
    it("should be case-sensitive for Bearer keyword", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: `bearer ${validToken}`, // lowercase
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid authorization header format");
    });

    it("should be case-sensitive for BEARER keyword", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/protected",
        headers: {
          authorization: `BEARER ${validToken}`, // uppercase
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Invalid authorization header format");
    });
  });
});
