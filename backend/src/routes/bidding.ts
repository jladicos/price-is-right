import { FastifyPluginAsync } from "fastify";
import { authenticateRequest } from "../middleware/auth.js";
import { requireHost } from "../middleware/requireHost.js";
import {
  submitBid as serviceSubmitBid,
  getCurrentBids,
  calculateWinner,
  unlockBid as serviceUnlockBid,
  clearBidsForRetry,
  getCurrentProductPrice,
  updateBidAmount,
} from "../services/bidding.js";
import { updateGameWorkflow, getGameWorkflow } from "../db/game-workflow.js";
import { updateContestantStatus } from "../db/contestants.js";

const biddingRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/game/submit-bid
   * Submit or update a bid
   * - Players can submit for themselves
   * - Host can submit for any player
   */
  fastify.post<{
    Body: {
      bid_amount: number;
      player_id?: number;
    };
  }>(
    "/game/submit-bid",
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
        if (
          typeof bid_amount !== "number" ||
          !Number.isInteger(bid_amount) ||
          bid_amount <= 0
        ) {
          return reply.status(400).send({
            success: false,
            error: "bid_amount must be a positive integer",
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

        // Get current game state
        const workflow = getGameWorkflow();
        const roundNumber = workflow.current_segment_index + 1;

        // Submit bid
        const result = serviceSubmitBid(
          biddingPlayerId,
          bid_amount,
          workflow.current_segment,
          roundNumber,
        );

        return reply.status(200).send({
          success: true,
          bid: result.bid,
          allBidsSubmitted: result.allBidsSubmitted,
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
   * POST /api/game/show-product
   * Display product modal for everyone
   * Host only
   */
  fastify.post(
    "/game/show-product",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const workflow = getGameWorkflow();
        const metadata = workflow.phase_metadata
          ? JSON.parse(workflow.phase_metadata)
          : {};

        // Set product modal visible
        metadata.product_modal_visible = true;

        // Note: is_fresh_row should be set by game start or refresh-contestants-row
        // Don't set it here - just use whatever value is already in metadata

        updateGameWorkflow({
          phase_metadata: JSON.stringify(metadata),
        });

        return reply.status(200).send({
          success: true,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to show product",
        });
      }
    },
  );

  /**
   * POST /api/game/hide-product-modal
   * Close product modal and show inset card
   * Host only
   */
  fastify.post(
    "/game/hide-product-modal",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const workflow = getGameWorkflow();
        const metadata = workflow.phase_metadata
          ? JSON.parse(workflow.phase_metadata)
          : {};

        // Hide modal, show inset card
        metadata.product_modal_visible = false;
        metadata.product_inset_visible = true;

        updateGameWorkflow({
          phase_metadata: JSON.stringify(metadata),
        });

        return reply.status(200).send({
          success: true,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to hide product modal",
        });
      }
    },
  );

  /**
   * POST /api/game/reveal-winner
   * Calculate and reveal winner (or trigger "all over" retry)
   * Host only
   */
  fastify.post(
    "/game/reveal-winner",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const workflow = getGameWorkflow();
        const roundNumber = workflow.current_segment_index + 1;
        const segment = workflow.current_segment;

        // Get product price
        const productPrice = getCurrentProductPrice();

        // Calculate winner
        const result = calculateWinner(segment, roundNumber, productPrice);

        if ("allOver" in result) {
          // All over scenario - clear bids for retry
          clearBidsForRetry(segment, roundNumber);

          const metadata = workflow.phase_metadata
            ? JSON.parse(workflow.phase_metadata)
            : {};

          metadata.all_over_triggered = true;
          metadata.retry_number = result.newRetryNumber;

          updateGameWorkflow({
            phase_metadata: JSON.stringify(metadata),
          });

          return reply.status(200).send({
            success: true,
            allOver: true,
            newRetryNumber: result.newRetryNumber,
          });
        } else {
          // Winner found
          const { winner, allBids } = result;

          // Mark winner in database
          const winnerBid = allBids.find((b) => b.id === winner.id);
          if (winnerBid) {
            // Use the imported function from bidding service
            const { markWinner } = await import("../services/bidding.js");
            markWinner(winnerBid.id);
          }

          // Update contestant status to 'won'
          // Filter by BOTH player_id AND game_segment to avoid marking wrong contestant
          const contestants = await import("../db/contestants.js");
          const activeContestants = contestants.getAllActiveContestants();
          const winnerContestant = activeContestants.find(
            (c) =>
              c.player_id === winner.player_id && c.game_segment === segment,
          );

          if (winnerContestant) {
            updateContestantStatus(winnerContestant.id, "won");
          }

          // Update phase metadata with winner info and show price
          const metadata = workflow.phase_metadata
            ? JSON.parse(workflow.phase_metadata)
            : {};

          metadata.winner_info = {
            player_id: winner.player_id,
            bid_id: winner.id,
            bid_amount: winner.bid_amount,
            position: winner.position,
          };
          metadata.product_price = productPrice; // Include actual price for display
          metadata.product_price_visible = true; // Show price in inset card
          metadata.product_inset_visible = true; // Keep product inset visible to show price
          metadata.all_over_triggered = false;

          updateGameWorkflow({
            phase_metadata: JSON.stringify(metadata),
          });

          return reply.status(200).send({
            success: true,
            winner: {
              player_id: winner.player_id,
              first_name: winner.first_name,
              last_name: winner.last_name,
              bid_amount: winner.bid_amount,
              position: winner.position,
            },
            productPrice,
          });
        }
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to reveal winner",
        });
      }
    },
  );

  /**
   * POST /api/game/unlock-bid
   * Unlock a bid to allow re-entry
   * Host only
   */
  fastify.post<{
    Body: {
      bid_id: number;
    };
  }>(
    "/game/unlock-bid",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const { bid_id } = request.body;

        if (typeof bid_id !== "number") {
          return reply.status(400).send({
            success: false,
            error: "bid_id must be a number",
          });
        }

        const bid = serviceUnlockBid(bid_id);

        return reply.status(200).send({
          success: true,
          bid,
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
   * POST /api/game/update-bid
   * Update a bid amount (host editing)
   * Host only
   */
  fastify.post<{
    Body: {
      bid_id: number;
      bid_amount: number;
    };
  }>(
    "/game/update-bid",
    {
      preHandler: [authenticateRequest, requireHost],
    },
    async (request, reply) => {
      try {
        const { bid_id, bid_amount } = request.body;

        if (typeof bid_id !== "number") {
          return reply.status(400).send({
            success: false,
            error: "bid_id must be a number",
          });
        }

        if (
          typeof bid_amount !== "number" ||
          !Number.isInteger(bid_amount) ||
          bid_amount <= 0
        ) {
          return reply.status(400).send({
            success: false,
            error: "bid_amount must be a positive integer",
          });
        }

        const bid = updateBidAmount(bid_id, bid_amount);

        return reply.status(200).send({
          success: true,
          bid,
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
   * GET /api/game/current-bids
   * Get all bids for current round
   * Available to all authenticated users
   */
  fastify.get(
    "/game/current-bids",
    {
      preHandler: [authenticateRequest],
    },
    async (request, reply) => {
      try {
        const workflow = getGameWorkflow();
        const roundNumber = workflow.current_segment_index + 1;

        const bids = getCurrentBids(workflow.current_segment, roundNumber);

        return reply.status(200).send({
          success: true,
          bids,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to get current bids",
        });
      }
    },
  );
};

export default biddingRoutes;
