import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import gameRoutes from "./game.js";
import { initDatabase, closeDatabase } from "../db/connection.js";
import Database from "better-sqlite3";
import { setGameEnabled } from "../db/game-state.js";

describe("Game API Routes", () => {
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

    // Create audience members for contestant selection
    for (let i = 1; i <= 10; i++) {
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role, active) VALUES (?, ?, ?, ?, ?)",
      ).run(
        `Audience${i}`,
        "Member",
        `AUD${i.toString().padStart(3, "0")}`,
        "audience",
        1,
      );
    }

    hostToken = "host-token-123";
    playerToken = "player-token-456";

    app = Fastify();
    await app.register(gameRoutes, { prefix: "/api" });
  });

  afterEach(async () => {
    await app.close();
    closeDatabase();
  });

  describe("GET /api/game/status", () => {
    it("should return game status when authenticated as host", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/game/status",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("enabled");
      expect(typeof body.enabled).toBe("boolean");
      expect(body.enabled).toBe(true); // Default from migration
    });

    it("should return game status when authenticated as player", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/game/status",
        headers: {
          Authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("enabled");
      expect(body.enabled).toBe(true);
    });

    it("should return 401 when not authenticated", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/game/status",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 401 with invalid token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/game/status",
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reflect game state changes", async () => {
      // Disable the game
      setGameEnabled(db, false);

      const response = await app.inject({
        method: "GET",
        url: "/api/game/status",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.enabled).toBe(false);
    });
  });

  describe("PUT /api/game/status", () => {
    it("should update game status when authenticated as host", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/game/status",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          enabled: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.enabled).toBe(false);
      expect(body.message).toBe("Game disabled");

      // Verify it was actually updated in database
      const statusResponse = await app.inject({
        method: "GET",
        url: "/api/game/status",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const statusBody = JSON.parse(statusResponse.body);
      expect(statusBody.enabled).toBe(false);
    });

    it("should enable game with appropriate message", async () => {
      // First disable
      setGameEnabled(db, false);

      // Then enable
      const response = await app.inject({
        method: "PUT",
        url: "/api/game/status",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          enabled: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.enabled).toBe(true);
      expect(body.message).toBe("Game enabled");
    });

    it("should return 403 when authenticated as non-host", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/game/status",
        headers: {
          Authorization: `Bearer ${playerToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          enabled: false,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 401 when not authenticated", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/game/status",
        headers: {
          "Content-Type": "application/json",
        },
        payload: {
          enabled: false,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 400 with missing enabled field", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/game/status",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("enabled must be a boolean");
    });

    it("should return 400 with non-boolean enabled field", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/game/status",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          enabled: "true", // String instead of boolean
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("enabled must be a boolean");
    });

    it("should return 400 with null enabled field", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/game/status",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          enabled: null,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("enabled must be a boolean");
    });

    it("should handle rapid toggle changes", async () => {
      // Toggle multiple times quickly
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: "PUT",
          url: "/api/game/status",
          headers: {
            Authorization: `Bearer ${hostToken}`,
            "Content-Type": "application/json",
          },
          payload: {
            enabled: i % 2 === 0,
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.enabled).toBe(i % 2 === 0);
      }

      // Final state should be false (i=4, even)
      const statusResponse = await app.inject({
        method: "GET",
        url: "/api/game/status",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const statusBody = JSON.parse(statusResponse.body);
      expect(statusBody.enabled).toBe(true); // i=4 is even, so enabled=true
    });
  });

  describe("Edge Cases", () => {
    it("should handle setting game to same state repeatedly", async () => {
      // Set to false multiple times
      for (let i = 0; i < 3; i++) {
        const response = await app.inject({
          method: "PUT",
          url: "/api/game/status",
          headers: {
            Authorization: `Bearer ${hostToken}`,
            "Content-Type": "application/json",
          },
          payload: {
            enabled: false,
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.enabled).toBe(false);
      }
    });

    it("should handle malformed JSON gracefully", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/game/status",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: "{invalid json",
      });

      // Fastify will handle JSON parse errors
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it("should not accept extra fields in payload", async () => {
      // This should still work, just ignore extra fields
      const response = await app.inject({
        method: "PUT",
        url: "/api/game/status",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          enabled: false,
          extraField: "should be ignored",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.enabled).toBe(false);
    });
  });

  describe("POST /api/game/start", () => {
    it("should start a new game and auto-select 5 contestants", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.state).toBeDefined();
      expect(body.state.workflow).toBeDefined();
      expect(body.state.workflow.phase_type).toBe("bidding"); // First phase from config
      expect(body.state.workflow.current_segment).toBe("section_1");
      expect(body.state.workflow.current_segment_index).toBe(0);
      expect(body.state.contestantsRow).toHaveLength(5);
      // All contestants should be pending_reveal
      expect(
        body.state.contestantsRow.every(
          (c: { status: string }) => c.status === "pending_reveal",
        ),
      ).toBe(true);
    });

    it("should select 5 unique contestants", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Extract player IDs
      const playerIds = body.state.contestantsRow.map(
        (c: { player_id: number }) => c.player_id,
      );

      // Check for uniqueness
      const uniqueIds = new Set(playerIds);
      expect(uniqueIds.size).toBe(5); // All 5 should be unique
    });

    it("should reset previous game data", async () => {
      // Start first game
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      // Verify contestants exist
      const state1 = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      expect(JSON.parse(state1.body).state.contestantsRow.length).toBe(5);

      // Start second game
      const response = await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify old contestants are gone from active list
      const state2 = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const newContestants = JSON.parse(state2.body).state.contestantsRow;
      expect(newContestants.length).toBe(5);

      // Verify in database that old contestants_row was cleared
      const allContestants = db.prepare("SELECT * FROM contestants_row").all();
      const activeContestants = allContestants.filter(
        (c: { status: string }) => c.status !== "replaced",
      );
      expect(activeContestants.length).toBe(5); // Only new ones
    });

    it("should fail with insufficient audience members", async () => {
      // Deactivate all but 3 audience members
      db.prepare("UPDATE players SET active = 0 WHERE role = 'audience'").run();

      const response = await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });

    it("should require host role", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/start",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/game/state", () => {
    it("should return current game state for authenticated user", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.state).toBeDefined();
      expect(body.state.workflow).toBeDefined();
      expect(body.state.contestantsRow).toBeDefined();
      expect(body.state.eligibleAudienceCount).toBe(10); // 10 audience members created
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/game/state",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/game/reveal-contestant", () => {
    it("should reveal a contestant and update player role", async () => {
      // Start game first
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      // Get state to find a contestant
      const stateResponse = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const state = JSON.parse(stateResponse.body).state;
      const contestant = state.contestantsRow[0];

      // Reveal the contestant
      const response = await app.inject({
        method: "POST",
        url: "/api/game/reveal-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: contestant.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.contestant).toBeDefined();
      expect(body.contestant.status).toBe("active");
      expect(body.contestant.role).toBe("player"); // Role should be updated
      expect(body.contestant.revealed_at).toBeDefined();
    });

    it("should require host role", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/reveal-contestant",
        headers: {
          Authorization: `Bearer ${playerToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: 1,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 400 with missing contestantRowId", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/reveal-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("contestantRowId");
    });

    it("should fail when revealing non-existent contestant", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/reveal-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: 99999, // Non-existent ID
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it("should update player role from audience to player in database", async () => {
      // Start game
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      // Get contestant
      const state = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const contestant = JSON.parse(state.body).state.contestantsRow[0];

      // Verify player is audience before reveal
      expect(contestant.role).toBe("audience");

      // Reveal contestant
      await app.inject({
        method: "POST",
        url: "/api/game/reveal-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: contestant.id,
        },
      });

      // Verify player role changed in database
      const player = db
        .prepare("SELECT role FROM players WHERE id = ?")
        .get(contestant.player_id) as { role: string };
      expect(player.role).toBe("player");
    });

    it("should be idempotent - revealing same contestant twice should succeed", async () => {
      // Start game
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      const state = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const contestant = JSON.parse(state.body).state.contestantsRow[0];

      // First reveal
      await app.inject({
        method: "POST",
        url: "/api/game/reveal-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: contestant.id,
        },
      });

      // Second reveal of same contestant should succeed (idempotent)
      const response = await app.inject({
        method: "POST",
        url: "/api/game/reveal-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: contestant.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.contestant.status).toBe("active");
      expect(body.contestant.role).toBe("player");
    });
  });

  describe("POST /api/game/replace-contestant-random", () => {
    it("should replace a contestant with random selection", async () => {
      // Start game first
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      // Get state to find a contestant
      const stateResponse = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const state = JSON.parse(stateResponse.body).state;
      const contestant = state.contestantsRow[0];

      // Replace the contestant
      const response = await app.inject({
        method: "POST",
        url: "/api/game/replace-contestant-random",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: contestant.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.contestant).toBeDefined();
      expect(body.contestant.status).toBe("pending_reveal"); // New contestant needs reveal
    });

    it("should mark old contestant as replaced in database", async () => {
      // Start game
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      const state = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const oldContestant = JSON.parse(state.body).state.contestantsRow[0];
      const oldContestantId = oldContestant.id;

      // Replace the contestant
      await app.inject({
        method: "POST",
        url: "/api/game/replace-contestant-random",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: oldContestantId,
        },
      });

      // Verify old contestant marked as replaced in database
      const dbContestant = db
        .prepare("SELECT status FROM contestants_row WHERE id = ?")
        .get(oldContestantId) as { status: string };
      expect(dbContestant.status).toBe("replaced");
    });

    it("should select a contestant from eligible pool when replacing", async () => {
      // Start game
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      const state = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const oldContestant = JSON.parse(state.body).state.contestantsRow[0];

      // Replace the contestant
      const response = await app.inject({
        method: "POST",
        url: "/api/game/replace-contestant-random",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: oldContestant.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // New contestant should be someone from the eligible pool (could be same player after being replaced)
      expect(body.contestant.player_id).toBeGreaterThan(0);
      expect(body.contestant.status).toBe("pending_reveal");
    });

    it("should preserve the position of replaced contestant", async () => {
      // Start game
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      const state = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const oldContestant = JSON.parse(state.body).state.contestantsRow[2]; // Position 3
      const expectedPosition = oldContestant.position;

      // Replace the contestant
      const response = await app.inject({
        method: "POST",
        url: "/api/game/replace-contestant-random",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: oldContestant.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.contestant.position).toBe(expectedPosition);
    });

    it("should fail when no eligible audience members available", async () => {
      // Start game
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      // Deactivate ALL audience members (including the 5 selected)
      db.prepare("UPDATE players SET active = 0 WHERE role = 'audience'").run();

      // Verify no active audience members
      const audienceCount = db
        .prepare(
          "SELECT COUNT(*) as count FROM players WHERE role = 'audience' AND active = 1",
        )
        .get() as { count: number };
      expect(audienceCount.count).toBe(0);

      const state = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const contestant = JSON.parse(state.body).state.contestantsRow[0];

      // Try to replace when no eligible audience
      const response = await app.inject({
        method: "POST",
        url: "/api/game/replace-contestant-random",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: contestant.id,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("No eligible audience");
    });

    it("should require host role", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/replace-contestant-random",
        headers: {
          Authorization: `Bearer ${playerToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: 1,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/game/replace-contestant-manual", () => {
    it("should replace contestant with specific player", async () => {
      // Start game first
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      // Get state to find a contestant
      const stateResponse = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const state = JSON.parse(stateResponse.body).state;
      const contestant = state.contestantsRow[0];

      // Find an audience member not already selected
      const allPlayers = db
        .prepare("SELECT * FROM players WHERE role = ?")
        .all("audience") as Array<{ id: number }>;
      const selectedIds = new Set(
        state.contestantsRow.map((c: { player_id: number }) => c.player_id),
      );
      const availablePlayer = allPlayers.find((p) => !selectedIds.has(p.id));

      // Replace with specific player
      const response = await app.inject({
        method: "POST",
        url: "/api/game/replace-contestant-manual",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: contestant.id,
          newPlayerId: availablePlayer.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.contestant.player_id).toBe(availablePlayer.id);
    });

    it("should require both contestantRowId and newPlayerId", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/replace-contestant-manual",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: 1,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("newPlayerId");
    });

    it("should give audience member pending_reveal status", async () => {
      // Start game
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      const state = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const contestant = JSON.parse(state.body).state.contestantsRow[0];

      // Find an audience member not selected
      const allPlayers = db
        .prepare("SELECT * FROM players WHERE role = ?")
        .all("audience") as Array<{ id: number }>;
      const selectedIds = new Set(
        JSON.parse(state.body).state.contestantsRow.map(
          (c: { player_id: number }) => c.player_id,
        ),
      );
      const audienceMember = allPlayers.find((p) => !selectedIds.has(p.id));

      // Replace with audience member
      const response = await app.inject({
        method: "POST",
        url: "/api/game/replace-contestant-manual",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: contestant.id,
          newPlayerId: audienceMember!.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.contestant.status).toBe("pending_reveal"); // Audience needs reveal
    });

    it("should give existing player active status immediately", async () => {
      // Start game and reveal a contestant to create a player
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      const state = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const firstContestant = JSON.parse(state.body).state.contestantsRow[0];

      // Reveal to make them a player
      await app.inject({
        method: "POST",
        url: "/api/game/reveal-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: firstContestant.id,
        },
      });

      // Replace the first contestant with someone else (removing them from the row)
      const newAudienceMember = db
        .prepare(
          "SELECT id FROM players WHERE role = 'audience' AND active = 1 LIMIT 1",
        )
        .get() as { id: number };
      await app.inject({
        method: "POST",
        url: "/api/game/replace-contestant-manual",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: firstContestant.id,
          newPlayerId: newAudienceMember.id,
        },
      });

      // Now replace another contestant with the original player (who is no longer in the row but has role='player')
      const secondContestant = JSON.parse(state.body).state.contestantsRow[1];
      const response = await app.inject({
        method: "POST",
        url: "/api/game/replace-contestant-manual",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: secondContestant.id,
          newPlayerId: firstContestant.player_id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.contestant.status).toBe("active"); // Existing player is immediately active
    });

    it("should fail when replacing with inactive player", async () => {
      // Start game
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      const state = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const contestant = JSON.parse(state.body).state.contestantsRow[0];

      // Find an inactive player
      const inactivePlayer = db
        .prepare("SELECT id FROM players WHERE active = 0 LIMIT 1")
        .get() as { id: number } | undefined;

      // If no inactive player, create one
      let inactiveId: number;
      if (!inactivePlayer) {
        const result = db
          .prepare(
            "INSERT INTO players (first_name, last_name, access_code, role, active) VALUES ('Inactive', 'User', 'INACT', 'audience', 0)",
          )
          .run();
        inactiveId = result.lastInsertRowid as number;
      } else {
        inactiveId = inactivePlayer.id;
      }

      // Try to replace with inactive player
      const response = await app.inject({
        method: "POST",
        url: "/api/game/replace-contestant-manual",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: contestant.id,
          newPlayerId: inactiveId,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("not active");
    });

    it("should require host role", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/replace-contestant-manual",
        headers: {
          Authorization: `Bearer ${playerToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: 1,
          newPlayerId: 2,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/game/manual-select-contestant", () => {
    it("should manually select a player to empty position", async () => {
      // Start game first
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      // Find an audience member not selected
      const eligiblePlayer = db
        .prepare(
          "SELECT id FROM players WHERE role = 'audience' AND active = 1 AND id NOT IN (SELECT player_id FROM contestants_row WHERE status IN ('active', 'pending_reveal')) LIMIT 1",
        )
        .get() as { id: number };

      // Replace position 1
      const response = await app.inject({
        method: "POST",
        url: "/api/game/manual-select-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          playerId: eligiblePlayer.id,
          position: 3,
          segment: "section_1",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.contestant.player_id).toBe(eligiblePlayer.id);
      expect(body.contestant.position).toBe(3);
      expect(body.contestant.status).toBe("pending_reveal");
    });

    it("should replace existing contestant when position is occupied", async () => {
      // Start game first
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      // Get first contestant
      const stateResponse = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const oldContestant = JSON.parse(stateResponse.body).state
        .contestantsRow[0];

      // Find an audience member not selected
      const eligiblePlayer = db
        .prepare(
          "SELECT id FROM players WHERE role = 'audience' AND active = 1 AND id NOT IN (SELECT player_id FROM contestants_row WHERE status IN ('active', 'pending_reveal')) LIMIT 1",
        )
        .get() as { id: number };

      // Replace at same position
      const response = await app.inject({
        method: "POST",
        url: "/api/game/manual-select-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          playerId: eligiblePlayer.id,
          position: oldContestant.position,
          segment: "section_1",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.contestant.player_id).toBe(eligiblePlayer.id);
      expect(body.contestant.position).toBe(oldContestant.position);

      // Verify old contestant marked as replaced
      const dbContestant = db
        .prepare("SELECT status FROM contestants_row WHERE id = ?")
        .get(oldContestant.id) as { status: string };
      expect(dbContestant.status).toBe("replaced");
    });

    it("should create pending_reveal status even for existing players", async () => {
      // Clear any existing contestants to ensure clean state
      db.prepare("DELETE FROM contestants_row").run();

      // Create a fresh player specifically for this test (not from the existing audience pool)
      // This simulates a player who was previously a contestant but is no longer in the row
      const result = db
        .prepare(
          "INSERT INTO players (first_name, last_name, access_code, role, active) VALUES (?, ?, ?, ?, ?)",
        )
        .run("ExistingPlayer", "Test", "EXIST999", "player", 1);

      const existingPlayerId = result.lastInsertRowid as number;

      // Ensure game is started
      const gameState = db.prepare("SELECT * FROM game_workflow").get() as
        | {
            game_enabled: number;
          }
        | undefined;

      if (!gameState || !gameState.game_enabled) {
        await app.inject({
          method: "POST",
          url: "/api/game/start",
          headers: {
            Authorization: `Bearer ${hostToken}`,
          },
        });
      }

      // Now manually select this player (who has role='player' but is not in the row) for position 4
      const response = await app.inject({
        method: "POST",
        url: "/api/game/manual-select-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          playerId: existingPlayerId,
          position: 4,
          segment: "section_1",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.contestant.status).toBe("pending_reveal");
    });

    it("should require host role", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/manual-select-contestant",
        headers: {
          Authorization: `Bearer ${playerToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          playerId: 1,
          position: 1,
          segment: "section_1",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should validate playerId is required", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/manual-select-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          position: 1,
          segment: "section_1",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("playerId");
    });

    it("should validate position is required", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/manual-select-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          playerId: 1,
          segment: "section_1",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("position");
    });

    it("should validate segment is required", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/manual-select-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          playerId: 1,
          position: 1,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("segment");
    });
  });

  describe("POST /api/game/refresh-contestants-row", () => {
    it("should refresh all 5 contestants for a segment", async () => {
      // Start game first
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/game/refresh-contestants-row",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          segment: "section_1",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.contestants).toHaveLength(5);
      // All should be pending_reveal
      expect(
        body.contestants.every(
          (c: { status: string }) => c.status === "pending_reveal",
        ),
      ).toBe(true);
    });

    it("should require valid segment", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/refresh-contestants-row",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          segment: "invalid_segment",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("segment");
    });

    it("should mark all old contestants as replaced in database", async () => {
      // Start game
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      const stateBefore = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const oldContestantIds = JSON.parse(
        stateBefore.body,
      ).state.contestantsRow.map((c: { id: number }) => c.id);

      // Refresh the row
      await app.inject({
        method: "POST",
        url: "/api/game/refresh-contestants-row",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          segment: "section_1",
        },
      });

      // Verify all old contestants marked as replaced
      for (const oldId of oldContestantIds) {
        const contestant = db
          .prepare("SELECT status FROM contestants_row WHERE id = ?")
          .get(oldId) as { status: string };
        expect(contestant.status).toBe("replaced");
      }
    });

    it("should select 5 unique contestants", async () => {
      // Start game
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      // Refresh the row
      const response = await app.inject({
        method: "POST",
        url: "/api/game/refresh-contestants-row",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          segment: "section_1",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const playerIds = body.contestants.map(
        (c: { player_id: number }) => c.player_id,
      );

      // Verify uniqueness
      const uniqueIds = new Set(playerIds);
      expect(uniqueIds.size).toBe(5);
    });

    it("should fail when insufficient audience members available", async () => {
      // Start game
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      // Deactivate all but 3 audience members
      db.prepare("UPDATE players SET active = 0 WHERE role = 'audience'").run();
      // Reactivate only 3
      db.prepare(
        "UPDATE players SET active = 1 WHERE role = 'audience' LIMIT 3",
      ).run();

      // Try to refresh (needs 5, only 3 available)
      const response = await app.inject({
        method: "POST",
        url: "/api/game/refresh-contestants-row",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          segment: "section_1",
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Not enough eligible audience");
    });

    it("should require host role", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/refresh-contestants-row",
        headers: {
          Authorization: `Bearer ${playerToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          segment: "section_1",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/game/advance", () => {
    it("should advance to next phase in config", async () => {
      // Start game first (will be at first bidding phase)
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      // Advance to next phase
      const response = await app.inject({
        method: "POST",
        url: "/api/game/advance",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.state.workflow.current_segment_index).toBe(1);
    });

    it("should not auto-select when all positions are filled", async () => {
      // Start game (fills all 5 positions)
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      // Get initial contestant count
      const initialState = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const initialCount = JSON.parse(initialState.body).state.contestantsRow
        .length;
      expect(initialCount).toBe(5); // All positions filled

      // Advance (should NOT select replacement since positions are full)
      const response = await app.inject({
        method: "POST",
        url: "/api/game/advance",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200); // Should succeed
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Check that no additional contestant was added
      const finalState = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const finalCount = JSON.parse(finalState.body).state.contestantsRow
        .length;

      expect(finalCount).toBe(initialCount); // Same count, no new contestant
    });

    it("should auto-select replacement when position is empty", async () => {
      // Start game
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      // Get a contestant and manually mark them as replaced to create empty position
      const state = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const contestantId = JSON.parse(state.body).state.contestantsRow[0].id;

      // Mark contestant as replaced (simulate winner leaving)
      db.prepare(
        "UPDATE contestants_row SET status = 'replaced' WHERE id = ?",
      ).run(contestantId);

      // Get count before advance
      const beforeState = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const beforeCount = JSON.parse(beforeState.body).state.contestantsRow
        .length;
      expect(beforeCount).toBe(4); // One was replaced

      // Advance (should auto-select replacement)
      const response = await app.inject({
        method: "POST",
        url: "/api/game/advance",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify a new contestant was selected
      const afterState = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const afterCount = JSON.parse(afterState.body).state.contestantsRow
        .length;

      expect(afterCount).toBe(5); // Back to 5 contestants
    });

    it("should transition from section_1 to section_1_finale", async () => {
      // Start game at section_1[0]
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      // Advance through all section_1 phases
      // products.json has 2 bidding phases in section_1
      for (let i = 0; i < 2; i++) {
        await app.inject({
          method: "POST",
          url: "/api/game/advance",
          headers: {
            Authorization: `Bearer ${hostToken}`,
          },
        });
      }

      // Get current state - should be at section_1_finale now
      const response = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.state.workflow.current_segment).toBe("section_1_finale");
      expect(body.state.workflow.phase_type).toBe("wheel");
    });

    it("should transition from section_1_finale to section_2", async () => {
      // Override to section_1_finale
      await app.inject({
        method: "POST",
        url: "/api/game/override-phase",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          segment: "section_1_finale",
          segmentIndex: 0,
          phaseType: "wheel",
        },
      });

      // Advance from finale to section_2
      const response = await app.inject({
        method: "POST",
        url: "/api/game/advance",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.state.workflow.current_segment).toBe("section_2");
      expect(body.state.workflow.current_segment_index).toBe(0);
      expect(body.state.workflow.phase_type).toBe("bidding"); // First phase of section_2
    });

    it("should transition from section_2 to section_2_finale", async () => {
      // Override to section_2[0]
      await app.inject({
        method: "POST",
        url: "/api/game/override-phase",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          segment: "section_2",
          segmentIndex: 0,
          phaseType: "bidding",
        },
      });

      // Advance through all section_2 phases (2 bidding phases)
      for (let i = 0; i < 2; i++) {
        await app.inject({
          method: "POST",
          url: "/api/game/advance",
          headers: {
            Authorization: `Bearer ${hostToken}`,
          },
        });
      }

      // Get current state - should be at section_2_finale now
      const response = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.state.workflow.current_segment).toBe("section_2_finale");
      expect(body.state.workflow.phase_type).toBe("wheel");
    });

    it("should transition from section_2_finale to finale", async () => {
      // Override to section_2_finale
      await app.inject({
        method: "POST",
        url: "/api/game/override-phase",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          segment: "section_2_finale",
          segmentIndex: 0,
          phaseType: "wheel",
        },
      });

      // Advance to finale
      const response = await app.inject({
        method: "POST",
        url: "/api/game/advance",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.state.workflow.current_segment).toBe("finale");
      expect(body.state.workflow.phase_type).toBe("showcase");
    });

    it("should set phase metadata correctly from config", async () => {
      // Start game
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      // Get initial state
      const initialState = await app.inject({
        method: "GET",
        url: "/api/game/state",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const initialMetadata = JSON.parse(initialState.body).state.workflow
        .phase_metadata;
      const initialPhaseData = JSON.parse(initialMetadata);

      // Should have bidding phase with product_id
      expect(initialPhaseData.type).toBe("bidding");
      expect(initialPhaseData.product_id).toBeDefined();
      expect(typeof initialPhaseData.product_id).toBe("string");
    });

    it("should fail when advancing beyond finale", async () => {
      // Override to finale
      await app.inject({
        method: "POST",
        url: "/api/game/override-phase",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          segment: "finale",
          segmentIndex: 0,
          phaseType: "showcase",
        },
      });

      // Try to advance beyond finale
      const response = await app.inject({
        method: "POST",
        url: "/api/game/advance",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Cannot advance beyond finale");
    });

    it("should require host role", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/advance",
        headers: {
          Authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/game/override-phase", () => {
    it("should override to specific phase", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/override-phase",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          segment: "section_2",
          segmentIndex: 0,
          phaseType: "bidding",
          phaseMetadata: { type: "bidding", product_id: "test-product" },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.state.workflow.current_segment).toBe("section_2");
      expect(body.state.workflow.current_segment_index).toBe(0);
      expect(body.state.workflow.phase_type).toBe("bidding");
    });

    it("should require all fields", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/override-phase",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          segment: "section_2",
          // Missing segmentIndex and phaseType
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should actually update workflow in database", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/override-phase",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          segment: "section_2",
          segmentIndex: 2,
          phaseType: "bidding",
          phaseMetadata: { type: "bidding", product_id: "test-123" },
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify database was actually updated
      const dbWorkflow = db
        .prepare("SELECT * FROM game_workflow WHERE id = 1")
        .get() as {
        current_segment: string;
        current_segment_index: number;
        phase_type: string;
        phase_metadata: string;
      };

      expect(dbWorkflow.current_segment).toBe("section_2");
      expect(dbWorkflow.current_segment_index).toBe(2);
      expect(dbWorkflow.phase_type).toBe("bidding");

      const metadata = JSON.parse(dbWorkflow.phase_metadata);
      expect(metadata.product_id).toBe("test-123");
    });

    it("should handle invalid segment gracefully", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/override-phase",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          segment: "invalid_segment_name",
          segmentIndex: 0,
          phaseType: "bidding",
        },
      });

      // Should succeed - we don't validate segment names in override (emergency tool)
      // But it will cause issues when trying to advance
      expect(response.statusCode).toBe(200);
    });

    it("should require host role", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/override-phase",
        headers: {
          Authorization: `Bearer ${playerToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          segment: "section_2",
          segmentIndex: 0,
          phaseType: "bidding",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("Edge Cases & Data Validation", () => {
    it("should handle large audience pool efficiently", async () => {
      // Create 100 additional audience members
      for (let i = 0; i < 100; i++) {
        db.prepare(
          "INSERT INTO players (first_name, last_name, access_code, role, active) VALUES (?, ?, ?, 'audience', 1)",
        ).run(`Bulk${i}`, "User", `BULK${i.toString().padStart(3, "0")}`);
      }

      // Start game should still work and select 5 unique contestants
      const response = await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.state.contestantsRow).toHaveLength(5);

      // Verify uniqueness
      const playerIds = body.state.contestantsRow.map(
        (c: { player_id: number }) => c.player_id,
      );
      const uniqueIds = new Set(playerIds);
      expect(uniqueIds.size).toBe(5);
    });

    it("should handle empty contestantRowId field", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/reveal-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: 0,
        },
      });

      // 0 is falsy, should be rejected
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("contestantRowId");
    });

    it("should handle negative contestant ID", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/reveal-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: -1,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it("should reject string when number expected", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/reveal-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: "invalid",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /api/game/wheel-start", () => {
    it("should start wheel phase successfully", async () => {
      // Setup: Start game and create bidding winner
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      // Reveal first contestant to make them active (eligible spinner)
      const contestant = db
        .prepare(
          "SELECT id FROM contestants_row WHERE game_segment = 'section_1' LIMIT 1",
        )
        .get() as { id: number };

      await app.inject({
        method: "POST",
        url: "/api/game/reveal-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: contestant.id,
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.workflow).toBeDefined();
      expect(body.workflow.phase_type).toBe("wheel");
      expect(body.state).toBeDefined();
      expect(body.state.workflow.phase_type).toBe("wheel");
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-start",
        payload: {
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should require host role", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-start",
        headers: {
          Authorization: `Bearer ${playerToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should validate gameSegment is required", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("gameSegment");
    });

    it("should fail if game not started", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain("not started");
    });

    it("should fail if no eligible spinners", async () => {
      // Start game and manually set phase to something other than not_started
      // to pass the validation, but don't create any contestants
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      // Delete all contestants to simulate no eligible spinners
      db.prepare("DELETE FROM contestants_row").run();

      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain("No eligible spinners");
    });
  });

  describe("POST /api/game/wheel-spin", () => {
    let winnerId: number;

    beforeEach(async () => {
      // Setup: Start game, reveal contestant, start wheel phase
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      const contestantRow = db
        .prepare(
          "SELECT id, player_id FROM contestants_row WHERE game_segment = 'section_1' LIMIT 1",
        )
        .get() as { id: number; player_id: number };

      winnerId = contestantRow.player_id;

      // Reveal contestant to make them active
      await app.inject({
        method: "POST",
        url: "/api/game/reveal-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: contestantRow.id,
        },
      });

      await app.inject({
        method: "POST",
        url: "/api/game/wheel-start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          gameSegment: "section_1",
        },
      });
    });

    it("should process wheel spin successfully", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-spin",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          playerId: winnerId,
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.spin).toBeDefined();
      expect(body.spin.result).toBeGreaterThanOrEqual(0.05);
      expect(body.spin.result).toBeLessThanOrEqual(1.0);
      expect(body.total).toBe(body.spin.result);
      expect(typeof body.eliminated).toBe("boolean");
      expect(body.state).toBeDefined();
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-spin",
        payload: {
          playerId: winnerId,
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should allow player to spin", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-spin",
        headers: {
          Authorization: `Bearer ${playerToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          playerId: winnerId,
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("should validate playerId is required", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-spin",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("playerId");
    });

    it("should validate gameSegment is required", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-spin",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          playerId: winnerId,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("gameSegment");
    });

    it("should fail if phase is not wheel", async () => {
      // Override phase back to bidding
      db.prepare(
        "UPDATE game_workflow SET phase_type = 'bidding', phase_metadata = NULL",
      ).run();

      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-spin",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          playerId: winnerId,
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it("should handle player elimination on going over", async () => {
      // Force a spin that goes over 1.00
      db.prepare(
        "INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number) VALUES (?, ?, ?, ?, ?)",
      ).run(winnerId, "section_1", 1, 0.95, 0);

      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-spin",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          playerId: winnerId,
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.total).toBeGreaterThan(1.0);
      expect(body.eliminated).toBe(true);
    });
  });

  describe("POST /api/game/wheel-stay", () => {
    let winnerId: number;

    beforeEach(async () => {
      // Setup: Start game, reveal contestant, start wheel phase
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      const contestantRow = db
        .prepare(
          "SELECT id, player_id FROM contestants_row WHERE game_segment = 'section_1' LIMIT 1",
        )
        .get() as { id: number; player_id: number };

      winnerId = contestantRow.player_id;

      // Reveal contestant to make them active
      await app.inject({
        method: "POST",
        url: "/api/game/reveal-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: contestantRow.id,
        },
      });

      await app.inject({
        method: "POST",
        url: "/api/game/wheel-start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          gameSegment: "section_1",
        },
      });

      // Player spins once
      await app.inject({
        method: "POST",
        url: "/api/game/wheel-spin",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          playerId: winnerId,
          gameSegment: "section_1",
        },
      });
    });

    it("should complete player turn successfully", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-stay",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          playerId: winnerId,
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(typeof body.allPlayersFinished).toBe("boolean");
      expect(typeof body.needsSpinoff).toBe("boolean");
      expect(body.tiedPlayerIds).toBeInstanceOf(Array);
      expect(body.state).toBeDefined();
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-stay",
        payload: {
          playerId: winnerId,
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should allow player to stay", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-stay",
        headers: {
          Authorization: `Bearer ${playerToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          playerId: winnerId,
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("should validate playerId is required", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-stay",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("playerId");
    });

    it("should validate gameSegment is required", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-stay",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          playerId: winnerId,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("gameSegment");
    });

    it("should fail if phase is not wheel", async () => {
      // Override phase back to bidding
      db.prepare(
        "UPDATE game_workflow SET phase_type = 'bidding', phase_metadata = NULL",
      ).run();

      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-stay",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          playerId: winnerId,
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it("should fail if player has no spins", async () => {
      // Delete the spin we made in beforeEach
      db.prepare("DELETE FROM wheel_spins WHERE player_id = ?").run(winnerId);

      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-stay",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          playerId: winnerId,
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain("no spins");
    });
  });

  describe("POST /api/game/wheel-start-spinoff", () => {
    let winner1Id: number;
    let winner2Id: number;

    beforeEach(async () => {
      // Setup: Start game, reveal two contestants, start wheel phase
      await app.inject({
        method: "POST",
        url: "/api/game/start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      const contestants = db
        .prepare(
          "SELECT id, player_id FROM contestants_row WHERE game_segment = 'section_1' LIMIT 2",
        )
        .all() as { id: number; player_id: number }[];

      winner1Id = contestants[0].player_id;
      winner2Id = contestants[1].player_id;

      // Reveal both contestants to make them active
      await app.inject({
        method: "POST",
        url: "/api/game/reveal-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: contestants[0].id,
        },
      });

      await app.inject({
        method: "POST",
        url: "/api/game/reveal-contestant",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          contestantRowId: contestants[1].id,
        },
      });

      await app.inject({
        method: "POST",
        url: "/api/game/wheel-start",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          gameSegment: "section_1",
        },
      });

      // Create a tie scenario - both spin 0.50
      db.prepare(
        "INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number) VALUES (?, ?, ?, ?, ?)",
      ).run(winner1Id, "section_1", 1, 0.50, 0);

      db.prepare(
        "INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number) VALUES (?, ?, ?, ?, ?)",
      ).run(winner2Id, "section_1", 1, 0.50, 0);
    });

    it("should start spinoff successfully", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-start-spinoff",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          gameSegment: "section_1",
          spinoffNumber: 1,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.workflow).toBeDefined();
      expect(body.workflow.phase_type).toBe("wheel");
      expect(body.state).toBeDefined();

      // Verify metadata contains spinoff info
      const metadata = JSON.parse(body.workflow.phase_metadata);
      expect(metadata.spinoffNumber).toBe(1);
      expect(metadata.tiedPlayerIds).toContain(winner1Id);
      expect(metadata.tiedPlayerIds).toContain(winner2Id);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-start-spinoff",
        payload: {
          gameSegment: "section_1",
          spinoffNumber: 1,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should require host role", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-start-spinoff",
        headers: {
          Authorization: `Bearer ${playerToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          gameSegment: "section_1",
          spinoffNumber: 1,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should validate gameSegment is required", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-start-spinoff",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          spinoffNumber: 1,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("gameSegment");
    });

    it("should validate spinoffNumber is required", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-start-spinoff",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          gameSegment: "section_1",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("spinoffNumber");
    });

    it("should fail if phase is not wheel", async () => {
      // Override phase back to bidding
      db.prepare(
        "UPDATE game_workflow SET phase_type = 'bidding', phase_metadata = NULL",
      ).run();

      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-start-spinoff",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          gameSegment: "section_1",
          spinoffNumber: 1,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it("should fail if no tie exists", async () => {
      // Delete one player's spin to remove tie
      db.prepare("DELETE FROM wheel_spins WHERE player_id = ?").run(winner2Id);

      const response = await app.inject({
        method: "POST",
        url: "/api/game/wheel-start-spinoff",
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "Content-Type": "application/json",
        },
        payload: {
          gameSegment: "section_1",
          spinoffNumber: 1,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain("no tie");
    });
  });
});
