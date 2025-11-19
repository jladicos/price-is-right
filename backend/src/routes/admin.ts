import type { FastifyPluginAsync } from 'fastify';
import { getDatabase } from '../db/connection.js';
import { exportDatabase, importDatabase, type DatabaseExport } from '../db/export-import.js';
import { authenticateRequest } from '../middleware/auth.js';
import { requireHost } from '../middleware/requireHost.js';

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Export database
  fastify.get(
    '/admin/export',
    { preHandler: [authenticateRequest, requireHost] },
    async (_request, reply) => {
      const db = getDatabase();
      const exportData = exportDatabase(db);

      // Set headers for file download
      const filename = `price-is-right-backup-${new Date().toISOString().split('T')[0]}.json`;
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);

      return exportData;
    },
  );

  // Import database
  fastify.post(
    '/admin/import',
    { preHandler: [authenticateRequest, requireHost] },
    async (request, reply) => {
      const db = getDatabase();

      // Validate request body
      const data = request.body as DatabaseExport;

      if (!data || typeof data !== 'object') {
        return reply.status(400).send({
          error: 'Invalid request body',
        });
      }

      try {
        importDatabase(db, data);
        return {
          success: true,
          message: 'Database imported successfully',
          playersImported: data.players.length,
          gameStateImported: data.gameState.length,
        };
      } catch (err) {
        const error = err as Error;
        return reply.status(400).send({
          error: error.message,
        });
      }
    },
  );
};

export default adminRoutes;
