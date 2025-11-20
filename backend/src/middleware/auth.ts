import type { FastifyRequest, FastifyReply } from "fastify";
import { validateSession } from "../services/auth.js";
import { getDatabase } from "../db/connection.js";
import type { Player } from "../types/player.js";

// Extend Fastify request to include player
declare module "fastify" {
  interface FastifyRequest {
    player?: Player;
  }
}

/**
 * Middleware to authenticate requests using session tokens
 * Expects Authorization header in format: "Bearer <token>"
 */
export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Missing authorization header",
    });
  }

  // Extract token from "Bearer <token>" format
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Invalid authorization header format",
    });
  }

  const sessionToken = parts[1];

  // Validate session
  const db = getDatabase();
  const player = validateSession(db, sessionToken);

  if (!player) {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Invalid or expired session",
    });
  }

  // Attach player to request
  request.player = player;
}
