import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../db/test-helper.js';
import { login, validateSession, logout, AuthError } from './auth.js';
import { findPlayerBySessionToken } from '../db/players.js';
import type { Database } from 'better-sqlite3';

describe('Auth Service', () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDb();

    // Insert test players
    const stmt = db.prepare(`
      INSERT INTO players (first_name, last_name, access_code, role, photo_filename, active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run('Alice', 'Johnson', 'ABC123', 'host', 'alice.jpg', 1);
    stmt.run('Bob', 'Smith', 'XYZ789', 'player', 'bob.jpg', 1);
    stmt.run('Inactive', 'User', 'INACTIVE', 'audience', 'default.jpg', 0);
  });

  describe('login', () => {
    it('should authenticate with valid access code', () => {
      const result = login(db, 'ABC123');

      expect(result).toBeDefined();
      expect(result.sessionToken).toBeDefined();
      expect(result.sessionToken).toHaveLength(32);
      expect(result.player.firstName).toBe('Alice');
      expect(result.player.lastName).toBe('Johnson');
      expect(result.player.role).toBe('host');
    });

    it('should normalize access code (trim and uppercase)', () => {
      const result = login(db, '  abc123  ');

      expect(result).toBeDefined();
      expect(result.player.firstName).toBe('Alice');
    });

    it('should generate unique session tokens', () => {
      const result1 = login(db, 'ABC123');
      const result2 = login(db, 'ABC123');

      expect(result1.sessionToken).not.toBe(result2.sessionToken);
    });

    it('should replace existing session token on new login', () => {
      const result1 = login(db, 'ABC123');
      const firstToken = result1.sessionToken;

      // Login again with same code
      const result2 = login(db, 'ABC123');
      const secondToken = result2.sessionToken;

      expect(firstToken).not.toBe(secondToken);

      // First token should no longer be valid
      const playerByFirstToken = findPlayerBySessionToken(db, firstToken);
      expect(playerByFirstToken).toBeNull();

      // Second token should be valid
      const playerBySecondToken = findPlayerBySessionToken(db, secondToken);
      expect(playerBySecondToken).not.toBeNull();
      expect(playerBySecondToken?.firstName).toBe('Alice');
    });

    it('should throw AuthError for invalid access code', () => {
      expect(() => {
        login(db, 'INVALID');
      }).toThrow(AuthError);

      expect(() => {
        login(db, 'INVALID');
      }).toThrow('Invalid access code');
    });

    it('should throw 401 error for invalid access code', () => {
      try {
        login(db, 'INVALID');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).statusCode).toBe(401);
      }
    });

    it('should throw AuthError for inactive player', () => {
      expect(() => {
        login(db, 'INACTIVE');
      }).toThrow(AuthError);

      expect(() => {
        login(db, 'INACTIVE');
      }).toThrow('Your account has been deactivated');
    });

    it('should throw 401 error for inactive player', () => {
      try {
        login(db, 'INACTIVE');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).statusCode).toBe(401);
      }
    });
  });

  describe('validateSession', () => {
    it('should return player for valid session token', () => {
      const { sessionToken } = login(db, 'ABC123');

      const player = validateSession(db, sessionToken);

      expect(player).not.toBeNull();
      expect(player?.firstName).toBe('Alice');
      expect(player?.sessionToken).toBe(sessionToken);
    });

    it('should return null for invalid session token', () => {
      const player = validateSession(db, 'invalid-token');

      expect(player).toBeNull();
    });

    it('should return null for empty session token', () => {
      const player = validateSession(db, '');

      expect(player).toBeNull();
    });

    it('should return null for whitespace-only session token', () => {
      const player = validateSession(db, '   ');

      expect(player).toBeNull();
    });

    it('should return null if player becomes inactive', () => {
      const { sessionToken } = login(db, 'ABC123');

      // Deactivate the player
      db.prepare(`UPDATE players SET active = 0 WHERE access_code = ?`).run('ABC123');

      const player = validateSession(db, sessionToken);

      expect(player).toBeNull();
    });

    it('should return null after session is invalidated by new login', () => {
      const { sessionToken: firstToken } = login(db, 'ABC123');

      // Login again to invalidate first token
      login(db, 'ABC123');

      const player = validateSession(db, firstToken);

      expect(player).toBeNull();
    });
  });

  describe('logout', () => {
    it('should clear session token', () => {
      const { sessionToken } = login(db, 'ABC123');

      logout(db, sessionToken);

      // Session should no longer be valid
      const player = validateSession(db, sessionToken);
      expect(player).toBeNull();
    });

    it('should throw AuthError for invalid session token', () => {
      expect(() => {
        logout(db, 'invalid-token');
      }).toThrow(AuthError);

      expect(() => {
        logout(db, 'invalid-token');
      }).toThrow('Invalid or expired session');
    });

    it('should throw AuthError for empty session token', () => {
      expect(() => {
        logout(db, '');
      }).toThrow(AuthError);
    });

    it('should throw 401 error for invalid session', () => {
      try {
        logout(db, 'invalid-token');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).statusCode).toBe(401);
      }
    });
  });

  describe('Access Code Edge Cases', () => {
    it('should handle lowercase access codes', () => {
      const result = login(db, 'abc123');
      expect(result.player.firstName).toBe('Alice');
    });

    it('should handle mixed case access codes', () => {
      const result = login(db, 'AbC123');
      expect(result.player.firstName).toBe('Alice');
    });

    it('should handle access codes with leading/trailing spaces', () => {
      const result = login(db, '  ABC123  ');
      expect(result.player.firstName).toBe('Alice');
    });

    it('should handle access codes with tabs', () => {
      const result = login(db, '\tABC123\t');
      expect(result.player.firstName).toBe('Alice');
    });

    it('should handle access codes with newlines', () => {
      const result = login(db, '\nABC123\n');
      expect(result.player.firstName).toBe('Alice');
    });

    it('should reject empty string after normalization', () => {
      expect(() => {
        login(db, '   ');
      }).toThrow(AuthError);
    });

    it('should handle numeric-only access codes', () => {
      // Insert numeric code
      db.prepare(
        'INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)',
      ).run('Numeric', 'User', '123456', 'player');

      const result = login(db, '123456');
      expect(result.player.firstName).toBe('Numeric');
    });

    it('should reject SQL injection attempts', () => {
      const sqlInjectionCode = "'; DROP TABLE players; --";
      expect(() => {
        login(db, sqlInjectionCode);
      }).toThrow(AuthError);

      // Verify table still exists
      const count = db.prepare('SELECT COUNT(*) as count FROM players').get() as {
        count: number;
      };
      expect(count.count).toBeGreaterThan(0);
    });

    it('should reject access codes with special characters', () => {
      expect(() => {
        login(db, 'TEST@1');
      }).toThrow(AuthError);
    });

    it('should handle very long access codes gracefully', () => {
      const longCode = 'A'.repeat(100);
      expect(() => {
        login(db, longCode);
      }).toThrow(AuthError);
    });
  });

  describe('Session Token Edge Cases', () => {
    it('should handle manually cleared session tokens', () => {
      const { sessionToken } = login(db, 'ABC123');

      // Manually set token to NULL in database
      db.prepare('UPDATE players SET session_token = NULL WHERE access_code = ?').run('ABC123');

      const player = validateSession(db, sessionToken);
      expect(player).toBeNull();
    });

    it('should reject session token with SQL injection', () => {
      const sqlInjectionToken = "'; DROP TABLE players; --";
      const player = validateSession(db, sqlInjectionToken);
      expect(player).toBeNull();

      // Verify table still exists
      const count = db.prepare('SELECT COUNT(*) as count FROM players').get() as {
        count: number;
      };
      expect(count.count).toBeGreaterThan(0);
    });

    it('should handle very long session tokens', () => {
      const longToken = 'A'.repeat(1000);
      const player = validateSession(db, longToken);
      expect(player).toBeNull();
    });

    it('should handle session tokens with special characters', () => {
      const specialToken = '!@#$%^&*()_+-={}[]|:;<>?,./';
      const player = validateSession(db, specialToken);
      expect(player).toBeNull();
    });
  });

  describe('Concurrent Login Scenarios', () => {
    it('should handle rapid successive logins', () => {
      const tokens: string[] = [];

      // Perform 5 rapid logins
      for (let i = 0; i < 5; i++) {
        const result = login(db, 'ABC123');
        tokens.push(result.sessionToken);
      }

      // All tokens should be unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(5);

      // Only the last token should be valid
      const lastToken = tokens[tokens.length - 1];
      const validPlayer = validateSession(db, lastToken);
      expect(validPlayer).not.toBeNull();

      // All previous tokens should be invalid
      for (let i = 0; i < tokens.length - 1; i++) {
        const player = validateSession(db, tokens[i]);
        expect(player).toBeNull();
      }
    });
  });

  describe('Player Deletion Scenarios', () => {
    it('should invalidate session if player is deleted', () => {
      const { sessionToken } = login(db, 'ABC123');

      // Delete the player
      db.prepare('DELETE FROM players WHERE access_code = ?').run('ABC123');

      // Session should be invalid
      const player = validateSession(db, sessionToken);
      expect(player).toBeNull();
    });

    it('should not allow login after player is deleted', () => {
      // Delete the player
      db.prepare('DELETE FROM players WHERE access_code = ?').run('ABC123');

      expect(() => {
        login(db, 'ABC123');
      }).toThrow(AuthError);
    });
  });

  describe('Token Reuse After Logout', () => {
    it('should prevent token reuse after logout', () => {
      const { sessionToken } = login(db, 'ABC123');

      // Logout
      logout(db, sessionToken);

      // Try to validate session with old token
      const player = validateSession(db, sessionToken);
      expect(player).toBeNull();

      // Try to logout again with same token
      expect(() => {
        logout(db, sessionToken);
      }).toThrow(AuthError);
    });
  });
});
