import { FastifyPluginAsync } from "fastify";
import { getDatabase } from "../db/connection.js";
import { authenticateRequest } from "../middleware/auth.js";
import { requireHost } from "../middleware/requireHost.js";
import { getGameEnabled, setGameEnabled } from "../db/game-state.js";
import {
  startNewGame,
  getCurrentState,
  revealContestant,
  replaceContestant,
  refreshContestantsRow,
  selectNextContestant,
  manualSelectContestant,
} from "../services/game-state.js";
import { updateGameWorkflow } from "../db/game-workflow.js";
import { getGameStructure } from "../utils/products.js";
import type { GamePhase, WheelPhase, ShowcasePhase } from "../types/product.js";

const gameRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/game/status - Get game status (authenticated users only)
  fastify.get(
    "/game/status",
    { preHandler: [authenticateRequest] },
    async (_request, _reply) => {
      const db = getDatabase();
      const enabled = getGameEnabled(db);

      return { enabled };
    },
  );

  // PUT /api/game/status - Update game status (host only)
  fastify.put<{
    Body: {
      enabled: boolean;
    };
  }>(
    "/game/status",
    { preHandler: [authenticateRequest, requireHost] },
    async (request, reply) => {
      const db = getDatabase();
      const { enabled } = request.body;

      if (typeof enabled !== "boolean") {
        return reply.status(400).send({ error: "enabled must be a boolean" });
      }

      setGameEnabled(db, enabled);

      return {
        enabled,
        message: enabled ? "Game enabled" : "Game disabled",
      };
    },
  );

  /**
   * POST /api/game/start
   * Start a new game
   * - Resets game state
   * - Auto-selects 5 random contestants (status='pending_reveal')
   * - Sets phase to first bidding from game_structure
   * Host only
   */
  fastify.post(
    "/game/start",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        // Start new game (resets state to not_started)
        startNewGame();

        // Auto-select 5 random contestants for section_1
        // All start with status='pending_reveal' (must be revealed one-by-one)
        for (let i = 0; i < 5; i++) {
          selectNextContestant("section_1");
        }

        // Get game structure and set phase to first phase in section_1
        const gameStructure = getGameStructure();
        const firstPhase = gameStructure.section_1[0];

        // Update workflow to first phase
        updateGameWorkflow({
          current_segment: "section_1",
          current_segment_index: 0,
          phase_type: firstPhase.type,
          phase_metadata: JSON.stringify(firstPhase),
        });

        const state = getCurrentState();

        return reply.status(200).send({
          success: true,
          state,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to start game",
        });
      }
    },
  );

  /**
   * GET /api/game/state
   * Get current game state
   * Available to all authenticated users
   */
  fastify.get(
    "/game/state",
    {
      preHandler: [authenticateRequest],
    },
    async (request, reply) => {
      try {
        const state = getCurrentState();

        return reply.status(200).send({
          success: true,
          state,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to get game state",
        });
      }
    },
  );

  /**
   * POST /api/game/reveal-contestant
   * Reveal a pending contestant to the audience
   * Updates status='active' and role='player'
   * Host only
   */
  fastify.post<{
    Body: { contestantRowId: number };
  }>(
    "/game/reveal-contestant",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const { contestantRowId } = request.body;

        if (!contestantRowId || typeof contestantRowId !== "number") {
          return reply.status(400).send({
            success: false,
            error: "contestantRowId is required and must be a number",
          });
        }

        const contestant = revealContestant(contestantRowId);

        return reply.status(200).send({
          success: true,
          contestant,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to reveal contestant",
        });
      }
    },
  );

  /**
   * POST /api/game/replace-contestant-random
   * Replace a contestant with random selection from audience
   * New contestant gets status='pending_reveal'
   * Host only
   */
  fastify.post<{
    Body: { contestantRowId: number };
  }>(
    "/game/replace-contestant-random",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const { contestantRowId } = request.body;

        if (!contestantRowId || typeof contestantRowId !== "number") {
          return reply.status(400).send({
            success: false,
            error: "contestantRowId is required and must be a number",
          });
        }

        const contestant = replaceContestant(contestantRowId);

        return reply.status(200).send({
          success: true,
          contestant,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to replace contestant",
        });
      }
    },
  );

  /**
   * POST /api/game/manual-select-contestant
   * Manually select a player for a specific position
   * If position is empty, adds the player
   * If position is occupied, replaces the existing contestant
   * Always creates pending_reveal status for dramatic reveals
   * Host only
   */
  fastify.post<{
    Body: { playerId: number; position: number; segment: string };
  }>(
    "/game/manual-select-contestant",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const { playerId, position, segment } = request.body;

        if (!playerId || typeof playerId !== "number") {
          return reply.status(400).send({
            success: false,
            error: "playerId is required and must be a number",
          });
        }

        if (!position || typeof position !== "number") {
          return reply.status(400).send({
            success: false,
            error: "position is required and must be a number",
          });
        }

        if (!segment || typeof segment !== "string") {
          return reply.status(400).send({
            success: false,
            error: "segment is required and must be a string",
          });
        }

        const contestant = manualSelectContestant(playerId, segment, position);

        return reply.status(200).send({
          success: true,
          contestant,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to manually select contestant",
        });
      }
    },
  );

  /**
   * POST /api/game/replace-contestant-manual
   * Replace a contestant with specific player selection
   * Handles both occupied and empty positions
   * Status based on role: audience=pending_reveal, player/host=active
   * Host only
   */
  fastify.post<{
    Body: { contestantRowId: number; newPlayerId: number };
  }>(
    "/game/replace-contestant-manual",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const { contestantRowId, newPlayerId } = request.body;

        if (!contestantRowId || typeof contestantRowId !== "number") {
          return reply.status(400).send({
            success: false,
            error: "contestantRowId is required and must be a number",
          });
        }

        if (!newPlayerId || typeof newPlayerId !== "number") {
          return reply.status(400).send({
            success: false,
            error: "newPlayerId is required and must be a number",
          });
        }

        const contestant = replaceContestant(contestantRowId, newPlayerId);

        return reply.status(200).send({
          success: true,
          contestant,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to replace contestant",
        });
      }
    },
  );

  /**
   * POST /api/game/refresh-contestants-row
   * Replace all 5 contestants with new random selections
   * All new contestants get status='pending_reveal'
   * Host only
   */
  fastify.post<{
    Body: { segment: "section_1" | "section_2" };
  }>(
    "/game/refresh-contestants-row",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const { segment } = request.body;

        if (!segment || (segment !== "section_1" && segment !== "section_2")) {
          return reply.status(400).send({
            success: false,
            error:
              "segment is required and must be either section_1 or section_2",
          });
        }

        const contestants = refreshContestantsRow(segment);

        return reply.status(200).send({
          success: true,
          contestants,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to refresh contestants row",
        });
      }
    },
  );

  /**
   * POST /api/game/advance
   * Advance to next phase (config-driven from game_structure)
   * Automatically handles:
   * - Phase progression within segments
   * - Segment transitions (section_1 → wheel → section_2 → wheel → showcase)
   * - Auto-selection of replacement contestant after bidding
   * Host only
   */
  fastify.post(
    "/game/advance",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const workflow = getCurrentState().workflow;
        const gameStructure = getGameStructure();
        const currentPhaseType = workflow.phase_type;
        const currentSegment = workflow.current_segment;
        const currentIndex = workflow.current_segment_index;

        // Auto-select replacement contestant if advancing FROM a bidding phase
        // Only if there's an empty position (winner has left)
        if (currentPhaseType === "bidding") {
          // Only auto-select if we're in a valid segment (not finale)
          if (
            currentSegment === "section_1" ||
            currentSegment === "section_2"
          ) {
            try {
              selectNextContestant(currentSegment as "section_1" | "section_2");
            } catch (error) {
              // If all positions are filled, skip auto-selection
              // This can happen if testing or if winner hasn't been marked yet
              if (
                error instanceof Error &&
                error.message.includes("All contestant positions are filled")
              ) {
                // Silently skip - this is expected when positions are full
                request.log.debug(
                  "Skipping auto-selection: all positions filled",
                );
              } else {
                // Re-throw other errors
                throw error;
              }
            }
          }
        }

        // Determine next phase based on current position
        let nextSegment: string;
        let nextIndex: number;
        let nextPhase: GamePhase | WheelPhase | ShowcasePhase;

        if (currentSegment === "section_1") {
          const section1Phases = gameStructure.section_1;
          if (currentIndex < section1Phases.length - 1) {
            // More phases in section_1
            nextSegment = "section_1";
            nextIndex = currentIndex + 1;
            nextPhase = section1Phases[nextIndex];
          } else {
            // End of section_1, go to section_1_finale (wheel)
            nextSegment = "section_1_finale";
            nextIndex = 0;
            nextPhase = gameStructure.section_1_finale;
          }
        } else if (currentSegment === "section_1_finale") {
          // After section_1_finale, go to section_2[0]
          nextSegment = "section_2";
          nextIndex = 0;
          nextPhase = gameStructure.section_2[0];
        } else if (currentSegment === "section_2") {
          const section2Phases = gameStructure.section_2;
          if (currentIndex < section2Phases.length - 1) {
            // More phases in section_2
            nextSegment = "section_2";
            nextIndex = currentIndex + 1;
            nextPhase = section2Phases[nextIndex];
          } else {
            // End of section_2, go to section_2_finale (wheel)
            nextSegment = "section_2_finale";
            nextIndex = 0;
            nextPhase = gameStructure.section_2_finale;
          }
        } else if (currentSegment === "section_2_finale") {
          // After section_2_finale, go to finale (showcase)
          nextSegment = "finale";
          nextIndex = 0;
          nextPhase = gameStructure.finale;
        } else if (currentSegment === "finale") {
          // Already at finale, cannot advance further
          return reply.status(400).send({
            success: false,
            error: "Cannot advance beyond finale",
          });
        } else {
          // Invalid segment
          return reply.status(400).send({
            success: false,
            error: `Invalid current segment: ${currentSegment}`,
          });
        }

        // Update workflow to next phase
        updateGameWorkflow({
          current_segment: nextSegment,
          current_segment_index: nextIndex,
          phase_type: nextPhase.type,
          phase_metadata: JSON.stringify(nextPhase),
        });

        const state = getCurrentState();

        return reply.status(200).send({
          success: true,
          state,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to advance phase",
        });
      }
    },
  );

  /**
   * POST /api/game/override-phase
   * Emergency override to jump to specific phase
   * Logs warning for audit trail
   * Host only
   */
  fastify.post<{
    Body: {
      segment: string;
      segmentIndex: number;
      phaseType: string;
      phaseMetadata?: GamePhase | WheelPhase | ShowcasePhase;
    };
  }>(
    "/game/override-phase",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const { segment, segmentIndex, phaseType, phaseMetadata } =
          request.body;

        if (!segment || typeof segment !== "string") {
          return reply.status(400).send({
            success: false,
            error: "segment is required and must be a string",
          });
        }

        if (segmentIndex === undefined || typeof segmentIndex !== "number") {
          return reply.status(400).send({
            success: false,
            error: "segmentIndex is required and must be a number",
          });
        }

        if (!phaseType || typeof phaseType !== "string") {
          return reply.status(400).send({
            success: false,
            error: "phaseType is required and must be a string",
          });
        }

        // Log warning for audit trail
        request.log.warn(
          { segment, segmentIndex, phaseType, phaseMetadata },
          "Phase override requested - bypassing normal advancement",
        );

        // Update workflow
        updateGameWorkflow({
          current_segment: segment,
          current_segment_index: segmentIndex,
          phase_type: phaseType,
          phase_metadata: phaseMetadata ? JSON.stringify(phaseMetadata) : null,
        });

        const state = getCurrentState();

        return reply.status(200).send({
          success: true,
          state,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to override phase",
        });
      }
    },
  );
};

export default gameRoutes;
