import { FastifyPluginAsync } from "fastify";
import { getDatabase } from "../db/connection.js";
import { rowToPlayer, type PlayerRow } from "../types/player.js";

const playersRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/players - List all players
  fastify.get("/players", async () => {
    const db = getDatabase();

    const rows = db
      .prepare("SELECT * FROM players ORDER BY created_at DESC")
      .all() as PlayerRow[];

    const players = rows.map(rowToPlayer);

    return { players };
  });

  // GET /api/players/:id - Get single player
  fastify.get<{ Params: { id: string } }>(
    "/players/:id",
    async (request, reply) => {
      const db = getDatabase();
      const { id } = request.params;

      const row = db.prepare("SELECT * FROM players WHERE id = ?").get(id) as
        | PlayerRow
        | undefined;

      if (!row) {
        return reply.status(404).send({ error: "Player not found" });
      }

      return { player: rowToPlayer(row) };
    },
  );
};

export default playersRoutes;
