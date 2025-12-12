import type { FastifyPluginAsync } from "fastify";
import { writeFileSync } from "node:fs";
import { getDatabase } from "../db/connection.js";
import {
  exportDatabase,
  importDatabase,
  type DatabaseExport,
} from "../db/export-import.js";
import { authenticateRequest } from "../middleware/auth.js";
import { requireHost } from "../middleware/requireHost.js";
import { getGameWinners, formatWinnersAsMarkdown } from "../services/winners.js";

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Export database
  fastify.get(
    "/admin/export",
    { preHandler: [authenticateRequest, requireHost] },
    async (_request, reply) => {
      const db = getDatabase();
      const exportData = exportDatabase(db);

      // Set headers for file download
      const filename = `price-is-right-backup-${new Date().toISOString().split("T")[0]}.json`;
      reply.header("Content-Type", "application/json");
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);

      return exportData;
    },
  );

  // Import database
  fastify.post(
    "/admin/import",
    { preHandler: [authenticateRequest, requireHost] },
    async (request, reply) => {
      const db = getDatabase();

      // Validate request body
      const data = request.body as DatabaseExport;

      if (!data || typeof data !== "object") {
        return reply.status(400).send({
          error: "Invalid request body",
        });
      }

      try {
        // Save current session tokens by access_code before import
        // This allows users to stay logged in after import
        const currentSessions = db
          .prepare(
            `SELECT access_code, session_token
             FROM players
             WHERE session_token IS NOT NULL`,
          )
          .all() as Array<{ access_code: string; session_token: string }>;

        // Create a map for quick lookup
        const sessionMap = new Map<string, string>();
        for (const session of currentSessions) {
          sessionMap.set(session.access_code, session.session_token);
        }

        // Import the database (this clears all session tokens)
        importDatabase(db, data);

        // Restore session tokens for players that still exist
        const restoreStmt = db.prepare(
          "UPDATE players SET session_token = ? WHERE access_code = ?",
        );
        let sessionsRestored = 0;

        for (const [accessCode, sessionToken] of sessionMap.entries()) {
          const result = restoreStmt.run(sessionToken, accessCode);
          if (result.changes > 0) {
            sessionsRestored++;
          }
        }

        return {
          success: true,
          message: "Database imported successfully",
          playersImported: data.players.length,
          gameStateImported: data.gameState.length,
          gameWorkflowImported: data.gameWorkflow.length,
          contestantsImported: data.contestantsRow.length,
          bidsImported: data.bids.length,
          wheelSpinsImported: data.wheelSpins.length,
          showcaseBidsImported: data.showcaseBids.length,
          sessionsRestored,
        };
      } catch (err) {
        const error = err as Error;
        return reply.status(400).send({
          error: error.message,
        });
      }
    },
  );

  // Export winners to markdown file
  fastify.get(
    "/admin/export-winners",
    { preHandler: [authenticateRequest, requireHost] },
    async (_request, reply) => {
      try {
        // Get all winners
        const winners = getGameWinners();

        // Format as markdown
        const markdown = formatWinnersAsMarkdown(winners);

        // Write to data directory (mounted volume accessible from host)
        const filePath = "/app/data/winners.md";

        writeFileSync(filePath, markdown, "utf-8");

        return {
          success: true,
          message: "Winners exported successfully",
          filePath: "data/winners.md",
          winners, // Include winners data for console logging
        };
      } catch (err) {
        const error = err as Error;
        return reply.status(500).send({
          error: `Failed to export winners: ${error.message}`,
        });
      }
    },
  );

  // Get UI test data for a specific phase
  fastify.get<{
    Querystring: { phase: "bidding" | "wheel" | "showcase" };
  }>(
    "/admin/ui-test-data",
    { preHandler: [authenticateRequest, requireHost] },
    async (request, reply) => {
      const db = getDatabase();
      const { phase } = request.query;

      if (!phase || !["bidding", "wheel", "showcase"].includes(phase)) {
        return reply.status(400).send({
          error: "phase must be one of: bidding, wheel, showcase",
        });
      }

      // Get 5 random active players to use as test contestants
      const players = db
        .prepare(
          `SELECT id, first_name, last_name, photo_filename, role
           FROM players
           WHERE active = 1
           ORDER BY RANDOM()
           LIMIT 5`,
        )
        .all() as Array<{
        id: number;
        first_name: string;
        last_name: string;
        photo_filename: string;
        role: string;
      }>;

      if (players.length < 2) {
        return reply.status(400).send({
          error: "Need at least 2 active players in the database for test data",
        });
      }

      // Build mock contestants
      const mockContestants = players.map((player, index) => ({
        id: index + 1,
        player_id: player.id,
        position: index + 1,
        game_segment: "section_1",
        status: "active",
        added_at: new Date().toISOString(),
        revealed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        first_name: player.first_name,
        last_name: player.last_name,
        photo_filename: player.photo_filename,
        role: player.role,
      }));

      // Load products from config
      const { getGameStructure } = await import("../utils/products.js");
      const gameStructure = getGameStructure();

      // Build phase-specific test state
      let testState;

      if (phase === "bidding") {
        const biddingPhase = gameStructure.section_1[0];
        const productId =
          "product_id" in biddingPhase ? biddingPhase.product_id : "p1";

        // Get product data
        const { getProduct } = await import("../utils/products.js");
        const product = getProduct(productId);

        // Mock bids for each contestant
        const mockBids = mockContestants.map((contestant, index) => ({
          id: index + 1,
          player_id: contestant.player_id,
          product_id: productId,
          round_number: 1,
          game_segment: "section_1",
          bid_amount: (index + 1) * 100 + Math.floor(Math.random() * 50),
          is_locked: 1,
          is_winner: 0,
          retry_number: 0,
          created_at: new Date().toISOString(),
          first_name: contestant.first_name,
          last_name: contestant.last_name,
          photo_filename: contestant.photo_filename,
          position: contestant.position,
        }));

        testState = {
          workflow: {
            id: 1,
            current_segment: "section_1",
            current_segment_index: 0,
            phase_type: "bidding",
            phase_metadata: JSON.stringify({
              type: "bidding",
              product_id: productId,
              product_modal_visible: false,
              product_inset_visible: true,
              product_price_visible: false,
              product_price: product?.price || 500,
            }),
            officially_started: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          contestantsRow: mockContestants,
          currentBids: mockBids,
          currentBidderPosition: 3,
          product: product,
        };
      } else if (phase === "wheel") {
        // Use first 3 contestants for wheel
        const wheelContestants = mockContestants.slice(0, 3);

        // Mock wheel totals
        const playerTotals = wheelContestants.map((contestant, index) => ({
          player_id: contestant.player_id,
          first_name: contestant.first_name,
          last_name: contestant.last_name,
          photo_filename: contestant.photo_filename,
          position: contestant.position,
          total: 0.5 + index * 0.15,
          eliminated: index === 2, // Third player eliminated
        }));

        testState = {
          workflow: {
            id: 1,
            current_segment: "section_1_finale",
            current_segment_index: 0,
            phase_type: "wheel",
            phase_metadata: JSON.stringify({
              type: "wheel",
              eligiblePlayers: wheelContestants.map((c) => c.player_id),
              currentSpinner: wheelContestants[1].player_id,
              spinOrder: wheelContestants.map((c) => c.player_id),
              completedTurns: [wheelContestants[0].player_id],
              spinoffNumber: 0,
            }),
            officially_started: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          contestantsRow: wheelContestants,
          wheelSpins: [],
          playerTotals: playerTotals,
        };
      } else if (phase === "showcase") {
        // Use 2 players for showcase
        const showcaseContestants = mockContestants.slice(0, 2);

        // Get showcase products and their details
        // Note: showcase_1 and showcase_2 are arrays of product ID strings directly
        const { getProduct } = await import("../utils/products.js");
        const showcase1ProductIds = gameStructure.finale.showcase_1 as string[];
        const showcase2ProductIds = gameStructure.finale.showcase_2 as string[];

        // Build showcase product arrays with full details
        // Frontend expects: { id: string; product: { name, price, images } }
        const showcase1Products = showcase1ProductIds.map((pid) => {
          const product = getProduct(pid);
          return {
            id: pid,
            product: {
              name: product?.name || pid,
              price: product?.price || 1000,
              images: product?.images || [],
            },
          };
        });

        const showcase2Products = showcase2ProductIds.map((pid) => {
          const product = getProduct(pid);
          return {
            id: pid,
            product: {
              name: product?.name || pid,
              price: product?.price || 1000,
              images: product?.images || [],
            },
          };
        });

        // Calculate showcase values
        const showcase1Value = showcase1Products.reduce(
          (sum, p) => sum + p.product.price,
          0,
        );
        const showcase2Value = showcase2Products.reduce(
          (sum, p) => sum + p.product.price,
          0,
        );

        // Build the showcaseState structure that the frontend expects
        const showcaseState = {
          state: {
            finale_player1_id: showcaseContestants[0].player_id,
            finale_player2_id: showcaseContestants[1].player_id,
            finale_player1_first_name: showcaseContestants[0].first_name,
            finale_player1_last_name: showcaseContestants[0].last_name,
            finale_player1_photo: showcaseContestants[0].photo_filename,
            finale_player2_first_name: showcaseContestants[1].first_name,
            finale_player2_last_name: showcaseContestants[1].last_name,
            finale_player2_photo: showcaseContestants[1].photo_filename,
            finale_player1_showcase: 1,
            finale_player2_showcase: 2,
            finale_player1_passed: 0,
            finale_winner_id: null,
            finale_bonus_won: 0,
            finale_player1_product_value: showcase1Value,
            finale_player2_product_value: showcase2Value,
            finale_retry_number: 0,
          },
          showcase1: showcase1Products,
          showcase2: showcase2Products,
          showcase1Value: showcase1Value,
          showcase2Value: showcase2Value,
          bonusThreshold: 250,
        };

        testState = {
          workflow: {
            id: 1,
            current_segment: "finale",
            current_segment_index: 0,
            phase_type: "showcase",
            phase_metadata: JSON.stringify({
              type: "showcase",
              showcase_1: showcase1ProductIds,
              showcase_2: showcase2ProductIds,
              player1Id: showcaseContestants[0].player_id,
              player2Id: showcaseContestants[1].player_id,
            }),
            officially_started: 1,
            finale_player1_id: showcaseContestants[0].player_id,
            finale_player2_id: showcaseContestants[1].player_id,
            finale_player1_showcase: 1,
            finale_player2_showcase: 2,
            finale_retry_number: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          contestantsRow: showcaseContestants,
          showcaseBids: [],
          showcaseState: showcaseState,
        };
      }

      return {
        phase,
        testState,
        players: players.map((p) => ({
          id: p.id,
          firstName: p.first_name,
          lastName: p.last_name,
          photoFilename: p.photo_filename,
        })),
      };
    },
  );

  // Go back to previous phase
  fastify.post(
    "/admin/previous-phase",
    { preHandler: [authenticateRequest, requireHost] },
    async (_request, reply) => {
      const db = getDatabase();

      try {
        // Get current workflow state
        const workflow = db
          .prepare("SELECT * FROM game_workflow WHERE id = 1")
          .get() as {
          phase_type: string;
          current_segment: string;
          current_segment_index: number;
        };

        if (!workflow) {
          return reply.status(400).send({ error: "No game in progress" });
        }

        const { phase_type, current_segment, current_segment_index } = workflow;

        // Determine previous phase based on current state
        if (phase_type === "showcase") {
          // From showcase -> wheel (section_2_finale)
          db.prepare(
            `UPDATE game_workflow
             SET phase_type = 'wheel',
                 current_segment = 'section_2_finale',
                 phase_metadata = NULL,
                 finale_winner_id = NULL,
                 updated_at = datetime('now')
             WHERE id = 1`
          ).run();
        } else if (phase_type === "wheel") {
          // From wheel -> last bidding round of current section
          // Get the game structure to find the last bidding phase index
          const lastBiddingIndex = current_segment_index > 0 ? current_segment_index - 1 : 0;

          db.prepare(
            `UPDATE game_workflow
             SET phase_type = 'bidding',
                 current_segment_index = ?,
                 phase_metadata = NULL,
                 updated_at = datetime('now')
             WHERE id = 1`
          ).run(lastBiddingIndex);
        } else if (phase_type === "bidding" || phase_type === "audience_bid") {
          if (current_segment_index > 0) {
            // Go to previous round in current segment
            db.prepare(
              `UPDATE game_workflow
               SET current_segment_index = ?,
                   phase_metadata = NULL,
                   updated_at = datetime('now')
               WHERE id = 1`
            ).run(current_segment_index - 1);
          } else if (current_segment === "section_2") {
            // At start of section_2, go back to section_1_finale wheel
            db.prepare(
              `UPDATE game_workflow
               SET phase_type = 'wheel',
                   current_segment = 'section_1_finale',
                   phase_metadata = NULL,
                   updated_at = datetime('now')
               WHERE id = 1`
            ).run();
          }
          // If at section_1 index 0, can't go back further
        }

        // Get updated workflow
        const updatedWorkflow = db
          .prepare("SELECT * FROM game_workflow WHERE id = 1")
          .get();

        // Broadcast state update
        fastify.io?.emit("game_state_changed", { workflow: updatedWorkflow });

        return {
          success: true,
          message: "Moved to previous phase",
          workflow: updatedWorkflow,
        };
      } catch (err) {
        const error = err as Error;
        return reply.status(500).send({
          error: `Failed to go to previous phase: ${error.message}`,
        });
      }
    }
  );
};

export default adminRoutes;
