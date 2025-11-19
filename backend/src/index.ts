import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import multipart from '@fastify/multipart';
import path from 'path';
import { fileURLToPath } from 'url';
import healthRoutes from './routes/health.js';
import playersRoutes from './routes/players.js';
import { authRoutes } from './routes/auth.js';
import gameRoutes from './routes/game.js';
import adminRoutes from './routes/admin.js';
import { initDatabase, closeDatabase } from './db/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

// Start server
const start = async () => {
  try {
    // Initialize database
    initDatabase();

    // Register CORS
    await fastify.register(cors, {
      origin: process.env.NODE_ENV === 'production' ? false : '*',
    });

    // Register multipart for file uploads
    await fastify.register(multipart, {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
      },
    });

    // Serve static files (photos)
    await fastify.register(staticPlugin, {
      root: path.join(__dirname, '..', 'public'),
      prefix: '/',
    });

    // Register routes
    await fastify.register(healthRoutes, { prefix: '/api' });
    await fastify.register(authRoutes);
    await fastify.register(playersRoutes, { prefix: '/api' });
    await fastify.register(gameRoutes, { prefix: '/api' });
    await fastify.register(adminRoutes, { prefix: '/api' });

    const port = parseInt(process.env.PORT || '3001', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', () => {
  fastify.log.info('SIGINT signal received: closing HTTP server');
  fastify.close(() => {
    closeDatabase();
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  fastify.log.info('SIGTERM signal received: closing HTTP server');
  fastify.close(() => {
    closeDatabase();
    process.exit(0);
  });
});

start();
