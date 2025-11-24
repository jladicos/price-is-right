import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import { initDatabase, closeDatabase } from "../db/connection";
import { login } from "../services/auth";
import biddingRoutes from "./bidding";
import { addContestantToRow } from "../db/contestants";
import { updateGameWorkflow } from "../db/game-workflow";

// Mock the products utility
vi.mock("../utils/products.js", () => ({
  getProduct: vi.fn((id: string) => {
    const products: Record<string, { name: string; price: number }> = {
      "product-001": { name: "Car", price: 15000 },
    };
    return products[id];
  }),
}));

describe("Bidding API Integration Tests", () => {
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

    for (let i = 1; i <= 5; i++) {
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run(`Player${i}`, `Last${i}`, `CODE${i}`, "player");
    }

    // Get auth tokens
    hostToken = login(db, "HOST123").sessionToken;
    player1Token = login(db, "CODE1").sessionToken;
    player2Token = login(db, "CODE2").sessionToken;

    // Setup game state: Add 5 contestants
    for (let i = 1; i <= 5; i++) {
      addContestantToRow(i + 1, i, "section_1", "active"); // player_id = i+1 (skip host)
    }

    // Setup bidding phase
    updateGameWorkflow({
      current_segment: "section_1",
      current_segment_index: 0,
      phase_type: "bidding",
      phase_metadata: JSON.stringify({
        product_id: "product-001",
        is_fresh_row: true,
      }),
    });

    // Create test Fastify app
    app = Fastify();
    await app.register(biddingRoutes, { prefix: "/api" });
  });

  afterEach(async () => {
    await app.close();
    closeDatabase();
  });

  describe("POST /api/game/submit-bid", () => {
    it("should allow player to submit bid for themselves", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
        payload: {
          bid_amount: 14000,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.bid.bid_amount).toBe(14000);
      expect(body.bid.player_id).toBe(2); // player1 has id 2
      expect(body.allBidsSubmitted).toBe(false);
    });

    it("should allow host to submit bid for any player", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          player_id: 2,
          bid_amount: 14000,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.bid.bid_amount).toBe(14000);
      expect(body.bid.player_id).toBe(2);
    });

    it("should reject player submitting for another player", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
        payload: {
          player_id: 3, // Try to submit for player2
          bid_amount: 14000,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain("Cannot submit bid for another player");
    });

    it("should reject duplicate bid amounts", async () => {
      // First bid
      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
        payload: {
          bid_amount: 14000,
        },
      });

      // Second bid with same amount (from player2, position 2)
      const response = await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: {
          authorization: `Bearer ${player2Token}`,
        },
        payload: {
          bid_amount: 14000, // Duplicate
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain("already taken");
    });

    it("should reject bid when not player turn", async () => {
      // Try to bid as player2 when it's player1's turn
      const response = await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: {
          authorization: `Bearer ${player2Token}`,
        },
        payload: {
          bid_amount: 14000,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain("Not your turn");
    });

    it("should reject negative bid amount", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
        payload: {
          bid_amount: -100,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain("positive integer");
    });

    it("should reject zero bid amount", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
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

    it("should reject non-integer bid amount", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
        payload: {
          bid_amount: 14000.5,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it("should set allBidsSubmitted=true when all 5 bids submitted", async () => {
      // Submit 5 bids
      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 2, bid_amount: 14000 },
      });

      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 3, bid_amount: 15000 },
      });

      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 4, bid_amount: 13000 },
      });

      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 5, bid_amount: 12000 },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 6, bid_amount: 11000 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.allBidsSubmitted).toBe(true);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        payload: {
          bid_amount: 14000,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should require host to provide player_id", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          bid_amount: 14000,
          // Missing player_id
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("player_id required");
    });
  });

  describe("POST /api/game/show-product", () => {
    it("should allow host to show product", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/show-product",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("should reject non-host users", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/show-product",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/show-product",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/game/hide-product-modal", () => {
    it("should allow host to hide product modal", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/hide-product-modal",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("should reject non-host users", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/hide-product-modal",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/game/reveal-winner", () => {
    beforeEach(async () => {
      // Submit all 5 bids
      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 2, bid_amount: 14000 },
      });

      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 3, bid_amount: 15000 },
      });

      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 4, bid_amount: 13000 },
      });

      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 5, bid_amount: 12000 },
      });

      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 6, bid_amount: 11000 },
      });
    });

    it("should reveal winner when valid bids exist", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/reveal-winner",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.winner).toBeDefined();
      expect(body.winner.bid_amount).toBe(15000); // Exact match wins
      expect(body.productPrice).toBe(15000);
    });

    it("should handle all-over scenario", async () => {
      // Clear existing bids and submit all over-bids
      db.prepare("DELETE FROM bids").run();

      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 2, bid_amount: 16000 },
      });

      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 3, bid_amount: 17000 },
      });

      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 4, bid_amount: 18000 },
      });

      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 5, bid_amount: 19000 },
      });

      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 6, bid_amount: 20000 },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/game/reveal-winner",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.allOver).toBe(true);
      expect(body.newRetryNumber).toBe(1);
    });

    it("should reject non-host users", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/reveal-winner",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/game/unlock-bid", () => {
    let bidId: number;

    beforeEach(async () => {
      // Submit a bid to unlock
      const response = await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${player1Token}` },
        payload: { bid_amount: 14000 },
      });

      const body = JSON.parse(response.body);
      bidId = body.bid.id;
    });

    it("should allow host to unlock bid", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/unlock-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          bid_id: bidId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.bid.is_locked).toBe(0);
    });

    it("should reject non-host users", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/unlock-bid",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
        payload: {
          bid_id: bidId,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should reject invalid bid_id", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/unlock-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          bid_id: "not-a-number",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /api/game/update-bid", () => {
    let bidId: number;

    beforeEach(async () => {
      // Submit a bid to update
      const response = await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${player1Token}` },
        payload: { bid_amount: 14000 },
      });

      const body = JSON.parse(response.body);
      bidId = body.bid.id;
    });

    it("should allow host to update bid amount", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/update-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          bid_id: bidId,
          bid_amount: 14500,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.bid.bid_amount).toBe(14500);
    });

    it("should reject duplicate bid amounts", async () => {
      // Submit another bid
      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 3, bid_amount: 15000 },
      });

      // Try to update first bid to match second bid
      const response = await app.inject({
        method: "POST",
        url: "/api/game/update-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          bid_id: bidId,
          bid_amount: 15000, // Duplicate
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("already taken");
    });

    it("should reject non-host users", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/update-bid",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
        payload: {
          bid_id: bidId,
          bid_amount: 14500,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should reject negative amounts", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/update-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: {
          bid_id: bidId,
          bid_amount: -100,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/game/current-bids", () => {
    it("should return empty array when no bids exist", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/game/current-bids",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.bids).toEqual([]);
    });

    it("should return all bids for current round", async () => {
      // Submit some bids
      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 2, bid_amount: 14000 },
      });

      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${hostToken}` },
        payload: { player_id: 3, bid_amount: 15000 },
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/game/current-bids",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.bids).toHaveLength(2);
      expect(body.bids[0].bid_amount).toBe(14000);
      expect(body.bids[1].bid_amount).toBe(15000);
    });

    it("should include player information", async () => {
      await app.inject({
        method: "POST",
        url: "/api/game/submit-bid",
        headers: { authorization: `Bearer ${player1Token}` },
        payload: { bid_amount: 14000 },
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/game/current-bids",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
      });

      const body = JSON.parse(response.body);
      expect(body.bids[0].first_name).toBe("Player1");
      expect(body.bids[0].last_name).toBe("Last1");
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/game/current-bids",
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
