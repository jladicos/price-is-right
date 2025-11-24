import { FastifyPluginAsync } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import { getDatabase } from "../db/connection.js";
import { rowToPlayer, type PlayerRow } from "../types/player.js";
import { authenticateRequest } from "../middleware/auth.js";
import { requireHost } from "../middleware/requireHost.js";
import {
  searchPlayers,
  type SearchPlayersOptions,
  updatePlayer,
  type UpdatePlayerData,
  deactivatePlayer,
  activatePlayer,
  resetPlayerAccessCode,
  countHosts,
  getPlayerById,
  createPlayer,
  type CreatePlayerData,
  resetAllAccessCodes,
  deleteAllNonHostPlayers,
} from "../db/players.js";
import type { PlayerRole } from "../types/player.js";
import { generateUniqueAccessCode } from "../utils/access-code.js";
import {
  generatePlayerPhotoFilename,
  getFileExtension,
  isValidImageType,
} from "../utils/filename.js";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const playersRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/players - List/search players (host only)
  fastify.get<{
    Querystring: {
      search?: string;
      role?: PlayerRole;
      active?: string; // Will be "true" or "false" as string
      sortBy?: "name" | "role" | "created_at";
      sortOrder?: "asc" | "desc";
      limit?: string; // Query params come as strings
      offset?: string;
    };
  }>(
    "/players",
    { preHandler: [authenticateRequest, requireHost] },
    async (request) => {
      const db = getDatabase();

      // Parse query parameters
      const options: SearchPlayersOptions = {};

      if (request.query.search) {
        options.search = request.query.search;
      }

      if (request.query.role) {
        options.role = request.query.role;
      }

      if (request.query.active !== undefined) {
        options.active = request.query.active === "true";
      }

      if (request.query.sortBy) {
        options.sortBy = request.query.sortBy;
      }

      if (request.query.sortOrder) {
        options.sortOrder = request.query.sortOrder;
      }

      if (request.query.limit) {
        options.limit = parseInt(request.query.limit, 10);
      }

      if (request.query.offset) {
        options.offset = parseInt(request.query.offset, 10);
      }

      const result = searchPlayers(db, options);

      return { players: result.players, total: result.total };
    },
  );

  // POST /api/players - Create new player (host only)
  fastify.post(
    "/players",
    { preHandler: [authenticateRequest, requireHost] },
    async (request, reply) => {
      const db = getDatabase();

      // Get multipart form data
      const parts = request.parts();
      let firstName = "";
      let lastName = "";
      let role: PlayerRole = "player";
      let photoFile: MultipartFile | null = null;

      for await (const part of parts) {
        if (part.type === "field") {
          if (part.fieldname === "firstName") firstName = part.value as string;
          if (part.fieldname === "lastName") lastName = part.value as string;
          if (part.fieldname === "role") role = part.value as PlayerRole;
        } else if (part.type === "file" && part.fieldname === "photo") {
          photoFile = part;
        }
      }

      // Validate required fields
      if (!firstName.trim() || !lastName.trim()) {
        return reply
          .status(400)
          .send({ error: "First name and last name are required" });
      }

      // Generate unique access code
      const accessCode = generateUniqueAccessCode(db);

      // Handle photo upload if provided
      let photoFilename = "default.jpg";
      if (photoFile) {
        // Validate file type
        if (!isValidImageType(photoFile.mimetype)) {
          return reply.status(400).send({
            error: "Invalid file type. Only JPG, PNG, and GIF are allowed",
          });
        }

        // Generate filename from player name
        const extension = getFileExtension(
          photoFile.filename,
          photoFile.mimetype,
        );
        photoFilename = generatePlayerPhotoFilename(
          firstName,
          lastName,
          extension,
        );

        // Save file
        const photoDir = path.join(
          __dirname,
          "..",
          "..",
          "public",
          "images",
          "players",
        );
        await fs.mkdir(photoDir, { recursive: true });
        const filePath = path.join(photoDir, photoFilename);
        await pipeline(photoFile.file, fs.createWriteStream(filePath));
      }

      // Create player in database
      const playerData: CreatePlayerData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        accessCode,
        role,
        photoFilename,
      };

      const newPlayer = createPlayer(db, playerData);

      return reply.status(201).send({
        player: newPlayer,
        message: "Player created successfully",
      });
    },
  );

  // GET /api/players/:id - Get single player (host only)
  fastify.get<{ Params: { id: string } }>(
    "/players/:id",
    { preHandler: [authenticateRequest, requireHost] },
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

  // PUT /api/players/:id - Update player details (host only)
  fastify.put<{
    Params: { id: string };
    Body: {
      firstName?: string;
      lastName?: string;
      role?: PlayerRole;
      photoFilename?: string;
      weight?: number;
    };
  }>(
    "/players/:id",
    { preHandler: [authenticateRequest, requireHost] },
    async (request, reply) => {
      const db = getDatabase();
      const playerId = parseInt(request.params.id, 10);
      const { firstName, lastName, role, photoFilename, weight } = request.body;

      // Check if player exists
      const existingPlayer = getPlayerById(db, playerId);
      if (!existingPlayer) {
        return reply.status(404).send({ error: "Player not found" });
      }

      // Validate role change: player -> host is not allowed
      if (role && role !== existingPlayer.role) {
        if (existingPlayer.role === "player" && role === "host") {
          return reply.status(400).send({
            error: "Cannot promote a player to host (unfair advantage)",
          });
        }

        // Check if demoting last host
        if (existingPlayer.role === "host" && role !== "host") {
          const hostCount = countHosts(db);
          if (hostCount <= 1) {
            return reply.status(400).send({
              error: "Cannot demote the last host",
            });
          }
        }
      }

      // Validate and clamp weight if provided
      let validatedWeight: number | undefined;
      if (weight !== undefined) {
        if (typeof weight !== "number" || isNaN(weight)) {
          return reply
            .status(400)
            .send({ error: "Weight must be a valid number" });
        }
        // Clamp to [0, 1] range
        validatedWeight = Math.max(0, Math.min(1, weight));
      }

      const updateData: UpdatePlayerData = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (role !== undefined) updateData.role = role;
      if (photoFilename !== undefined) updateData.photoFilename = photoFilename;
      if (validatedWeight !== undefined) updateData.weight = validatedWeight;

      const updatedPlayer = updatePlayer(db, playerId, updateData);

      return { player: updatedPlayer };
    },
  );

  // PUT /api/players/:id/reset-code - Reset player's access code (host only)
  fastify.put<{ Params: { id: string } }>(
    "/players/:id/reset-code",
    { preHandler: [authenticateRequest, requireHost] },
    async (request, reply) => {
      const db = getDatabase();
      const playerId = parseInt(request.params.id, 10);

      // Check if player exists
      const existingPlayer = getPlayerById(db, playerId);
      if (!existingPlayer) {
        return reply.status(404).send({ error: "Player not found" });
      }

      // Generate new unique access code
      const newAccessCode = generateUniqueAccessCode(db);

      // Reset the access code and clear session
      const updatedPlayer = resetPlayerAccessCode(db, playerId, newAccessCode);

      return { player: updatedPlayer };
    },
  );

  // PUT /api/players/:id/deactivate - Deactivate player (host only)
  fastify.put<{ Params: { id: string } }>(
    "/players/:id/deactivate",
    { preHandler: [authenticateRequest, requireHost] },
    async (request, reply) => {
      const db = getDatabase();
      const playerId = parseInt(request.params.id, 10);

      // Check if player exists
      const existingPlayer = getPlayerById(db, playerId);
      if (!existingPlayer) {
        return reply.status(404).send({ error: "Player not found" });
      }

      const updatedPlayer = deactivatePlayer(db, playerId);

      return { player: updatedPlayer };
    },
  );

  // PUT /api/players/:id/activate - Activate player (host only)
  fastify.put<{ Params: { id: string } }>(
    "/players/:id/activate",
    { preHandler: [authenticateRequest, requireHost] },
    async (request, reply) => {
      const db = getDatabase();
      const playerId = parseInt(request.params.id, 10);

      // Check if player exists
      const existingPlayer = getPlayerById(db, playerId);
      if (!existingPlayer) {
        return reply.status(404).send({ error: "Player not found" });
      }

      const updatedPlayer = activatePlayer(db, playerId);

      return { player: updatedPlayer };
    },
  );

  // POST /api/players/:id/photo - Upload player photo (host only)
  fastify.post<{ Params: { id: string } }>(
    "/players/:id/photo",
    { preHandler: [authenticateRequest, requireHost] },
    async (request, reply) => {
      const db = getDatabase();
      const playerId = parseInt(request.params.id, 10);

      // Check if player exists
      const player = getPlayerById(db, playerId);
      if (!player) {
        return reply.status(404).send({ error: "Player not found" });
      }

      // Get the uploaded file
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: "No file uploaded" });
      }

      // Validate file type
      if (!isValidImageType(data.mimetype)) {
        return reply.status(400).send({
          error: "Invalid file type. Only JPG, PNG, and GIF are allowed",
        });
      }

      // Generate filename from player name
      const extension = getFileExtension(data.filename, data.mimetype);
      const filename = generatePlayerPhotoFilename(
        player.firstName,
        player.lastName,
        extension,
      );

      // Determine photo directory
      const photoDir = path.join(
        __dirname,
        "..",
        "..",
        "public",
        "images",
        "players",
      );

      // Ensure directory exists
      await fsPromises.mkdir(photoDir, { recursive: true });

      // Save file
      const filePath = path.join(photoDir, filename);
      await pipeline(data.file, fs.createWriteStream(filePath));

      // Update player's photo filename in database
      const updatedPlayer = updatePlayer(db, playerId, {
        photoFilename: filename,
      });

      return {
        player: updatedPlayer,
        filename,
        message: "Photo uploaded successfully",
      };
    },
  );

  // POST /api/players/bulk/reset-codes - Reset all access codes (host only)
  fastify.post(
    "/players/bulk/reset-codes",
    { preHandler: [authenticateRequest, requireHost] },
    async (_request, _reply) => {
      const db = getDatabase();

      // Reset all access codes
      const count = resetAllAccessCodes(db, () => generateUniqueAccessCode(db));

      return {
        message: `Successfully reset access codes for ${count} player(s)`,
        count,
      };
    },
  );

  // DELETE /api/players/bulk/delete-all - Delete all non-host players (host only)
  fastify.delete(
    "/players/bulk/delete-all",
    { preHandler: [authenticateRequest, requireHost] },
    async (_request, _reply) => {
      const db = getDatabase();

      // Delete all non-host players
      const count = deleteAllNonHostPlayers(db);

      return {
        message: `Successfully deleted ${count} non-host player(s)`,
        count,
      };
    },
  );
};

export default playersRoutes;
