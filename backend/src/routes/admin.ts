import type { FastifyPluginAsync } from "fastify";
import { getDatabase } from "../db/connection.js";
import {
  exportDatabase,
  importDatabase,
  type DatabaseExport,
} from "../db/export-import.js";
import { authenticateRequest } from "../middleware/auth.js";
import { requireHost } from "../middleware/requireHost.js";

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
};

export default adminRoutes;
