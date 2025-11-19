import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import gameRoutes from './game.js';
import { initDatabase, closeDatabase } from '../db/connection.js';
import Database from 'better-sqlite3';
import { setGameEnabled } from '../db/game-state.js';

describe('Game API Routes', () => {
  let app: FastifyInstance;
  let db: Database.Database;
  let hostToken: string;
  let playerToken: string;

  beforeEach(async () => {
    // Use in-memory database for tests
    db = initDatabase(':memory:');

    // Create test players
    db.prepare(
      'INSERT INTO players (first_name, last_name, access_code, role, active, session_token) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('Host', 'User', 'HOST123', 'host', 1, 'host-token-123');

    db.prepare(
      'INSERT INTO players (first_name, last_name, access_code, role, active, session_token) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('Player', 'User', 'PLAY456', 'player', 1, 'player-token-456');

    hostToken = 'host-token-123';
    playerToken = 'player-token-456';

    app = Fastify();
    await app.register(gameRoutes, { prefix: '/api' });
  });

  afterEach(async () => {
    await app.close();
    closeDatabase();
  });

  describe('GET /api/game/status', () => {
    it('should return game status when authenticated as host', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/game/status',
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('enabled');
      expect(typeof body.enabled).toBe('boolean');
      expect(body.enabled).toBe(true); // Default from migration
    });

    it('should return game status when authenticated as player', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/game/status',
        headers: {
          Authorization: `Bearer ${playerToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('enabled');
      expect(body.enabled).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/game/status',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/game/status',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reflect game state changes', async () => {
      // Disable the game
      setGameEnabled(db, false);

      const response = await app.inject({
        method: 'GET',
        url: '/api/game/status',
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.enabled).toBe(false);
    });
  });

  describe('PUT /api/game/status', () => {
    it('should update game status when authenticated as host', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/game/status',
        headers: {
          Authorization: `Bearer ${hostToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          enabled: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.enabled).toBe(false);
      expect(body.message).toBe('Game disabled');

      // Verify it was actually updated in database
      const statusResponse = await app.inject({
        method: 'GET',
        url: '/api/game/status',
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const statusBody = JSON.parse(statusResponse.body);
      expect(statusBody.enabled).toBe(false);
    });

    it('should enable game with appropriate message', async () => {
      // First disable
      setGameEnabled(db, false);

      // Then enable
      const response = await app.inject({
        method: 'PUT',
        url: '/api/game/status',
        headers: {
          Authorization: `Bearer ${hostToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          enabled: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.enabled).toBe(true);
      expect(body.message).toBe('Game enabled');
    });

    it('should return 403 when authenticated as non-host', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/game/status',
        headers: {
          Authorization: `Bearer ${playerToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          enabled: false,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/game/status',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          enabled: false,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with missing enabled field', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/game/status',
        headers: {
          Authorization: `Bearer ${hostToken}`,
          'Content-Type': 'application/json',
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('enabled must be a boolean');
    });

    it('should return 400 with non-boolean enabled field', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/game/status',
        headers: {
          Authorization: `Bearer ${hostToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          enabled: 'true', // String instead of boolean
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('enabled must be a boolean');
    });

    it('should return 400 with null enabled field', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/game/status',
        headers: {
          Authorization: `Bearer ${hostToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          enabled: null,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('enabled must be a boolean');
    });

    it('should handle rapid toggle changes', async () => {
      // Toggle multiple times quickly
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: 'PUT',
          url: '/api/game/status',
          headers: {
            Authorization: `Bearer ${hostToken}`,
            'Content-Type': 'application/json',
          },
          payload: {
            enabled: i % 2 === 0,
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.enabled).toBe(i % 2 === 0);
      }

      // Final state should be false (i=4, even)
      const statusResponse = await app.inject({
        method: 'GET',
        url: '/api/game/status',
        headers: {
          Authorization: `Bearer ${hostToken}`,
        },
      });
      const statusBody = JSON.parse(statusResponse.body);
      expect(statusBody.enabled).toBe(true); // i=4 is even, so enabled=true
    });
  });

  describe('Edge Cases', () => {
    it('should handle setting game to same state repeatedly', async () => {
      // Set to false multiple times
      for (let i = 0; i < 3; i++) {
        const response = await app.inject({
          method: 'PUT',
          url: '/api/game/status',
          headers: {
            Authorization: `Bearer ${hostToken}`,
            'Content-Type': 'application/json',
          },
          payload: {
            enabled: false,
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.enabled).toBe(false);
      }
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/game/status',
        headers: {
          Authorization: `Bearer ${hostToken}`,
          'Content-Type': 'application/json',
        },
        payload: '{invalid json',
      });

      // Fastify will handle JSON parse errors
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should not accept extra fields in payload', async () => {
      // This should still work, just ignore extra fields
      const response = await app.inject({
        method: 'PUT',
        url: '/api/game/status',
        headers: {
          Authorization: `Bearer ${hostToken}`,
          'Content-Type': 'application/json',
        },
        payload: {
          enabled: false,
          extraField: 'should be ignored',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.enabled).toBe(false);
    });
  });
});
