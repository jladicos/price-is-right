import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";
import multipart from "@fastify/multipart";
import path from "path";
import { fileURLToPath } from "url";
import healthRoutes from "./routes/health.js";
import playersRoutes from "./routes/players.js";
import { authRoutes } from "./routes/auth.js";
import gameRoutes from "./routes/game.js";
import adminRoutes from "./routes/admin.js";
import biddingRoutes from "./routes/bidding.js";
import productsRoutes from "./routes/products.js";
import { initDatabase, closeDatabase } from "./db/connection.js";
import { checkForInProgressGame, resumeGame } from "./services/game-resume.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
  },
});

// Start server
const start = async () => {
  try {
    // Initialize database
    initDatabase();

    // Check for in-progress game and auto-resume
    if (checkForInProgressGame()) {
      const state = resumeGame();
      fastify.log.info(
        `Resuming in-progress game: phase=${state.workflow.phase_type}, segment=${state.workflow.current_segment}`,
      );
      fastify.log.info(
        `Section 1 contestants: ${state.section1Contestants.length}, Section 2 contestants: ${state.section2Contestants.length}`,
      );
    } else {
      fastify.log.info(
        "No in-progress game detected. Ready to start new game.",
      );
    }

    // Register CORS
    await fastify.register(cors, {
      origin: process.env.NODE_ENV === "production" ? false : "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    });

    // Register multipart for file uploads
    await fastify.register(multipart, {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
      },
    });

    // Serve static files (photos)
    await fastify.register(staticPlugin, {
      root: path.join(__dirname, "..", "public"),
      prefix: "/",
    });

    // Register routes
    await fastify.register(healthRoutes, { prefix: "/api" });
    await fastify.register(authRoutes);
    await fastify.register(playersRoutes, { prefix: "/api" });
    await fastify.register(gameRoutes, { prefix: "/api" });
    await fastify.register(biddingRoutes, { prefix: "/api" });
    await fastify.register(productsRoutes, { prefix: "/api" });
    await fastify.register(adminRoutes, { prefix: "/api" });

    const port = parseInt(process.env.PORT || "3001", 10);
    await fastify.listen({ port, host: "0.0.0.0" });
    fastify.log.info(`Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on("SIGINT", () => {
  fastify.log.info("SIGINT signal received: closing HTTP server");
  fastify.close(() => {
    closeDatabase();
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  fastify.log.info("SIGTERM signal received: closing HTTP server");
  fastify.close(() => {
    closeDatabase();
    process.exit(0);
  });
});

start();
