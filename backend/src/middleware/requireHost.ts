import { FastifyRequest, FastifyReply } from 'fastify';
import type { Player } from '../types/player.js';

/**
 * Extended request type with player property (set by auth middleware)
 */
interface RequestWithPlayer extends FastifyRequest {
  player?: Player;
}

/**
 * Middleware to require host role for protected routes.
 * Must be used AFTER auth middleware (which sets req.player).
 * Returns 403 Forbidden if user is not a host.
 */
export async function requireHost(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Auth middleware should have already set req.player
  const player = (request as RequestWithPlayer).player;

  if (!player) {
    // This shouldn't happen if auth middleware ran first, but handle it
    reply.code(401).send({ error: 'Authentication required' });
    return;
  }

  if (player.role !== 'host') {
    reply.code(403).send({ error: 'Host access required' });
    return;
  }

  // User is a host, continue to route handler
}
