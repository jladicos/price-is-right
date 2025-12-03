import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import { initDatabase, closeDatabase } from "../db/connection";
import { login } from "../services/auth";
import showcaseRoutes from "./showcase";
import { addContestantToRow } from "../db/contestants";
import { updateGameWorkflow } from "../db/game-workflow";
import { insertWheelSpin } from "../db/wheel";

// Mock getCurrentLeader to return test wheel winners
vi.mock("../services/wheel.js", () => ({
  getCurrentLeader: vi.fn((wheelId: string) => {
    if (wheelId === "wheel_1") {
      return { player_id: 2, spin_value: 100 };
    } else if (wheelId === "wheel_2") {
      return { player_id: 3, spin_value: 100 };
    }
    return null;
  }),
}));

// Mock getWinnersForSegment to return test bidding winners
vi.mock("../db/bids.js", () => ({
  getWinnersForSegment: vi.fn((segment: string) => {
    if (segment === "section_1") {
      return [{ player_id: 2, product_id: "lemon-juice" }];
    } else if (segment === "section_2") {
      return [{ player_id: 3, product_id: "apple-juice" }];
    }
    return [];
  }),
}));

describe("Showcase API Integration Tests", () => {
  let app: FastifyInstance;
  let db: Database.Database;
  let hostToken: string;
  let player1Token: string;
  let player2Token: string;

  beforeEach(async () => {
    // Use in-memory database for tests
    db = initDatabase(":memory:");

    // Create test players
    db.prepare(
      "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
    ).run("Host", "User", "HOST123", "host");

    db.prepare(
      "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
    ).run("Player1", "Last1", "CODE1", "player");

    db.prepare(
      "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
    ).run("Player2", "Last2", "CODE2", "player");

    // Get auth tokens
    hostToken = login(db, "HOST123").sessionToken;
    player1Token = login(db, "CODE1").sessionToken;
    player2Token = login(db, "CODE2").sessionToken;

    // Setup game state for finale
    updateGameWorkflow({
      current_segment: "finale",
      current_segment_index: 2,
      phase_type: "finale",
      phase_metadata: null,
    });

    // Create test Fastify app
    app = Fastify();
    await app.register(showcaseRoutes, { prefix: "/api" });
  });

  afterEach(async () => {
    await app.close();
    closeDatabase();
  });

  describe("POST /api/showcase/initialize", () => {
    it("should initialize showcase with finalists (host only)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/initialize",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.state).toBeDefined();
      expect(body.state.finale_player1_id).toBe(2);
      expect(body.state.finale_player2_id).toBe(3);
      expect(body.state.finale_player1_showcase).toBeDefined();
      expect(body.state.finale_player2_showcase).toBeDefined();
    });

    it("should reject non-host requests", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/initialize",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/showcase/pass", () => {
    beforeEach(async () => {
      // Initialize showcase first
      await app.inject({
        method: "POST",
        url: "/api/showcase/initialize",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });
    });

    it("should allow host to pass on showcase 1", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/pass",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("should reject non-host requests", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/pass",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/showcase/bid-decision", () => {
    beforeEach(async () => {
      await app.inject({
        method: "POST",
        url: "/api/showcase/initialize",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });
    });

    it("should allow host to record bid decision", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/bid-decision",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("should reject non-host requests", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/bid-decision",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/showcase/submit-bid", () => {
    beforeEach(async () => {
      await app.inject({
        method: "POST",
        url: "/api/showcase/initialize",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });
    });

    it("should allow player to submit bid for themselves", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
        payload: {
          bid_amount: 8.5,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("should allow host to submit bid for any player", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          player_id: 2,
          bid_amount: 8.5,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("should reject negative bid amounts", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
        payload: {
          bid_amount: -10,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it("should reject zero bid amounts", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
        payload: {
          bid_amount: 0,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it("should reject player bidding for another player", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
        payload: {
          player_id: 3,
          bid_amount: 10,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe("POST /api/showcase/unlock-bid", () => {
    beforeEach(async () => {
      await app.inject({
        method: "POST",
        url: "/api/showcase/initialize",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      // Submit a bid first
      await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          player_id: 2,
          bid_amount: 8.5,
        },
      });
    });

    it("should allow host to unlock a bid", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/unlock-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          player_id: 2,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("should reject non-host requests", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/unlock-bid",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
        payload: {
          player_id: 2,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/showcase/update-bid", () => {
    beforeEach(async () => {
      await app.inject({
        method: "POST",
        url: "/api/showcase/initialize",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      // Submit a bid first
      await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          player_id: 2,
          bid_amount: 8.5,
        },
      });
    });

    it("should allow host to update a bid", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/update-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          player_id: 2,
          bid_amount: 9.0,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("should reject non-host requests", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/update-bid",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
        payload: {
          player_id: 2,
          bid_amount: 9.0,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should reject negative bid amounts", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/update-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          player_id: 2,
          bid_amount: -5,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe("POST /api/showcase/reveal-winner", () => {
    beforeEach(async () => {
      await app.inject({
        method: "POST",
        url: "/api/showcase/initialize",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      // Submit bids for both players
      await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          player_id: 2,
          bid_amount: 8.5,
        },
      });

      await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          player_id: 3,
          bid_amount: 14.0,
        },
      });
    });

    it("should reveal winner (host only)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/reveal-winner",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.winnerId).toBeDefined();
      expect(typeof body.bonusWon).toBe("boolean");
      expect(typeof body.retryNeeded).toBe("boolean");
    });

    it("should reject non-host requests", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/reveal-winner",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/showcase/retry", () => {
    beforeEach(async () => {
      await app.inject({
        method: "POST",
        url: "/api/showcase/initialize",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      // Submit bids where both players go over
      await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          player_id: 2,
          bid_amount: 100,
        },
      });

      await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          player_id: 3,
          bid_amount: 100,
        },
      });
    });

    it("should initiate retry when both players go over", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/retry",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.retryNumber).toBe(1);
    });

    it("should reject non-host requests", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/retry",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("GET /api/showcase/state", () => {
    beforeEach(async () => {
      await app.inject({
        method: "POST",
        url: "/api/showcase/initialize",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });
    });

    it("should return showcase state for authenticated users", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/showcase/state",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.state).toBeDefined();
      expect(body.showcase1).toBeDefined();
      expect(body.showcase2).toBeDefined();
      expect(body.showcase1Value).toBeGreaterThan(0);
      expect(body.showcase2Value).toBeGreaterThan(0);
      expect(body.bonusThreshold).toBeDefined();
    });

    it("should reject unauthenticated requests", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/showcase/state",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/showcase/bids", () => {
    beforeEach(async () => {
      await app.inject({
        method: "POST",
        url: "/api/showcase/initialize",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          player_id: 2,
          bid_amount: 8.5,
        },
      });
    });

    it("should return bids for authenticated users", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/showcase/bids",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.bids).toBeInstanceOf(Array);
      expect(body.bids.length).toBeGreaterThan(0);
      expect(body.retryNumber).toBeDefined();
    });

    it("should reject unauthenticated requests", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/showcase/bids",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/showcase/winner", () => {
    beforeEach(async () => {
      await app.inject({
        method: "POST",
        url: "/api/showcase/initialize",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          player_id: 2,
          bid_amount: 8.5,
        },
      });

      await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          player_id: 3,
          bid_amount: 14.0,
        },
      });
    });

    it("should return winner calculation for host", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/showcase/winner",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.winnerId).toBeDefined();
      expect(typeof body.bonusWon).toBe("boolean");
      expect(typeof body.player1Over).toBe("boolean");
      expect(typeof body.player2Over).toBe("boolean");
      expect(typeof body.player1Diff).toBe("number");
      expect(typeof body.player2Diff).toBe("number");
    });

    it("should reject non-host requests", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/showcase/winner",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("GET /api/showcase/finalists", () => {
    it("should return finalists for host", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/showcase/finalists",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.finalists).toBeDefined();
      expect(body.finalists.player1).toBeDefined();
      expect(body.finalists.player2).toBeDefined();
      expect(body.finalists.player1.id).toBe(2);
      expect(body.finalists.player2.id).toBe(3);
    });

    it("should reject non-host requests", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/showcase/finalists",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
