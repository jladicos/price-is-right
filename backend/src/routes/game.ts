import { FastifyPluginAsync } from 'fastify';
import { getDatabase } from '../db/connection.js';
import { authenticateRequest } from '../middleware/auth.js';
import { requireHost } from '../middleware/requireHost.js';
import { getGameEnabled, setGameEnabled } from '../db/game-state.js';

const gameRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/game/status - Get game status (authenticated users only)
  fastify.get('/game/status', { preHandler: [authenticateRequest] }, async (_request, _reply) => {
    const db = getDatabase();
    const enabled = getGameEnabled(db);

    return { enabled };
  });

  // PUT /api/game/status - Update game status (host only)
  fastify.put<{
    Body: {
      enabled: boolean;
    };
  }>('/game/status', { preHandler: [authenticateRequest, requireHost] }, async (request, reply) => {
    const db = getDatabase();
    const { enabled } = request.body;

    if (typeof enabled !== 'boolean') {
      return reply.status(400).send({ error: 'enabled must be a boolean' });
    }

    setGameEnabled(db, enabled);

    return {
      enabled,
      message: enabled ? 'Game enabled' : 'Game disabled',
    };
  });
};

export default gameRoutes;
