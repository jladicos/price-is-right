import { describe, it, expect } from 'vitest';
import { generateSessionToken } from './session-token';

describe('Session Token Generation', () => {
  describe('generateSessionToken', () => {
    it('should generate a token of exactly 32 characters', () => {
      const token = generateSessionToken();
      expect(token).toHaveLength(32);
    });

    it('should generate alphanumeric tokens only', () => {
      const token = generateSessionToken();
      const alphanumericRegex = /^[A-Za-z0-9]+$/;
      expect(token).toMatch(alphanumericRegex);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        tokens.add(generateSessionToken());
      }

      // All tokens should be unique
      expect(tokens.size).toBe(iterations);
    });

    it('should generate different tokens on subsequent calls', () => {
      const token1 = generateSessionToken();
      const token2 = generateSessionToken();
      const token3 = generateSessionToken();

      expect(token1).not.toBe(token2);
      expect(token2).not.toBe(token3);
      expect(token1).not.toBe(token3);
    });
  });
});
