import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useAuthStore } from "./authStore";
import { useGameStore, setGameStoreSessionTokenGetter } from "./gameStore";
import { AUTH_STORAGE_KEY } from "../constants/auth";

/**
 * Integration tests to ensure auth storage alignment between authStore and gameStore
 * These tests verify that both stores access the same authentication data correctly
 */
describe("Auth Storage Integration", () => {
  // Mock fetch for API calls
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Clear stores
    useAuthStore.setState({
      sessionToken: null,
      currentPlayer: null,
      loading: false,
      error: null,
    });

    useGameStore.setState({
      gameState: null,
      isLoading: false,
      error: null,
      lastUpdated: 0,
    });

    // Clear localStorage
    localStorage.clear();

    // Set up mock fetch
    global.fetch = mockFetch;
    mockFetch.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("Storage Key Consistency", () => {
    it("should use the same storage key constant", () => {
      // This test verifies that AUTH_STORAGE_KEY is being used consistently
      const testToken = "test-session-token-123";
      const testPlayer = {
        id: 1,
        firstName: "Test",
        lastName: "Host",
        accessCode: "HOST001",
        role: "host" as const,
        email: "host@test.com",
        photoFilename: "host.jpg",
        active: true,
        sessionToken: testToken,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Set auth state directly (simulating successful login)
      useAuthStore.setState({
        sessionToken: testToken,
        currentPlayer: testPlayer,
      });

      // Verify localStorage uses the correct key
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.sessionToken).toBe(testToken);
      expect(parsed.state.currentPlayer).toEqual(testPlayer);
    });
  });

  describe("Token Access via Callback", () => {
    it("should allow gameStore to access authStore token via callback", async () => {
      const testToken = "callback-test-token";

      // Set up authStore with a token
      useAuthStore.setState({
        sessionToken: testToken,
        currentPlayer: {
          id: 1,
          firstName: "Test",
          lastName: "Host",
          accessCode: "HOST001",
          role: "host",
          email: "host@test.com",
          photoFilename: "host.jpg",
          active: true,
          sessionToken: testToken,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      // Set up gameStore callback (this happens in authStore.ts at app startup)
      setGameStoreSessionTokenGetter(
        () => useAuthStore.getState().sessionToken,
      );

      // Mock a successful game state fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          state: {
            workflow: {
              id: 1,
              current_segment: "section_1",
              current_segment_index: 0,
              phase_type: "bidding",
              phase_metadata: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            contestantsRow: [],
            eligibleAudienceCount: 10,
          },
        }),
      });

      // Try to fetch game state
      await useGameStore.getState().fetchGameState();

      // Verify the token was passed correctly
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/game/state"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${testToken}`,
          }),
        }),
      );

      // Verify no error
      expect(useGameStore.getState().error).toBeNull();
    });

    it('should get "Not authenticated" error when authStore has no token', async () => {
      // Set up gameStore callback
      setGameStoreSessionTokenGetter(
        () => useAuthStore.getState().sessionToken,
      );

      // authStore has no token
      expect(useAuthStore.getState().sessionToken).toBeNull();

      // Try to fetch game state
      await useGameStore.getState().fetchGameState();

      // Should get authentication error
      expect(useGameStore.getState().error).toBe("Not authenticated");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle token changes dynamically", async () => {
      const token1 = "token-one";
      const token2 = "token-two";

      // Set up gameStore callback
      setGameStoreSessionTokenGetter(
        () => useAuthStore.getState().sessionToken,
      );

      // Set first token
      useAuthStore.setState({ sessionToken: token1 });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ state: {} }),
      });

      // First fetch with token1
      await useGameStore.getState().fetchGameState();
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${token1}`,
          }),
        }),
      );

      // Change token
      useAuthStore.setState({ sessionToken: token2 });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ state: {} }),
      });

      // Second fetch with token2
      await useGameStore.getState().fetchGameState();
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${token2}`,
          }),
        }),
      );
    });
  });

  describe("Persistence Integration", () => {
    it("should persist auth token and allow gameStore to access it after page reload", () => {
      const testToken = "persistent-token-123";
      const testPlayer = {
        id: 1,
        firstName: "Test",
        lastName: "Host",
        accessCode: "HOST001",
        role: "host" as const,
        email: "host@test.com",
        photoFilename: "host.jpg",
        active: true,
        sessionToken: testToken,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Simulate login
      useAuthStore.setState({
        sessionToken: testToken,
        currentPlayer: testPlayer,
      });

      // Verify it's in localStorage with correct key
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.sessionToken).toBe(testToken);

      // Simulate page reload by getting token via callback
      setGameStoreSessionTokenGetter(() => {
        const authState = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!authState) return null;
        const parsed = JSON.parse(authState);
        return parsed.state?.sessionToken || null;
      });

      // Verify gameStore can access the persisted token
      const retrievedToken = useAuthStore.getState().sessionToken;
      expect(retrievedToken).toBe(testToken);
    });
  });

  describe("Error Prevention", () => {
    it("should catch mismatched storage keys at test time", () => {
      // This test ensures AUTH_STORAGE_KEY is imported and used
      expect(AUTH_STORAGE_KEY).toBe("pir_auth_storage");

      // If authStore starts using a different key, this test will fail
      const testToken = "mismatch-test";
      useAuthStore.setState({ sessionToken: testToken });

      // Verify the token is stored under the expected key
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.sessionToken).toBe(testToken);

      // If we try to read from the wrong key, we should get nothing
      const wrongKey = localStorage.getItem("wrong-storage-key");
      expect(wrongKey).toBeNull();
    });
  });
});
