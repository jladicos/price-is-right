import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { authRoutes } from './auth';
import { initDatabase, closeDatabase } from '../db/connection';
import Database from 'better-sqlite3';

describe('Auth API Routes', () => {
  let app: FastifyInstance;
  let db: Database.Database;

  beforeEach(async () => {
    // Use in-memory database for tests
    db = initDatabase(':memory:');

    // Create test players
    db.prepare(
      'INSERT INTO players (first_name, last_name, access_code, role, active) VALUES (?, ?, ?, ?, ?)',
    ).run('Alice', 'Johnson', 'ABC123', 'host', 1);

    db.prepare(
      'INSERT INTO players (first_name, last_name, access_code, role, active) VALUES (?, ?, ?, ?, ?)',
    ).run('Bob', 'Smith', 'XYZ789', 'player', 1);

    db.prepare(
      'INSERT INTO players (first_name, last_name, access_code, role, active) VALUES (?, ?, ?, ?, ?)',
    ).run('Inactive', 'User', 'INACTIVE', 'audience', 0);

    app = Fastify();
    await app.register(authRoutes);
  });

  afterEach(async () => {
    await app.close();
    closeDatabase();
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid access code', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          accessCode: 'ABC123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.sessionToken).toBeDefined();
      expect(body.sessionToken).toHaveLength(32);
      expect(body.player).toBeDefined();
      expect(body.player.firstName).toBe('Alice');
      expect(body.player.lastName).toBe('Johnson');
      expect(body.player.accessCode).toBe('ABC123');
      expect(body.player.role).toBe('host');
    });

    it('should normalize access code (trim and uppercase)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          accessCode: '  abc123  ',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.player.firstName).toBe('Alice');
    });

    it('should return 401 for invalid access code', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          accessCode: 'INVALID',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Authentication Failed');
      expect(body.message).toBe('Invalid access code');
    });

    it('should return 401 for inactive player', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          accessCode: 'INACTIVE',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Authentication Failed');
      expect(body.message).toBe('Your account has been deactivated');
    });

    it('should return 400 when access code is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toBe('Access code is required');
    });

    it('should return 400 when access code is empty string', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          accessCode: '',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Access code is required');
    });

    it('should return 400 when access code is whitespace only', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          accessCode: '   ',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Access code is required');
    });

    it('should handle malformed JSON', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: 'invalid json{',
        headers: {
          'content-type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should replace existing session token on new login', async () => {
      // First login
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          accessCode: 'ABC123',
        },
      });

      const body1 = JSON.parse(response1.body);
      const firstToken = body1.sessionToken;

      // Second login
      const response2 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          accessCode: 'ABC123',
        },
      });

      const body2 = JSON.parse(response2.body);
      const secondToken = body2.sessionToken;

      expect(firstToken).not.toBe(secondToken);

      // First token should be invalid now
      const sessionResponse = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: {
          authorization: `Bearer ${firstToken}`,
        },
      });

      expect(sessionResponse.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      // Login first
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          accessCode: 'ABC123',
        },
      });

      const { sessionToken } = JSON.parse(loginResponse.body);

      // Logout
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Logged out successfully');

      // Token should be invalid after logout
      const sessionResponse = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(sessionResponse.statusCode).toBe(401);
    });

    it('should return 401 when authorization header is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('Missing authorization header');
    });

    it('should return 401 with invalid token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 with malformed authorization header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          authorization: 'InvalidFormat',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Invalid authorization header format');
    });
  });

  describe('GET /api/auth/session', () => {
    it('should return player info with valid token', async () => {
      // Login first
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          accessCode: 'ABC123',
        },
      });

      const { sessionToken } = JSON.parse(loginResponse.body);

      // Validate session
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.player).toBeDefined();
      expect(body.player.firstName).toBe('Alice');
      expect(body.player.lastName).toBe('Johnson');
      expect(body.player.accessCode).toBe('ABC123');
    });

    it('should return 401 when authorization header is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('Missing authorization header');
    });

    it('should return 401 with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Invalid or expired session');
    });

    it('should return 401 after player is deactivated', async () => {
      // Login first
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          accessCode: 'ABC123',
        },
      });

      const { sessionToken } = JSON.parse(loginResponse.body);

      // Deactivate player
      db.prepare('UPDATE players SET active = 0 WHERE access_code = ?').run('ABC123');

      // Session should be invalid
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 401 with Bearer token that has extra whitespace', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
        headers: {
          authorization: 'Bearer  token-with-extra-space',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
