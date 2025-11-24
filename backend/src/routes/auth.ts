import type { FastifyInstance } from "fastify";
import { login, logout, AuthError } from "../services/auth.js";
import { getDatabase } from "../db/connection.js";
import { authenticateRequest } from "../middleware/auth.js";
import type { Player } from "../types/player.js";

// Request/response type definitions
interface LoginRequest {
  accessCode: string;
}

interface LoginResponse {
  sessionToken: string;
  player: Player;
}

interface SessionResponse {
  player: Player;
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/auth/login
   * Authenticate with access code and receive session token
   */
  fastify.post<{
    Body: LoginRequest;
    Reply: LoginResponse | { error: string; message: string };
  }>("/api/auth/login", async (request, reply) => {
    const { accessCode } = request.body;

    if (!accessCode || accessCode.trim() === "") {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Access code is required",
      });
    }

    try {
      const db = getDatabase();
      const result = login(db, accessCode);

      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.status(error.statusCode).send({
          error: "Authentication Failed",
          message: error.message,
        });
      }

      request.log.error(error);
      return reply.status(500).send({
        error: "Internal Server Error",
        message: "An unexpected error occurred",
      });
    }
  });

  /**
   * POST /api/auth/logout
   * Clear session token (requires authentication)
   */
  fastify.post(
    "/api/auth/logout",
    {
      preHandler: authenticateRequest,
    },
    async (request, reply) => {
      const authHeader = request.headers.authorization;
      const sessionToken = authHeader!.split(" ")[1]; // Safe because auth middleware validates this

      try {
        const db = getDatabase();
        logout(db, sessionToken);

        return reply.status(200).send({
          message: "Logged out successfully",
        });
      } catch (error) {
        if (error instanceof AuthError) {
          return reply.status(error.statusCode).send({
            error: "Logout Failed",
            message: error.message,
          });
        }

        request.log.error(error);
        return reply.status(500).send({
          error: "Internal Server Error",
          message: "An unexpected error occurred",
        });
      }
    },
  );

  /**
   * GET /api/auth/session
   * Validate session and get current player info (requires authentication)
   */
  fastify.get<{ Reply: SessionResponse | { error: string; message: string } }>(
    "/api/auth/session",
    {
      preHandler: authenticateRequest,
    },
    async (request, reply) => {
      // Player is attached by auth middleware
      return reply.status(200).send({
        player: request.player!,
      });
    },
  );
}
