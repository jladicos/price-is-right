import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import { initDatabase, closeDatabase } from "../db/connection";
import { login } from "../services/auth";
import showcaseRoutes from "./showcase";
import { addContestantToRow } from "../db/contestants";
import { updateGameWorkflow } from "../db/game-workflow";
import { createWheelSpin } from "../db/wheel-spins";
import { createBid, updateBid as dbUpdateBid } from "../db/bids";

describe("Showcase API Integration Tests (No Mocks)", () => {
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

    // **CRITICAL: Setup real game data instead of mocking**
    // Add contestants who won their bidding rounds
    addContestantToRow(2, 1, "section_1", "won"); // Player 1 (id=2) in section 1
    addContestantToRow(3, 2, "section_2", "won"); // Player 2 (id=3) in section 2

    // Create bidding wins with real product IDs from products.json
    const bid1 = createBid(2, "lemon-juice", 1, "section_1", 250, 0);
    const bid2 = createBid(3, "apple-juice", 1, "section_2", 240, 0);

    // Mark as winners
    dbUpdateBid(bid1.id, { is_winner: 1 });
    dbUpdateBid(bid2.id, { is_winner: 1 });

    // Create wheel spins - these players won the wheel rounds
    createWheelSpin(2, "wheel_1", 1, 1.0, 0); // Player 1 gets $1.00 on wheel 1
    createWheelSpin(3, "wheel_2", 1, 0.95, 0); // Player 2 gets $0.95 on wheel 2

    // Create test Fastify app
    app = Fastify();
    await app.register(showcaseRoutes, { prefix: "/api" });
  });

  afterEach(async () => {
    await app.close();
    closeDatabase();
  });

  describe("POST /api/showcase/initialize", () => {
    it("should initialize showcase with real finalists from database", async () => {
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

      // Verify it found real players from database
      expect(body.state.finale_player1_id).toBe(2);
      expect(body.state.finale_player2_id).toBe(3);

      // Verify it calculated real product values
      expect(body.state.finale_player1_product_value).toBe(2.88); // lemon-juice
      expect(body.state.finale_player2_product_value).toBe(2.58); // apple-juice

      // Verify showcase assignments
      expect(body.state.finale_player1_showcase).toBeDefined();
      expect(body.state.finale_player2_showcase).toBeDefined();
      expect([1, 2]).toContain(body.state.finale_player1_showcase);
      expect([1, 2]).toContain(body.state.finale_player2_showcase);
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

    it("should fail when wheel winners are missing", async () => {
      // Delete wheel spins to simulate missing data
      db.prepare("DELETE FROM wheel_spins").run();

      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/initialize",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain("wheel winners");
    });

    it("should fail when bidding winners are missing", async () => {
      // Mark bids as not winners
      db.prepare("UPDATE bids SET is_winner = 0").run();

      const response = await app.inject({
        method: "POST",
        url: "/api/showcase/initialize",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain("bidding win");
    });
  });

  describe("Complete Showcase Flow (Real Integration)", () => {
    it("should handle complete showcase flow from start to winner", async () => {
      // Step 1: Initialize showcase
      const initResponse = await app.inject({
        method: "POST",
        url: "/api/showcase/initialize",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });
      expect(initResponse.statusCode).toBe(200);

      // Step 2: Get showcase state
      const stateResponse = await app.inject({
        method: "GET",
        url: "/api/showcase/state",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
      });
      expect(stateResponse.statusCode).toBe(200);
      const stateBody = JSON.parse(stateResponse.body);

      // Verify showcases have real products
      expect(stateBody.showcase1).toBeInstanceOf(Array);
      expect(stateBody.showcase2).toBeInstanceOf(Array);
      expect(stateBody.showcase1.length).toBeGreaterThan(0);
      expect(stateBody.showcase2.length).toBeGreaterThan(0);

      // Verify showcase values
      expect(stateBody.showcase1Value).toBeGreaterThan(0);
      expect(stateBody.showcase2Value).toBeGreaterThan(0);

      // Step 3: Player 1 submits bid
      const bid1Response = await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
        payload: {
          bid_amount: 8.5,
        },
      });
      expect(bid1Response.statusCode).toBe(200);

      // Step 4: Player 2 submits bid
      const bid2Response = await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${player2Token}`,
        },
        payload: {
          bid_amount: 14.0,
        },
      });
      expect(bid2Response.statusCode).toBe(200);

      // Step 5: Get bids
      const bidsResponse = await app.inject({
        method: "GET",
        url: "/api/showcase/bids",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });
      expect(bidsResponse.statusCode).toBe(200);
      const bidsBody = JSON.parse(bidsResponse.body);
      expect(bidsBody.bids.length).toBe(2);

      // Step 6: Preview winner
      const previewResponse = await app.inject({
        method: "GET",
        url: "/api/showcase/winner",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });
      expect(previewResponse.statusCode).toBe(200);
      const previewBody = JSON.parse(previewResponse.body);
      expect(previewBody.winnerId).toBeGreaterThan(0);

      // Step 7: Reveal winner
      const winnerResponse = await app.inject({
        method: "POST",
        url: "/api/showcase/reveal-winner",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });
      expect(winnerResponse.statusCode).toBe(200);
      const winnerBody = JSON.parse(winnerResponse.body);
      expect(winnerBody.winnerId).toBeGreaterThan(0);
      expect(typeof winnerBody.bonusWon).toBe("boolean");
      expect(winnerBody.retryNeeded).toBe(false);

      // Verify winner is stored in database
      const finalState = db
        .prepare("SELECT * FROM game_workflow WHERE id = 1")
        .get() as any;
      expect(finalState.finale_winner_id).toBe(winnerBody.winnerId);
    });

    it("should handle retry flow when both players go over", async () => {
      // Initialize
      await app.inject({
        method: "POST",
        url: "/api/showcase/initialize",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      // Both players bid way over
      await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: { player_id: 2, bid_amount: 100 },
      });

      await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: { player_id: 3, bid_amount: 100 },
      });

      // Check winner - should need retry
      const winnerResponse = await app.inject({
        method: "GET",
        url: "/api/showcase/winner",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });
      const winnerBody = JSON.parse(winnerResponse.body);
      expect(winnerBody.player1Over).toBe(true);
      expect(winnerBody.player2Over).toBe(true);

      // Initiate retry
      const retryResponse = await app.inject({
        method: "POST",
        url: "/api/showcase/retry",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });
      expect(retryResponse.statusCode).toBe(200);
      const retryBody = JSON.parse(retryResponse.body);
      expect(retryBody.retryNumber).toBe(1);

      // Submit new bids
      await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: { player_id: 2, bid_amount: 8.5 },
      });

      await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
        payload: { player_id: 3, bid_amount: 14.0 },
      });

      // Verify bids table has retry_number = 1
      const retryBids = db
        .prepare("SELECT * FROM showcase_bids WHERE retry_number = 1")
        .all();
      expect(retryBids.length).toBe(2);

      // Check winner again - should have winner now
      const finalWinnerResponse = await app.inject({
        method: "GET",
        url: "/api/showcase/winner",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });
      const finalWinnerBody = JSON.parse(finalWinnerResponse.body);
      expect(finalWinnerBody.winnerId).toBeGreaterThan(0);
      expect(finalWinnerBody.player1Over).toBe(false);
      expect(finalWinnerBody.player2Over).toBe(false);
    });

    it("should handle pass scenario with correct showcase reassignment", async () => {
      // Initialize
      const initResponse = await app.inject({
        method: "POST",
        url: "/api/showcase/initialize",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });
      const initBody = JSON.parse(initResponse.body);
      const originalPlayer1Showcase = initBody.state.finale_player1_showcase;

      // Player 1 passes
      await app.inject({
        method: "POST",
        url: "/api/showcase/pass",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });

      // Get new state
      const stateResponse = await app.inject({
        method: "GET",
        url: "/api/showcase/state",
        headers: {
          authorization: `Bearer ${hostToken}`,
        },
      });
      const stateBody = JSON.parse(stateResponse.body);

      // Showcases should be swapped
      expect(stateBody.state.finale_player1_showcase).not.toBe(
        originalPlayer1Showcase,
      );

      // Submit bid and verify it goes to correct showcase
      await app.inject({
        method: "POST",
        url: "/api/showcase/submit-bid",
        headers: {
          authorization: `Bearer ${player1Token}`,
        },
        payload: { bid_amount: 10 },
      });

      // Check database
      const bid = db
        .prepare("SELECT * FROM showcase_bids WHERE player_id = 2")
        .get() as any;
      expect(bid.showcase_number).toBe(
        stateBody.state.finale_player1_showcase,
      );
    });
  });
});
