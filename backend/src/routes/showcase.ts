import { FastifyPluginAsync } from "fastify";
import { authenticateRequest } from "../middleware/auth.js";
import { requireHost } from "../middleware/requireHost.js";
import {
  initializeShowcase,
  handlePass,
  handleBidDecision,
  submitBid,
  unlockBid,
  updateBid,
  revealWinner,
  initiateRetry,
  getShowcaseStateWithProducts,
  determineFinalists,
  calculateWinner,
} from "../services/showcase.js";
import { getShowcaseBids } from "../db/showcase.js";
import { getGameWorkflow } from "../db/game-workflow.js";

const showcaseRoutes: FastifyPluginAsync = async (fastify) => {
  const GAME_ID = 1; // Default game ID

  /**
   * POST /api/showcase/initialize
   * Initialize showcase showdown with finalists
   * Host only
   */
  fastify.post(
    "/showcase/initialize",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const state = await initializeShowcase(GAME_ID);

        return reply.status(200).send({
          success: true,
          state,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(400).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to initialize showcase",
        });
      }
    },
  );

  /**
   * POST /api/showcase/pass
   * First player passes on showcase 1
   * Host only
   */
  fastify.post(
    "/showcase/pass",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        handlePass(GAME_ID);

        return reply.status(200).send({
          success: true,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : "Failed to pass",
        });
      }
    },
  );

  /**
   * POST /api/showcase/bid-decision
   * First player chooses to bid (not pass)
   * Host only
   */
  fastify.post(
    "/showcase/bid-decision",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        handleBidDecision(GAME_ID);

        return reply.status(200).send({
          success: true,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(400).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to record bid decision",
        });
      }
    },
  );

  /**
   * POST /api/showcase/submit-bid
   * Submit a showcase bid
   * - Players can submit for themselves
   * - Host can submit for any player
   */
  fastify.post<{
    Body: {
      bid_amount: number;
      player_id?: number;
    };
  }>(
    "/showcase/submit-bid",
    {
      preHandler: [authenticateRequest],
    },
    async (request, reply) => {
      try {
        const { bid_amount, player_id } = request.body;
        const currentPlayer = request.player;

        if (!currentPlayer) {
          return reply.status(401).send({
            success: false,
            error: "Not authenticated",
          });
        }

        // Validate bid_amount
        if (typeof bid_amount !== "number" || bid_amount <= 0) {
          return reply.status(400).send({
            success: false,
            error: "bid_amount must be a positive number",
          });
        }

        // Determine which player is bidding
        let biddingPlayerId: number;

        if (currentPlayer.role === "host") {
          // Host can submit for any player (player_id required)
          if (!player_id) {
            return reply.status(400).send({
              success: false,
              error: "player_id required when host submits bid",
            });
          }
          biddingPlayerId = player_id;
        } else {
          // Player can only submit for themselves
          if (player_id && player_id !== currentPlayer.id) {
            return reply.status(403).send({
              success: false,
              error: "Cannot submit bid for another player",
            });
          }
          biddingPlayerId = currentPlayer.id;
        }

        // Submit bid
        submitBid(GAME_ID, biddingPlayerId, bid_amount);

        return reply.status(200).send({
          success: true,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(400).send({
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to submit bid",
        });
      }
    },
  );

  /**
   * POST /api/showcase/unlock-bid
   * Unlock a bid to allow re-entry
   * Host only
   */
  fastify.post<{
    Body: {
      player_id: number;
    };
  }>(
    "/showcase/unlock-bid",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const { player_id } = request.body;

        if (typeof player_id !== "number") {
          return reply.status(400).send({
            success: false,
            error: "player_id must be a number",
          });
        }

        unlockBid(GAME_ID, player_id);

        return reply.status(200).send({
          success: true,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(400).send({
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to unlock bid",
        });
      }
    },
  );

  /**
   * POST /api/showcase/update-bid
   * Update bid amount (host override)
   * Host only
   */
  fastify.post<{
    Body: {
      player_id: number;
      bid_amount: number;
    };
  }>(
    "/showcase/update-bid",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const { player_id, bid_amount } = request.body;

        if (typeof player_id !== "number") {
          return reply.status(400).send({
            success: false,
            error: "player_id must be a number",
          });
        }

        if (typeof bid_amount !== "number" || bid_amount <= 0) {
          return reply.status(400).send({
            success: false,
            error: "bid_amount must be a positive number",
          });
        }

        updateBid(GAME_ID, player_id, bid_amount);

        return reply.status(200).send({
          success: true,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(400).send({
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to update bid",
        });
      }
    },
  );

  /**
   * POST /api/showcase/reveal-winner
   * Calculate and reveal winner
   * Host only
   */
  fastify.post(
    "/showcase/reveal-winner",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const result = revealWinner(GAME_ID);

        return reply.status(200).send({
          success: true,
          winnerId: result.winnerId,
          bonusWon: result.bonusWon,
          retryNeeded: result.retryNeeded,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(400).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to reveal winner",
        });
      }
    },
  );

  /**
   * POST /api/showcase/retry
   * Initiate retry when both players go over
   * Host only
   */
  fastify.post(
    "/showcase/retry",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const newRetryNumber = initiateRetry(GAME_ID);

        return reply.status(200).send({
          success: true,
          retryNumber: newRetryNumber,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(400).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to initiate retry",
        });
      }
    },
  );

  /**
   * GET /api/showcase/state
   * Get current showcase state with products
   * Authenticated users only
   */
  fastify.get(
    "/showcase/state",
    {
      preHandler: [authenticateRequest],
    },
    async (request, reply) => {
      try {
        const result = getShowcaseStateWithProducts(GAME_ID);

        return reply.status(200).send({
          success: true,
          ...result,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(400).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to get showcase state",
        });
      }
    },
  );

  /**
   * GET /api/showcase/bids
   * Get all bids for current retry
   * Authenticated users only
   */
  fastify.get(
    "/showcase/bids",
    {
      preHandler: [authenticateRequest],
    },
    async (request, reply) => {
      try {
        const workflow = getGameWorkflow();
        const retryNumber = workflow.finale_retry_number ?? 0;
        const bids = getShowcaseBids(GAME_ID, retryNumber);

        return reply.status(200).send({
          success: true,
          bids,
          retryNumber,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : "Failed to get bids",
        });
      }
    },
  );

  /**
   * GET /api/showcase/winner
   * Get winner calculation (preview, doesn't store)
   * Host only
   */
  fastify.get(
    "/showcase/winner",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const result = calculateWinner(GAME_ID);

        return reply.status(200).send({
          success: true,
          winnerId: result.winnerId,
          bonusWon: result.bonusWon,
          player1Over: result.player1Over,
          player2Over: result.player2Over,
          player1Diff: result.player1Diff,
          player2Diff: result.player2Diff,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(400).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to calculate winner",
        });
      }
    },
  );

  /**
   * GET /api/showcase/finalists
   * Get determined finalists (preview)
   * Host only
   */
  fastify.get(
    "/showcase/finalists",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const finalists = await determineFinalists(GAME_ID);

        return reply.status(200).send({
          success: true,
          finalists,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(400).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to determine finalists",
        });
      }
    },
  );
};

export default showcaseRoutes;
