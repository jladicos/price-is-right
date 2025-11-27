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
  startWheelPhase,
  processWheelSpin,
  completePlayerWheelTurn,
  startWheelSpinOff,
} from "../services/game-state.js";
import { updateGameWorkflow, getGameWorkflow } from "../db/game-workflow.js";
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

        // Mark as fresh row since we just selected 5 initial contestants
        const firstPhaseWithMetadata = { ...firstPhase, is_fresh_row: true };

        // Update workflow to first phase
        updateGameWorkflow({
          current_segment: "section_1",
          current_segment_index: 0,
          phase_type: firstPhase.type,
          phase_metadata: JSON.stringify(firstPhaseWithMetadata),
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

        // Mark as fresh row since we just replaced all 5 contestants
        const workflow = getCurrentState().workflow;
        const metadata = workflow.phase_metadata
          ? JSON.parse(workflow.phase_metadata)
          : {};
        metadata.is_fresh_row = true;

        updateGameWorkflow({
          phase_metadata: JSON.stringify(metadata),
        });

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
        // Replace the winner with a new contestant
        let replacementAdded = false;
        if (currentPhaseType === "bidding") {
          // Only auto-select if we're in a valid segment
          // Skip auto-fill ONLY when transitioning from wheel to bidding (handled separately below)
          if (
            currentSegment === "section_1" ||
            currentSegment === "section_2"
          ) {
            // Find the winner (status='won') and replace them
            // Filter by current segment to avoid finding winners from other segments
            const { getAllActiveContestants } = await import(
              "../db/contestants.js"
            );
            const contestants = getAllActiveContestants();
            const winner = contestants.find(
              (c) => c.status === "won" && c.game_segment === currentSegment,
            );

            if (winner) {
              // Replace the winner with a random contestant
              try {
                replaceContestant(winner.id);
                replacementAdded = true;
                request.log.info(
                  `Replaced winner at position ${winner.position} with new contestant`,
                );
              } catch (error) {
                request.log.error("Failed to replace winner:", error);
                // Continue anyway - don't block phase advancement
              }
            } else {
              // No winner found - try to fill empty position (if any)
              try {
                selectNextContestant(
                  currentSegment as "section_1" | "section_2",
                );
                replacementAdded = true;
              } catch (error) {
                // If all positions are filled, skip auto-selection
                if (
                  error instanceof Error &&
                  error.message.includes("All contestant positions are filled")
                ) {
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

        // Preserve is_fresh_row flag from current metadata
        const currentMetadata = workflow.phase_metadata
          ? JSON.parse(workflow.phase_metadata)
          : {};
        const nextMetadata: Record<string, unknown> = { ...nextPhase };

        // Preserve is_fresh_row, but update to false if we just added a replacement
        if (replacementAdded) {
          nextMetadata.is_fresh_row = false;
        } else if (currentMetadata.is_fresh_row !== undefined) {
          nextMetadata.is_fresh_row = currentMetadata.is_fresh_row;
        }

        // Note: skip_auto_fill flag is only used when transitioning FROM wheel TO bidding
        // It's automatically ignored when advancing between bidding rounds

        // Special handling: Transitioning FROM wheel phase TO bidding phase
        if (currentPhaseType === "wheel" && nextPhase.type === "bidding") {
          // Copy contestants from previous bidding segment to new segment
          // (excludes ALL bidding winners - both wheel winner and losers)
          const { copyContestantsToNextSegment } = await import(
            "../db/contestants.js"
          );

          // Map wheel segment back to its bidding segment
          let fromSegment = currentSegment;
          if (currentSegment === "section_1_finale") {
            fromSegment = "section_1";
          } else if (currentSegment === "section_2_finale") {
            fromSegment = "section_2";
          }

          // Copy non-winners to the next segment (excludes anyone who participated in wheel)
          copyContestantsToNextSegment(fromSegment, nextSegment);

          // Set is_fresh_row to false since we're continuing with existing contestants
          // The copied contestants retain their original added_at timestamps,
          // so getBiddingOrder() can correctly determine the most recent
          nextMetadata.is_fresh_row = false;

          // Set skip_auto_fill flag to prevent auto-filling on this first advance
          // This allows the host to manually reveal the first contestant via "come on down"
          // The flag will be cleared on the next advance, allowing normal auto-fill behavior
          nextMetadata.skip_auto_fill = true;

          request.log.info(
            `Copied contestants from ${fromSegment} to ${nextSegment} (excluding bidding winners)`,
          );
        }

        // Special handling for wheel phases
        if (nextPhase.type === "wheel") {
          // First update the segment
          updateGameWorkflow({
            current_segment: nextSegment,
            current_segment_index: nextIndex,
            phase_type: nextPhase.type,
            phase_metadata: JSON.stringify(nextMetadata),
          });
          // Then call startWheelPhase to properly initialize wheel metadata
          startWheelPhase(nextSegment);
        } else {
          // Update workflow to next phase (non-wheel phases)
          updateGameWorkflow({
            current_segment: nextSegment,
            current_segment_index: nextIndex,
            phase_type: nextPhase.type,
            phase_metadata: JSON.stringify(nextMetadata),
          });
        }

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

  /**
   * POST /api/game/wheel-start
   * Start the wheel phase for a game segment
   * Validates eligible players exist, initializes wheel state
   * Host only
   */
  fastify.post<{
    Body: { gameSegment: string };
  }>(
    "/game/wheel-start",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const { gameSegment } = request.body;

        if (!gameSegment || typeof gameSegment !== "string") {
          return reply.status(400).send({
            success: false,
            error: "gameSegment is required and must be a string",
          });
        }

        const workflow = startWheelPhase(gameSegment);
        const state = getCurrentState();

        return reply.status(200).send({
          success: true,
          workflow,
          state,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to start wheel phase",
        });
      }
    },
  );

  /**
   * POST /api/game/wheel-spin
   * Process a wheel spin for a player
   * Records spin, calculates total, checks for elimination
   * Authenticated users (player or host)
   */
  fastify.post<{
    Body: { playerId: number; gameSegment: string };
  }>(
    "/game/wheel-spin",
    {
      preHandler: [authenticateRequest],
    },
    async (request, reply) => {
      try {
        const { playerId, gameSegment } = request.body;

        if (!playerId || typeof playerId !== "number") {
          return reply.status(400).send({
            success: false,
            error: "playerId is required and must be a number",
          });
        }

        if (!gameSegment || typeof gameSegment !== "string") {
          return reply.status(400).send({
            success: false,
            error: "gameSegment is required and must be a string",
          });
        }

        const result = processWheelSpin(playerId, gameSegment);
        const state = getCurrentState();

        return reply.status(200).send({
          success: true,
          spin: result.spin,
          total: result.total,
          eliminated: result.eliminated,
          state,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to process wheel spin",
        });
      }
    },
  );

  /**
   * POST /api/game/wheel-stay
   * Complete a player's wheel turn (they choose to stay)
   * Checks if all players finished, detects ties, determines winner
   * Authenticated users (player or host)
   */
  fastify.post<{
    Body: { playerId: number; gameSegment: string };
  }>(
    "/game/wheel-stay",
    {
      preHandler: [authenticateRequest],
    },
    async (request, reply) => {
      try {
        const { playerId, gameSegment } = request.body;

        if (!playerId || typeof playerId !== "number") {
          return reply.status(400).send({
            success: false,
            error: "playerId is required and must be a number",
          });
        }

        if (!gameSegment || typeof gameSegment !== "string") {
          return reply.status(400).send({
            success: false,
            error: "gameSegment is required and must be a string",
          });
        }

        const result = completePlayerWheelTurn(playerId, gameSegment);
        const state = getCurrentState();

        return reply.status(200).send({
          success: true,
          allPlayersFinished: result.allPlayersFinished,
          needsSpinoff: result.needsSpinoff,
          winnerId: result.winnerId,
          tiedPlayerIds: result.tiedPlayerIds,
          state,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to complete player turn",
        });
      }
    },
  );

  /**
   * POST /api/game/wheel-start-spinoff
   * Start a spinoff round for tied players
   * Validates tie exists, initializes spinoff metadata
   * Host only
   */
  fastify.post<{
    Body: { gameSegment: string; spinoffNumber: number };
  }>(
    "/game/wheel-start-spinoff",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const { gameSegment, spinoffNumber } = request.body;

        if (!gameSegment || typeof gameSegment !== "string") {
          return reply.status(400).send({
            success: false,
            error: "gameSegment is required and must be a string",
          });
        }

        if (spinoffNumber === undefined || typeof spinoffNumber !== "number") {
          return reply.status(400).send({
            success: false,
            error: "spinoffNumber is required and must be a number",
          });
        }

        const workflow = startWheelSpinOff(gameSegment, spinoffNumber);
        const state = getCurrentState();

        return reply.status(200).send({
          success: true,
          workflow,
          state,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to start spinoff",
        });
      }
    },
  );

  /**
   * POST /api/game/wheel-reset
   * DEBUGGING: Reset wheel phase to first player
   * Clears all spins for current segment and resets to first spinner
   * Host only
   */
  fastify.post(
    "/game/wheel-reset",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const workflow = getGameWorkflow();

        // Validate we're in wheel phase
        if (workflow.phase_type !== "wheel") {
          return reply.status(400).send({
            success: false,
            error: "Not in wheel phase",
          });
        }

        const segment = workflow.current_segment;
        if (!segment) {
          return reply.status(400).send({
            success: false,
            error: "No current segment",
          });
        }

        // Use startWheelPhase to reset everything
        const updatedWorkflow = startWheelPhase(segment);
        const state = getCurrentState();

        return reply.status(200).send({
          success: true,
          workflow: updatedWorkflow,
          state,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to reset wheel",
        });
      }
    },
  );
};

export default gameRoutes;
