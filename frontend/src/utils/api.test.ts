import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  login,
  logout,
  validateSession,
  setSessionExpiredHandler,
  setSessionTokenGetter,
  type LoginResponse,
  type SessionResponse,
} from './api';

// Mock fetch
global.fetch = vi.fn();

describe('API Client', () => {
  let mockSessionExpiredHandler: ReturnType<typeof vi.fn>;
  let mockSessionTokenGetter: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSessionExpiredHandler = vi.fn();
    mockSessionTokenGetter = vi.fn();

    setSessionExpiredHandler(mockSessionExpiredHandler);
    setSessionTokenGetter(mockSessionTokenGetter);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('login', () => {
    it('should make POST request to /api/auth/login', async () => {
      const mockResponse: LoginResponse = {
        sessionToken: 'test-token-123',
        player: {
          id: 1,
          firstName: 'Test',
          lastName: 'User',
          accessCode: 'TEST01',
          role: 'player',
          email: null,
          photoFilename: 'default.jpg',
          active: true,
          sessionToken: 'test-token-123',
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await login('TEST01');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ accessCode: 'TEST01' }),
        }),
      );

      expect(result).toEqual(mockResponse);
    });

    it('should not include Authorization header for login when no token exists', async () => {
      mockSessionTokenGetter.mockReturnValue(null);

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await login('TEST01');

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;

      // Should not have Authorization header for login
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should throw error on 401 response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Authentication Failed',
          message: 'Invalid access code',
        }),
      } as Response);

      await expect(login('INVALID')).rejects.toThrow('Invalid access code');
    });

    it('should call session expired handler on 401', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Authentication Failed',
          message: 'Invalid access code',
        }),
      } as Response);

      await expect(login('INVALID')).rejects.toThrow();

      expect(mockSessionExpiredHandler).toHaveBeenCalledTimes(1);
    });

    it('should throw error on non-401 error responses', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Internal Server Error',
          message: 'Something went wrong',
        }),
      } as Response);

      await expect(login('TEST01')).rejects.toThrow('Something went wrong');
    });

    it('should use error field if message is not available', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Bad Request',
        }),
      } as Response);

      await expect(login('TEST01')).rejects.toThrow('Bad Request');
    });

    it('should use generic message if neither error nor message available', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response);

      await expect(login('TEST01')).rejects.toThrow('Request failed');
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      mockSessionTokenGetter.mockReturnValue('test-token-123');
    });

    it('should make POST request to /api/auth/logout', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Logged out successfully' }),
      } as Response);

      await logout();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/auth/logout',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should include Authorization header with session token', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await logout();

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;

      expect(headers['Authorization']).toBe('Bearer test-token-123');
    });

    it('should not include Authorization header if no token', async () => {
      mockSessionTokenGetter.mockReturnValue(null);

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await logout();

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;

      expect(headers['Authorization']).toBeUndefined();
    });

    it('should handle 401 response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Unauthorized',
          message: 'Invalid session',
        }),
      } as Response);

      await expect(logout()).rejects.toThrow('Invalid session');
      expect(mockSessionExpiredHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateSession', () => {
    beforeEach(() => {
      mockSessionTokenGetter.mockReturnValue('test-token-123');
    });

    it('should make GET request to /api/auth/session', async () => {
      const mockResponse: SessionResponse = {
        player: {
          id: 1,
          firstName: 'Test',
          lastName: 'User',
          accessCode: 'TEST01',
          role: 'player',
          email: null,
          photoFilename: 'default.jpg',
          active: true,
          sessionToken: 'test-token-123',
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await validateSession();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/auth/session',
        expect.objectContaining({
          method: 'GET',
        }),
      );

      expect(result).toEqual(mockResponse);
    });

    it('should include Authorization header', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await validateSession();

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;

      expect(headers['Authorization']).toBe('Bearer test-token-123');
    });

    it('should handle 401 response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Unauthorized',
          message: 'Invalid or expired session',
        }),
      } as Response);

      await expect(validateSession()).rejects.toThrow('Invalid or expired session');
      expect(mockSessionExpiredHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Session token injection', () => {
    it('should inject token from getter for all authenticated requests', async () => {
      mockSessionTokenGetter.mockReturnValue('my-session-token');

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await logout();

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;

      expect(headers['Authorization']).toBe('Bearer my-session-token');
    });

    it('should handle token getter returning null', async () => {
      mockSessionTokenGetter.mockReturnValue(null);

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await logout();

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;

      expect(headers['Authorization']).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      mockSessionTokenGetter.mockReturnValue('test-token');
    });

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      await expect(login('TEST01')).rejects.toThrow('Network error');
    });

    it('should handle JSON parse errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as Response);

      await expect(login('TEST01')).rejects.toThrow('Invalid JSON');
    });

    it('should not call session expired handler for non-401 errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Internal Server Error',
        }),
      } as Response);

      await expect(login('TEST01')).rejects.toThrow();

      expect(mockSessionExpiredHandler).not.toHaveBeenCalled();
    });
  });

  describe('Content-Type header', () => {
    beforeEach(() => {
      mockSessionTokenGetter.mockReturnValue('test-token');
    });

    it('should always include Content-Type: application/json', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await login('TEST01');

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;

      expect(headers['Content-Type']).toBe('application/json');
    });
  });
});
