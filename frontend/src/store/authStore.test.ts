import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore } from './authStore';
import * as api from '../utils/api';

// Mock the API module
vi.mock('../utils/api');

describe('Auth Store', () => {
  beforeEach(() => {
    // Clear the store before each test
    useAuthStore.setState({
      sessionToken: null,
      currentPlayer: null,
      loading: false,
      error: null,
    });

    // Clear localStorage
    localStorage.clear();

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initial state', () => {
    it('should have null sessionToken initially', () => {
      const state = useAuthStore.getState();
      expect(state.sessionToken).toBeNull();
    });

    it('should have null currentPlayer initially', () => {
      const state = useAuthStore.getState();
      expect(state.currentPlayer).toBeNull();
    });

    it('should not be loading initially', () => {
      const state = useAuthStore.getState();
      expect(state.loading).toBe(false);
    });

    it('should have no error initially', () => {
      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('login', () => {
    const mockPlayer = {
      id: 1,
      firstName: 'Test',
      lastName: 'User',
      accessCode: 'TEST01',
      role: 'player' as const,
      email: null,
      photoFilename: 'default.jpg',
      active: true,
      sessionToken: 'test-token-123',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
    };

    it('should set loading to true during login', async () => {
      vi.mocked(api.login).mockImplementation(
        () =>
          new Promise((resolve) => {
            // Check loading state while promise is pending
            const state = useAuthStore.getState();
            expect(state.loading).toBe(true);
            resolve({ sessionToken: 'test-token-123', player: mockPlayer });
          }),
      );

      await useAuthStore.getState().login('TEST01');
    });

    it('should store sessionToken and player on successful login', async () => {
      vi.mocked(api.login).mockResolvedValue({
        sessionToken: 'test-token-123',
        player: mockPlayer,
      });

      await useAuthStore.getState().login('TEST01');

      const state = useAuthStore.getState();
      expect(state.sessionToken).toBe('test-token-123');
      expect(state.currentPlayer).toEqual(mockPlayer);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should persist sessionToken to localStorage', async () => {
      vi.mocked(api.login).mockResolvedValue({
        sessionToken: 'test-token-123',
        player: mockPlayer,
      });

      await useAuthStore.getState().login('TEST01');

      const stored = localStorage.getItem('pir_auth_storage');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.state.sessionToken).toBe('test-token-123');
    });

    it('should set error on failed login', async () => {
      vi.mocked(api.login).mockRejectedValue(new Error('Invalid access code'));

      try {
        await useAuthStore.getState().login('INVALID');
      } catch (_error) {
        // Expected to throw
      }

      const state = useAuthStore.getState();
      expect(state.sessionToken).toBeNull();
      expect(state.currentPlayer).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Invalid access code');
    });

    it('should clear previous error on new login attempt', async () => {
      // Set an error
      useAuthStore.setState({ error: 'Previous error' });

      vi.mocked(api.login).mockResolvedValue({
        sessionToken: 'test-token-123',
        player: mockPlayer,
      });

      await useAuthStore.getState().login('TEST01');

      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
    });

    it('should rethrow error after storing it', async () => {
      vi.mocked(api.login).mockRejectedValue(new Error('Invalid access code'));

      await expect(useAuthStore.getState().login('INVALID')).rejects.toThrow('Invalid access code');
    });
  });

  describe('logout', () => {
    const mockPlayer = {
      id: 1,
      firstName: 'Test',
      lastName: 'User',
      accessCode: 'TEST01',
      role: 'player' as const,
      email: null,
      photoFilename: 'default.jpg',
      active: true,
      sessionToken: 'test-token-123',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
    };

    beforeEach(async () => {
      // Set up a logged-in state
      useAuthStore.setState({
        sessionToken: 'test-token-123',
        currentPlayer: mockPlayer,
      });
    });

    it('should clear sessionToken and player on logout', async () => {
      vi.mocked(api.logout).mockResolvedValue();

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.sessionToken).toBeNull();
      expect(state.currentPlayer).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should clear localStorage on logout', async () => {
      vi.mocked(api.logout).mockResolvedValue();

      await useAuthStore.getState().logout();

      const stored = localStorage.getItem('pir_auth_storage');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.state.sessionToken).toBeNull();
    });

    it('should call API logout when session token exists', async () => {
      vi.mocked(api.logout).mockResolvedValue();

      await useAuthStore.getState().logout();

      expect(api.logout).toHaveBeenCalledTimes(1);
    });

    it('should not call API logout when no session token', async () => {
      // Clear session first
      useAuthStore.setState({
        sessionToken: null,
        currentPlayer: null,
      });

      vi.mocked(api.logout).mockResolvedValue();

      await useAuthStore.getState().logout();

      expect(api.logout).not.toHaveBeenCalled();
    });

    it('should clear session even if API call fails', async () => {
      vi.mocked(api.logout).mockRejectedValue(new Error('Network error'));

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.sessionToken).toBeNull();
      expect(state.currentPlayer).toBeNull();
    });

    it('should set error if API logout fails', async () => {
      vi.mocked(api.logout).mockRejectedValue(new Error('Network error'));

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.error).toBe('Network error');
    });
  });

  describe('validateSession', () => {
    const mockPlayer = {
      id: 1,
      firstName: 'Test',
      lastName: 'User',
      accessCode: 'TEST01',
      role: 'player' as const,
      email: null,
      photoFilename: 'default.jpg',
      active: true,
      sessionToken: 'test-token-123',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
    };

    it('should do nothing if no session token exists', async () => {
      await useAuthStore.getState().validateSession();

      const state = useAuthStore.getState();
      expect(state.loading).toBe(false);
      expect(api.validateSession).not.toHaveBeenCalled();
    });

    it('should update player on successful validation', async () => {
      useAuthStore.setState({ sessionToken: 'test-token-123' });

      vi.mocked(api.validateSession).mockResolvedValue({
        player: mockPlayer,
      });

      await useAuthStore.getState().validateSession();

      const state = useAuthStore.getState();
      expect(state.currentPlayer).toEqual(mockPlayer);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should clear session on validation failure', async () => {
      useAuthStore.setState({
        sessionToken: 'invalid-token',
        currentPlayer: mockPlayer,
      });

      vi.mocked(api.validateSession).mockRejectedValue(new Error('Invalid session'));

      await useAuthStore.getState().validateSession();

      const state = useAuthStore.getState();
      expect(state.sessionToken).toBeNull();
      expect(state.currentPlayer).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull(); // Should not show error for validation failure
    });
  });

  describe('handleSessionExpired', () => {
    const mockPlayer = {
      id: 1,
      firstName: 'Test',
      lastName: 'User',
      accessCode: 'TEST01',
      role: 'player' as const,
      email: null,
      photoFilename: 'default.jpg',
      active: true,
      sessionToken: 'test-token-123',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
    };

    beforeEach(() => {
      useAuthStore.setState({
        sessionToken: 'test-token-123',
        currentPlayer: mockPlayer,
      });
    });

    it('should clear session', () => {
      useAuthStore.getState().handleSessionExpired();

      const state = useAuthStore.getState();
      expect(state.sessionToken).toBeNull();
      expect(state.currentPlayer).toBeNull();
    });

    it('should set error message', () => {
      useAuthStore.getState().handleSessionExpired();

      const state = useAuthStore.getState();
      expect(state.error).toBe('Your session has expired. Please log in again.');
    });

    it('should not call API', () => {
      useAuthStore.getState().handleSessionExpired();

      expect(api.logout).not.toHaveBeenCalled();
    });
  });

  describe('clearError', () => {
    it('should clear error message', () => {
      useAuthStore.setState({ error: 'Some error' });

      useAuthStore.getState().clearError();

      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('localStorage persistence', () => {
    it('should persist sessionToken and currentPlayer', async () => {
      const mockPlayer = {
        id: 1,
        firstName: 'Test',
        lastName: 'User',
        accessCode: 'TEST01',
        role: 'player' as const,
        email: null,
        photoFilename: 'default.jpg',
        active: true,
        sessionToken: 'test-token-123',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      };

      vi.mocked(api.login).mockResolvedValue({
        sessionToken: 'test-token-123',
        player: mockPlayer,
      });

      await useAuthStore.getState().login('TEST01');

      const stored = localStorage.getItem('pir_auth_storage');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.sessionToken).toBe('test-token-123');
      expect(parsed.state.currentPlayer).toEqual(mockPlayer);
    });

    it('should not persist loading or error states', async () => {
      useAuthStore.setState({
        sessionToken: 'test-token',
        currentPlayer: null,
        loading: true,
        error: 'Some error',
      });

      const stored = localStorage.getItem('pir_auth_storage');
      const parsed = JSON.parse(stored!);

      expect(parsed.state.loading).toBeUndefined();
      expect(parsed.state.error).toBeUndefined();
    });
  });
});
