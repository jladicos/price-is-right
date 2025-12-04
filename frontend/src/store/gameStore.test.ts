import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useGameStore, setGameStoreSessionTokenGetter } from "./gameStore";
import type { GameState } from "./gameStore";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock session token getter
let mockToken: string | null = "test-token-123";
const mockGetSessionToken = vi.fn(() => mockToken);

describe("gameStore", () => {
  const testToken = "test-token-123";
  const mockGameState: GameState = {
    workflow: {
      id: 1,
      current_segment: "section_1",
      current_segment_index: 0,
      phase_type: "bidding",
      phase_metadata: '{"type":"bidding","product_id":"car-001"}',
      created_at: "2025-11-20T12:00:00Z",
      updated_at: "2025-11-20T12:00:00Z",
    },
    contestantsRow: [
      {
        id: 1,
        player_id: 10,
        position: 1,
        game_segment: "section_1",
        status: "pending_reveal",
        added_at: "2025-11-20T12:00:00Z",
        revealed_at: null,
        created_at: "2025-11-20T12:00:00Z",
        updated_at: "2025-11-20T12:00:00Z",
        first_name: "John",
        last_name: "Doe",
        photo_filename: "john-doe.jpg",
        role: "audience",
      },
    ],
    eligibleAudienceCount: 50,
  };

  beforeEach(() => {
    // Reset store
    useGameStore.setState({
      gameState: null,
      isLoading: false,
      error: null,
      lastUpdated: 0,
    });

    // Clear mocks
    mockFetch.mockClear();
    mockGetSessionToken.mockClear();

    // Set up session token getter callback
    mockToken = testToken;
    setGameStoreSessionTokenGetter(mockGetSessionToken);
  });

  describe("fetchGameState", () => {
    it("should fetch game state successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: mockGameState,
        }),
      });

      const store = useGameStore.getState();
      await store.fetchGameState();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/game/state"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${testToken}`,
          }),
        }),
      );

      const state = useGameStore.getState();
      expect(state.gameState).toEqual(mockGameState);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(null);
      expect(state.lastUpdated).toBeGreaterThan(0);
    });

    it("should handle fetch error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({
          error: "Database error",
        }),
      });

      const store = useGameStore.getState();
      await store.fetchGameState();

      const state = useGameStore.getState();
      expect(state.gameState).toBe(null);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe("Database error");
    });

    it("should handle network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const store = useGameStore.getState();
      await store.fetchGameState();

      const state = useGameStore.getState();
      expect(state.error).toBe("Network error");
      expect(state.isLoading).toBe(false);
    });

    it("should handle missing auth token", async () => {
      mockToken = null;

      const store = useGameStore.getState();
      await store.fetchGameState();

      const state = useGameStore.getState();
      expect(state.error).toBe("Not authenticated");
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("startNewGame", () => {
    it("should start a new game successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: mockGameState,
        }),
      });

      const store = useGameStore.getState();
      await store.startNewGame();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/game/start"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
            "Content-Type": "application/json",
          }),
        }),
      );

      const state = useGameStore.getState();
      expect(state.gameState).toEqual(mockGameState);
      expect(state.error).toBe(null);
    });

    it("should handle start game error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: "Game already in progress",
        }),
      });

      const store = useGameStore.getState();

      // Should throw error
      await expect(store.startNewGame()).rejects.toThrow(
        "Game already in progress",
      );

      const state = useGameStore.getState();
      expect(state.error).toBe("Game already in progress");
      expect(state.gameState).toBe(null);
    });
  });

  describe("advancePhase", () => {
    it("should advance phase successfully", async () => {
      const advancedState = {
        ...mockGameState,
        workflow: {
          ...mockGameState.workflow,
          current_segment_index: 1,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: advancedState,
        }),
      });

      const store = useGameStore.getState();
      await store.advancePhase();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/game/advance"),
        expect.objectContaining({
          method: "POST",
        }),
      );

      const state = useGameStore.getState();
      expect(state.gameState?.workflow.current_segment_index).toBe(1);
    });

    it("should handle advance phase error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: "Cannot advance beyond finale",
        }),
      });

      const store = useGameStore.getState();

      // Should throw error
      await expect(store.advancePhase()).rejects.toThrow(
        "Cannot advance beyond finale",
      );

      const state = useGameStore.getState();
      expect(state.error).toBe("Cannot advance beyond finale");
    });
  });

  describe("revealContestant", () => {
    it("should reveal contestant and refresh state", async () => {
      // Mock reveal response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          contestant: {
            ...mockGameState.contestantsRow[0],
            status: "active",
            role: "player",
          },
        }),
      });

      // Mock refresh state response
      const updatedState = {
        ...mockGameState,
        contestantsRow: [
          {
            ...mockGameState.contestantsRow[0],
            status: "active",
            role: "player",
          },
        ],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: updatedState,
        }),
      });

      const store = useGameStore.getState();
      await store.revealContestant(1);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/game/reveal-contestant"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ contestantRowId: 1 }),
        }),
      );

      // Should also fetch updated state
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/game/state"),
        expect.any(Object),
      );

      const state = useGameStore.getState();
      expect(state.gameState?.contestantsRow[0].status).toBe("active");
    });
  });

  describe("replaceContestantRandom", () => {
    it("should replace contestant randomly and refresh state", async () => {
      // Mock replace response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          contestant: {
            ...mockGameState.contestantsRow[0],
            player_id: 20,
            first_name: "Jane",
          },
        }),
      });

      // Mock refresh state response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: mockGameState,
        }),
      });

      const store = useGameStore.getState();
      await store.replaceContestantRandom(1);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/game/replace-contestant-random"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ contestantRowId: 1 }),
        }),
      );

      // Should fetch updated state
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("manualSelectContestant", () => {
    it("should manually select contestant and refresh state", async () => {
      // Mock manual select response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          contestant: {
            ...mockGameState.contestantsRow[0],
            position: 3,
            status: "pending_reveal",
          },
        }),
      });

      // Mock refresh state response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: mockGameState,
        }),
      });

      const store = useGameStore.getState();
      await store.manualSelectContestant(25, 3, "section_1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/game/manual-select-contestant"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            playerId: 25,
            position: 3,
            segment: "section_1",
          }),
        }),
      );
    });

    it("should handle errors when manual selection fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: "Position already occupied",
        }),
      });

      const store = useGameStore.getState();

      // Should throw error
      await expect(
        store.manualSelectContestant(25, 1, "section_1"),
      ).rejects.toThrow("Position already occupied");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const state = useGameStore.getState();
      expect(state.error).toBe("Position already occupied");
    });

    it("should set loading state during manual selection", async () => {
      let loadingDuringCall = false;

      mockFetch.mockImplementationOnce(async () => {
        loadingDuringCall = useGameStore.getState().isLoading;
        return {
          ok: true,
          json: async () => ({
            success: true,
            contestant: mockGameState.contestantsRow[0],
          }),
        };
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: mockGameState,
        }),
      });

      const store = useGameStore.getState();
      await store.manualSelectContestant(25, 2, "section_1");

      expect(loadingDuringCall).toBe(true);
      expect(store.isLoading).toBe(false);
    });
  });

  describe("replaceContestantManual", () => {
    it("should replace contestant manually and refresh state", async () => {
      // Mock replace response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          contestant: mockGameState.contestantsRow[0],
        }),
      });

      // Mock refresh state response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: mockGameState,
        }),
      });

      const store = useGameStore.getState();
      await store.replaceContestantManual(1, 25);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/game/replace-contestant-manual"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ contestantRowId: 1, newPlayerId: 25 }),
        }),
      );
    });
  });

  describe("refreshContestantsRow", () => {
    it("should refresh contestants row and fetch state", async () => {
      // Mock refresh response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          contestants: mockGameState.contestantsRow,
        }),
      });

      // Mock fetch state response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: mockGameState,
        }),
      });

      const store = useGameStore.getState();
      await store.refreshContestantsRow("section_1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/game/refresh-contestants-row"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ segment: "section_1" }),
        }),
      );
    });
  });

  describe("overridePhase", () => {
    it("should override phase successfully", async () => {
      const overriddenState = {
        ...mockGameState,
        workflow: {
          ...mockGameState.workflow,
          current_segment: "section_2",
          current_segment_index: 2,
          phase_type: "wheel",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: overriddenState,
        }),
      });

      const store = useGameStore.getState();
      await store.overridePhase("section_2", 2, "wheel", { type: "wheel" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/game/override-phase"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            segment: "section_2",
            segmentIndex: 2,
            phaseType: "wheel",
            phaseMetadata: { type: "wheel" },
          }),
        }),
      );

      const state = useGameStore.getState();
      expect(state.gameState?.workflow.current_segment).toBe("section_2");
      expect(state.gameState?.workflow.phase_type).toBe("wheel");
    });
  });

  describe("clearError", () => {
    it("should clear error message", () => {
      useGameStore.setState({ error: "Some error" });

      const store = useGameStore.getState();
      store.clearError();

      const state = useGameStore.getState();
      expect(state.error).toBe(null);
    });
  });

  describe("loading states", () => {
    it("should set loading true while fetching", async () => {
      let resolveFetch: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      mockFetch.mockReturnValueOnce(fetchPromise);

      const store = useGameStore.getState();
      const fetchPromiseResult = store.fetchGameState();

      // Check loading state immediately
      expect(useGameStore.getState().isLoading).toBe(true);

      // Resolve fetch
      resolveFetch!({
        ok: true,
        json: async () => ({ success: true, state: mockGameState }),
      });

      await fetchPromiseResult;

      // Loading should be false after completion
      expect(useGameStore.getState().isLoading).toBe(false);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle HTTP error without error field in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({}), // No error field
      });

      const store = useGameStore.getState();
      await store.fetchGameState();

      const state = useGameStore.getState();
      expect(state.error).toBe("HTTP 500: Internal Server Error");
    });

    it("should handle JSON parsing error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const store = useGameStore.getState();
      await store.fetchGameState();

      const state = useGameStore.getState();
      expect(state.error).toBe("Invalid JSON");
    });

    it("should handle callback returning null token", async () => {
      mockToken = null;

      const store = useGameStore.getState();
      await store.fetchGameState();

      const state = useGameStore.getState();
      expect(state.error).toBe("Not authenticated");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle callback returning empty string token", async () => {
      mockToken = "";

      const store = useGameStore.getState();
      await store.fetchGameState();

      const state = useGameStore.getState();
      expect(state.error).toBe("Not authenticated");
    });

    it("should not call fetchGameState when revealContestant fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({
          error: "Contestant not found",
        }),
      });

      const store = useGameStore.getState();

      // Should throw error
      await expect(store.revealContestant(999)).rejects.toThrow(
        "Contestant not found",
      );

      // Should only have called reveal, NOT fetchGameState
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/game/reveal-contestant"),
        expect.any(Object),
      );

      const state = useGameStore.getState();
      expect(state.error).toBe("Contestant not found");
    });

    it("should not call fetchGameState when replaceContestantRandom fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: "No eligible audience members",
        }),
      });

      const store = useGameStore.getState();

      // Should throw error
      await expect(store.replaceContestantRandom(1)).rejects.toThrow(
        "No eligible audience members",
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const state = useGameStore.getState();
      expect(state.error).toBe("No eligible audience members");
    });

    it("should not call fetchGameState when replaceContestantManual fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: "Player not active",
        }),
      });

      const store = useGameStore.getState();

      // Should throw error
      await expect(store.replaceContestantManual(1, 999)).rejects.toThrow(
        "Player not active",
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const state = useGameStore.getState();
      expect(state.error).toBe("Player not active");
    });

    it("should not call fetchGameState when refreshContestantsRow fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Server Error",
        json: async () => ({
          error: "Database error",
        }),
      });

      const store = useGameStore.getState();

      // Should throw error
      await expect(store.refreshContestantsRow("section_1")).rejects.toThrow(
        "Database error",
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const state = useGameStore.getState();
      expect(state.error).toBe("Database error");
    });

    it("should construct correct full URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: mockGameState,
        }),
      });

      const store = useGameStore.getState();
      await store.fetchGameState();

      // Verify the URL contains the game state endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/game/state"),
        expect.any(Object),
      );
    });

    it("should include Content-Type header in POST requests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: mockGameState,
        }),
      });

      const store = useGameStore.getState();
      await store.startNewGame();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should clear error before making a new request", async () => {
      // Set initial error
      useGameStore.setState({ error: "Previous error" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: mockGameState,
        }),
      });

      const store = useGameStore.getState();
      await store.fetchGameState();

      const state = useGameStore.getState();
      expect(state.error).toBe(null);
    });

    it("should preserve gameState when fetch fails", async () => {
      // Set initial state
      useGameStore.setState({ gameState: mockGameState });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Server Error",
        json: async () => ({
          error: "Server error",
        }),
      });

      const store = useGameStore.getState();
      await store.fetchGameState();

      const state = useGameStore.getState();
      // gameState should still be there
      expect(state.gameState).toEqual(mockGameState);
      expect(state.error).toBe("Server error");
    });
  });

  // Wheel Animation Timing Tests
  describe("Wheel Animation Timing", () => {
    const mockWheelState: GameState = {
      workflow: {
        id: 1,
        current_segment: "section_1",
        current_segment_index: 0,
        phase_type: "wheel",
        phase_metadata: '{"type":"wheel"}',
        created_at: "2025-11-20T12:00:00Z",
        updated_at: "2025-11-20T12:00:00Z",
      },
      contestantsRow: [],
      eligibleAudienceCount: 50,
      wheelSpins: [],
      currentSpinner: 10,
      currentWheelPosition: 15,
      spinoffNumber: 0,
      playerTotals: [],
      wheelWinner: null,
      needsSpinoff: false,
    };

    beforeEach(() => {
      vi.useFakeTimers();
      useGameStore.setState({
        gameState: mockWheelState,
        isLoading: false,
        error: null,
        lastUpdated: 0,
        isWheelAnimating: false,
        pendingSpinTarget: null,
      });
    });

    afterEach(() => {
      // Run any pending timers and clear them before switching to real timers
      vi.runOnlyPendingTimers();
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it("should set pendingSpinTarget immediately after spin API returns", async () => {
      // Mock spin response - player spins and gets $0.75
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          spin: { result: 0.75 },
          total: 0.75,
          eliminated: false,
        }),
      });

      // Mock fetchGameState response (will be called after timeout)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: {
            ...mockWheelState,
            playerTotals: [
              {
                player_id: 10,
                first_name: "John",
                last_name: "Doe",
                photo_filename: "john.jpg",
                position: 1,
                total: 0.75,
                eliminated: false,
              },
            ],
          },
        }),
      });

      const store = useGameStore.getState();
      // Start the spin (don't await - it won't complete until timeout fires)
      const spinPromise = store.spinWheel(10);

      // Flush microtasks (required with fake timers)
      await vi.advanceTimersByTimeAsync(0);

      // pendingSpinTarget should be set to 75 (cents)
      const stateAfterSpin = useGameStore.getState();
      expect(stateAfterSpin.pendingSpinTarget).toBe(75);
      expect(stateAfterSpin.isWheelAnimating).toBe(true);

      // Clean up: advance timers to complete the spin
      await vi.advanceTimersByTimeAsync(3000);
      await spinPromise;
    });

    it("should keep isWheelAnimating true for 3 seconds", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          spin: { result: 0.5 },
          total: 0.5,
          eliminated: false,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: mockWheelState,
        }),
      });

      const store = useGameStore.getState();
      const spinPromise = store.spinWheel(10);

      // Let fetch resolve
      await Promise.resolve();
      await Promise.resolve();

      // Still animating after 1 second
      await vi.advanceTimersByTimeAsync(1000);
      expect(useGameStore.getState().isWheelAnimating).toBe(true);

      // Still animating after 2 seconds total
      await vi.advanceTimersByTimeAsync(1000);
      expect(useGameStore.getState().isWheelAnimating).toBe(true);

      // Animation should stop after 3 seconds
      await vi.advanceTimersByTimeAsync(1000);
      expect(useGameStore.getState().isWheelAnimating).toBe(false);

      await spinPromise;
    });

    it("should NOT call fetchGameState immediately after spin API returns", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          spin: { result: 0.35 },
          total: 0.35,
          eliminated: false,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: mockWheelState,
        }),
      });

      const store = useGameStore.getState();
      const spinPromise = store.spinWheel(10);

      // Let spin API resolve
      await Promise.resolve();
      await Promise.resolve();

      // Only the spin API should have been called
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/game/wheel-spin"),
        expect.any(Object),
      );

      // Clean up
      await vi.advanceTimersByTimeAsync(3000);
      await spinPromise;
    });

    it("should call fetchGameState only after 3 seconds", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          spin: { result: 0.85 },
          total: 0.85,
          eliminated: false,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: {
            ...mockWheelState,
            wheelWinner: 10,
          },
        }),
      });

      const store = useGameStore.getState();
      const spinPromise = store.spinWheel(10);

      // Let spin API resolve
      await Promise.resolve();
      await Promise.resolve();

      // Still only 1 call (spin) after 2 seconds
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // After 3 seconds, fetchGameState should be called
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining("/game/state"),
        expect.any(Object),
      );

      await spinPromise;
    });

    it("should update gameState with winner only after animation completes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          spin: { result: 1.0 },
          total: 1.0,
          eliminated: false,
        }),
      });

      // Response with winner - this should only be reflected after animation
      const stateWithWinner = {
        ...mockWheelState,
        wheelWinner: 10, // Winner is determined
        playerTotals: [
          {
            player_id: 10,
            first_name: "John",
            last_name: "Doe",
            photo_filename: "john.jpg",
            position: 1,
            total: 1.0,
            eliminated: false,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: stateWithWinner,
        }),
      });

      const store = useGameStore.getState();
      const spinPromise = store.spinWheel(10);

      // Let spin API resolve
      await Promise.resolve();
      await Promise.resolve();

      // Winner should NOT be shown yet (animation still running)
      expect(useGameStore.getState().gameState?.wheelWinner).toBe(null);

      // Advance past animation time
      await vi.advanceTimersByTimeAsync(3000);

      // NOW winner should be visible
      expect(useGameStore.getState().gameState?.wheelWinner).toBe(10);

      await spinPromise;
    });

    it("should clear pendingSpinTarget after animation completes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          spin: { result: 0.6 },
          total: 0.6,
          eliminated: false,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: mockWheelState,
        }),
      });

      const store = useGameStore.getState();
      const spinPromise = store.spinWheel(10);

      // Flush microtasks (required with fake timers)
      await vi.advanceTimersByTimeAsync(0);

      // pendingSpinTarget should be set during animation
      expect(useGameStore.getState().pendingSpinTarget).toBe(60);

      // After animation completes
      await vi.advanceTimersByTimeAsync(3000);

      // pendingSpinTarget should be cleared
      expect(useGameStore.getState().pendingSpinTarget).toBe(null);

      await spinPromise;
    });

    it("should not update tie/elimination state until after animation", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          spin: { result: 0.9 },
          total: 0.9,
          eliminated: false,
        }),
      });

      // Response with tie situation
      const stateWithTie = {
        ...mockWheelState,
        needsSpinoff: true,
        playerTotals: [
          {
            player_id: 10,
            first_name: "John",
            last_name: "Doe",
            photo_filename: "john.jpg",
            position: 1,
            total: 0.9,
            eliminated: false,
          },
          {
            player_id: 11,
            first_name: "Jane",
            last_name: "Doe",
            photo_filename: "jane.jpg",
            position: 2,
            total: 0.9,
            eliminated: false,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: stateWithTie,
        }),
      });

      const store = useGameStore.getState();
      const spinPromise = store.spinWheel(10);

      // Let spin API resolve
      await Promise.resolve();
      await Promise.resolve();

      // Tie should NOT be visible yet
      expect(useGameStore.getState().gameState?.needsSpinoff).toBe(false);

      // After animation completes
      await vi.advanceTimersByTimeAsync(3000);

      // NOW tie should be visible
      expect(useGameStore.getState().gameState?.needsSpinoff).toBe(true);

      await spinPromise;
    });

    it("should handle spin API error without leaving animation in bad state", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Server Error",
        json: async () => ({
          error: "Spin failed",
        }),
      });

      const store = useGameStore.getState();

      await expect(store.spinWheel(10)).rejects.toThrow("Spin failed");

      // Animation states should be reset
      const state = useGameStore.getState();
      expect(state.isWheelAnimating).toBe(false);
      expect(state.pendingSpinTarget).toBe(null);
      expect(state.isLoading).toBe(false);
    });

    it("should convert spin result to cents correctly", async () => {
      // Test various spin values
      const testCases = [
        { input: 0.05, expected: 5 },
        { input: 0.1, expected: 10 },
        { input: 0.25, expected: 25 },
        { input: 0.55, expected: 55 },
        { input: 1.0, expected: 100 },
      ];

      for (const { input, expected } of testCases) {
        // Reset store state
        useGameStore.setState({
          gameState: mockWheelState,
          isLoading: false,
          error: null,
          isWheelAnimating: false,
          pendingSpinTarget: null,
        });
        mockFetch.mockClear();

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            spin: { result: input },
            total: input,
            eliminated: false,
          }),
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            state: mockWheelState,
          }),
        });

        const store = useGameStore.getState();
        const spinPromise = store.spinWheel(10);

        // Flush microtasks (required with fake timers)
        await vi.advanceTimersByTimeAsync(0);

        expect(useGameStore.getState().pendingSpinTarget).toBe(expected);

        // Clean up timer
        await vi.advanceTimersByTimeAsync(3000);
        await spinPromise;
      }
    });

    it("should show elimination only after animation completes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          spin: { result: 0.5 },
          total: 1.25, // Over 1.00, eliminated
          eliminated: true,
        }),
      });

      // Response with eliminated player
      const stateWithElimination = {
        ...mockWheelState,
        currentSpinner: 11, // Moved to next player
        playerTotals: [
          {
            player_id: 10,
            first_name: "John",
            last_name: "Doe",
            photo_filename: "john.jpg",
            position: 1,
            total: 1.25,
            eliminated: true, // Eliminated
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          state: stateWithElimination,
        }),
      });

      const store = useGameStore.getState();
      const spinPromise = store.spinWheel(10);

      // Let spin API resolve
      await Promise.resolve();
      await Promise.resolve();

      // Elimination should NOT be visible yet
      expect(useGameStore.getState().gameState?.playerTotals).toEqual([]);

      // After animation completes
      await vi.advanceTimersByTimeAsync(3000);

      // NOW elimination should be visible
      expect(
        useGameStore.getState().gameState?.playerTotals?.[0]?.eliminated,
      ).toBe(true);

      await spinPromise;
    });
  });

  // Showcase Actions Tests
  describe("Showcase Actions", () => {
    // Clear mocks before each test in this section to prevent interference
    beforeEach(() => {
      mockFetch.mockReset();
    });

    const mockShowcaseState = {
      state: {
        finale_player1_id: 1,
        finale_player2_id: 2,
        finale_player1_product_value: 15000,
        finale_player2_product_value: 12000,
        finale_player1_showcase: 1,
        finale_player2_showcase: 2,
        finale_retry_number: 0,
        finale_player1_passed: 0,
        finale_winner_id: null,
        finale_bonus_won: 0,
      },
      showcase1: [
        {
          id: "product-1",
          product: { name: "Car", price: 25000, images: ["car.jpg"] },
        },
      ],
      showcase2: [
        {
          id: "product-2",
          product: { name: "Boat", price: 30000, images: ["boat.jpg"] },
        },
      ],
      showcase1Value: 25000,
      showcase2Value: 30000,
      bonusThreshold: 250,
    };

    const mockShowcaseBids = [
      {
        id: 1,
        game_id: 1,
        player_id: 1,
        showcase_number: 1,
        bid_amount: 24000,
        retry_number: 0,
        locked: 1,
        created_at: "2025-12-01T12:00:00Z",
        updated_at: "2025-12-01T12:00:00Z",
        first_name: "John",
        last_name: "Doe",
        photo_filename: "john-doe.jpg",
      },
    ];

    describe("fetchShowcaseState", () => {
      beforeEach(() => {
        // Set up initial game state for showcase tests
        useGameStore.setState({
          gameState: mockGameState,
          isLoading: false,
          error: null,
        });
      });

      it("should fetch showcase state and bids successfully", async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              success: true,
              ...mockShowcaseState,
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              success: true,
              bids: mockShowcaseBids,
              retryNumber: 0,
            }),
          });

        const store = useGameStore.getState();
        await store.fetchShowcaseState();

        // Verify both API calls were made
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/showcase/state"),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: `Bearer ${testToken}`,
            }),
          }),
        );

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/showcase/bids"),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: `Bearer ${testToken}`,
            }),
          }),
        );

        // Verify state was updated correctly
        const state = useGameStore.getState();
        expect(state.gameState?.showcaseState).toEqual(mockShowcaseState);
        expect(state.gameState?.showcaseBids).toEqual(mockShowcaseBids);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe(null);
        expect(state.lastUpdated).toBeGreaterThan(0);
      });

      it("should handle showcase state fetch error", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({
            error: "Showcase not initialized",
          }),
        });

        const store = useGameStore.getState();
        await store.fetchShowcaseState();

        const state = useGameStore.getState();
        expect(state.error).toBe("Showcase not initialized");
        expect(state.isLoading).toBe(false);
      });

      it("should handle network error", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const store = useGameStore.getState();
        await store.fetchShowcaseState();

        const state = useGameStore.getState();
        expect(state.error).toBe("Network error");
        expect(state.isLoading).toBe(false);
      });

      it("should handle missing auth token", async () => {
        mockToken = null;

        const store = useGameStore.getState();
        await store.fetchShowcaseState();

        const state = useGameStore.getState();
        expect(state.error).toBe("Not authenticated");
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("should handle bids fetch error after successful state fetch", async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              success: true,
              ...mockShowcaseState,
            }),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
            json: async () => ({
              error: "Failed to fetch bids",
            }),
          });

        const store = useGameStore.getState();
        await store.fetchShowcaseState();

        const state = useGameStore.getState();
        // State should be updated but bids might not be
        expect(state.gameState?.showcaseState).toEqual(mockShowcaseState);
        expect(state.isLoading).toBe(false);
      });
    });

    describe("initializeShowcase", () => {
      beforeEach(() => {
        useGameStore.setState({
          gameState: mockGameState,
          isLoading: false,
          error: null,
        });
      });

      it("should initialize showcase successfully", async () => {
        // Mock initialize API call
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              success: true,
              state: mockShowcaseState,
            }),
          })
          // Mock fetchShowcaseState calls (state + bids)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              success: true,
              ...mockShowcaseState,
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              success: true,
              bids: [],
              retryNumber: 0,
            }),
          });

        const store = useGameStore.getState();
        await store.initializeShowcase();

        // Verify API calls
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/showcase/initialize"),
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              Authorization: `Bearer ${testToken}`,
              "Content-Type": "application/json",
            }),
          }),
        );

        // Verify state was updated
        const state = useGameStore.getState();
        expect(state.gameState?.showcaseState).toEqual(mockShowcaseState);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe(null);
      });

      it("should handle initialize error", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({
            error: "Finalists not found",
          }),
        });

        const store = useGameStore.getState();

        await expect(store.initializeShowcase()).rejects.toThrow(
          "Finalists not found",
        );

        const state = useGameStore.getState();
        expect(state.error).toBe("Finalists not found");
        expect(state.isLoading).toBe(false);
      });

      it("should handle network error", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network failure"));

        const store = useGameStore.getState();

        await expect(store.initializeShowcase()).rejects.toThrow(
          "Network failure",
        );

        const state = useGameStore.getState();
        expect(state.error).toBe("Network failure");
        expect(state.isLoading).toBe(false);
      });

      it("should handle missing auth token", async () => {
        mockToken = null;

        const store = useGameStore.getState();

        await expect(store.initializeShowcase()).rejects.toThrow(
          "Not authenticated",
        );

        const state = useGameStore.getState();
        expect(state.error).toBe("Not authenticated");
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });

    describe("submitPass", () => {
      beforeEach(() => {
        useGameStore.setState({
          gameState: mockGameState,
          isLoading: false,
          error: null,
        });
      });

      it("should submit pass successfully", async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({}),
          })
          // Mock fetchShowcaseState calls
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              ...mockShowcaseState,
              state: {
                ...mockShowcaseState.state,
                finale_player1_passed: 1, // Player1 passed
                finale_player1_showcase: 2, // Showcases swapped
                finale_player2_showcase: 1,
              },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              bids: [],
              retryNumber: 0,
            }),
          });

        const store = useGameStore.getState();
        await store.submitPass();

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/showcase/pass"),
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              Authorization: `Bearer ${testToken}`,
            }),
          }),
        );

        const state = useGameStore.getState();
        expect(
          state.gameState?.showcaseState?.state.finale_player1_passed,
        ).toBe(1);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe(null);
      });

      it("should handle pass error", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({
            error: "Cannot pass at this time",
          }),
        });

        const store = useGameStore.getState();

        await expect(store.submitPass()).rejects.toThrow(
          "Cannot pass at this time",
        );

        const state = useGameStore.getState();
        expect(state.error).toBe("Cannot pass at this time");
        expect(state.isLoading).toBe(false);
      });

      it("should handle network error", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network failure"));

        const store = useGameStore.getState();

        await expect(store.submitPass()).rejects.toThrow("Network failure");

        const state = useGameStore.getState();
        expect(state.error).toBe("Network failure");
      });
    });

    describe("submitBidDecision", () => {
      beforeEach(() => {
        useGameStore.setState({
          gameState: mockGameState,
          isLoading: false,
          error: null,
        });
      });

      it("should submit bid decision successfully", async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({}),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              ...mockShowcaseState,
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              bids: [],
              retryNumber: 0,
            }),
          });

        const store = useGameStore.getState();
        await store.submitBidDecision();

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/showcase/bid-decision"),
          expect.objectContaining({
            method: "POST",
          }),
        );

        const state = useGameStore.getState();
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe(null);
      });

      it("should handle bid decision error", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({
            error: "Invalid state for bid decision",
          }),
        });

        const store = useGameStore.getState();

        await expect(store.submitBidDecision()).rejects.toThrow(
          "Invalid state for bid decision",
        );

        const state = useGameStore.getState();
        expect(state.error).toBe("Invalid state for bid decision");
      });
    });

    describe("submitShowcaseBid", () => {
      beforeEach(() => {
        useGameStore.setState({
          gameState: mockGameState,
          isLoading: false,
          error: null,
        });
      });

      it("should submit showcase bid as player", async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({}),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              ...mockShowcaseState,
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              bids: mockShowcaseBids,
              retryNumber: 0,
            }),
          });

        const store = useGameStore.getState();
        await store.submitShowcaseBid(24000);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/showcase/submit-bid"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ bid_amount: 24000 }),
          }),
        );

        const state = useGameStore.getState();
        expect(state.gameState?.showcaseBids).toEqual(mockShowcaseBids);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe(null);
      });

      it("should submit showcase bid as host for another player", async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({}),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              ...mockShowcaseState,
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              bids: mockShowcaseBids,
              retryNumber: 0,
            }),
          });

        const store = useGameStore.getState();
        await store.submitShowcaseBid(24000, 2);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/showcase/submit-bid"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ bid_amount: 24000, player_id: 2 }),
          }),
        );

        const state = useGameStore.getState();
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe(null);
      });

      it("should handle submit bid error", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({
            error: "Bid is locked",
          }),
        });

        const store = useGameStore.getState();

        await expect(store.submitShowcaseBid(24000)).rejects.toThrow(
          "Bid is locked",
        );

        const state = useGameStore.getState();
        expect(state.error).toBe("Bid is locked");
      });

      it("should handle network error", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Connection failed"));

        const store = useGameStore.getState();

        await expect(store.submitShowcaseBid(24000)).rejects.toThrow(
          "Connection failed",
        );
      });
    });

    describe("unlockShowcaseBid", () => {
      beforeEach(() => {
        useGameStore.setState({
          gameState: mockGameState,
          isLoading: false,
          error: null,
        });
      });

      it("should unlock showcase bid successfully", async () => {
        const unlockedBids = [
          {
            ...mockShowcaseBids[0],
            locked: 0, // Unlocked
          },
        ];

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({}),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              ...mockShowcaseState,
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              bids: unlockedBids,
              retryNumber: 0,
            }),
          });

        const store = useGameStore.getState();
        await store.unlockShowcaseBid(1);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/showcase/unlock-bid"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ player_id: 1 }),
          }),
        );

        const state = useGameStore.getState();
        expect(state.gameState?.showcaseBids?.[0].locked).toBe(0);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe(null);
      });

      it("should handle unlock error", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({
            error: "No bid found for player",
          }),
        });

        const store = useGameStore.getState();

        await expect(store.unlockShowcaseBid(1)).rejects.toThrow(
          "No bid found for player",
        );
      });
    });

    describe("updateShowcaseBid", () => {
      beforeEach(() => {
        useGameStore.setState({
          gameState: mockGameState,
          isLoading: false,
          error: null,
        });
      });

      it("should update showcase bid successfully", async () => {
        const updatedBids = [
          {
            ...mockShowcaseBids[0],
            bid_amount: 25000, // Updated amount
          },
        ];

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({}),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              ...mockShowcaseState,
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              bids: updatedBids,
              retryNumber: 0,
            }),
          });

        const store = useGameStore.getState();
        await store.updateShowcaseBid(1, 25000);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/showcase/update-bid"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ player_id: 1, bid_amount: 25000 }),
          }),
        );

        const state = useGameStore.getState();
        expect(state.gameState?.showcaseBids?.[0].bid_amount).toBe(25000);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe(null);
      });

      it("should handle update error", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({
            error: "Invalid bid amount",
          }),
        });

        const store = useGameStore.getState();

        await expect(store.updateShowcaseBid(1, -100)).rejects.toThrow(
          "Invalid bid amount",
        );
      });
    });

    describe("revealShowcaseWinner", () => {
      beforeEach(() => {
        useGameStore.setState({
          gameState: mockGameState,
          isLoading: false,
          error: null,
        });
      });

      it("should reveal winner successfully", async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              winnerId: 1,
              bonusWon: true,
              retryNeeded: false,
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              ...mockShowcaseState,
              state: {
                ...mockShowcaseState.state,
                finale_winner_id: 1,
                finale_bonus_won: 1,
              },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              bids: mockShowcaseBids,
              retryNumber: 0,
            }),
          });

        const store = useGameStore.getState();
        const result = await store.revealShowcaseWinner();

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/showcase/reveal-winner"),
          expect.objectContaining({
            method: "POST",
          }),
        );

        expect(result.winnerId).toBe(1);
        expect(result.bonusWon).toBe(true);
        expect(result.retryNeeded).toBe(false);

        const state = useGameStore.getState();
        expect(state.gameState?.showcaseState?.state.finale_winner_id).toBe(1);
        expect(state.gameState?.showcaseState?.state.finale_bonus_won).toBe(1);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe(null);
      });

      it("should handle retry needed scenario", async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              winnerId: 0,
              bonusWon: false,
              retryNeeded: true,
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              ...mockShowcaseState,
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              bids: mockShowcaseBids,
              retryNumber: 0,
            }),
          });

        const store = useGameStore.getState();
        const result = await store.revealShowcaseWinner();

        expect(result.retryNeeded).toBe(true);
        expect(result.winnerId).toBe(0);

        const state = useGameStore.getState();
        expect(state.isLoading).toBe(false);
      });

      it("should handle reveal winner error", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({
            error: "Both players must have bids",
          }),
        });

        const store = useGameStore.getState();

        await expect(store.revealShowcaseWinner()).rejects.toThrow(
          "Both players must have bids",
        );
      });

      it("should handle network error", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

        const store = useGameStore.getState();

        await expect(store.revealShowcaseWinner()).rejects.toThrow(
          "Network timeout",
        );
      });
    });

    describe("retryShowcase", () => {
      beforeEach(() => {
        useGameStore.setState({
          gameState: mockGameState,
          isLoading: false,
          error: null,
        });
      });

      it("should initiate retry successfully", async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              retryNumber: 1,
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              ...mockShowcaseState,
              state: {
                ...mockShowcaseState.state,
                finale_retry_number: 1,
                finale_winner_id: null, // Reset winner
                finale_bonus_won: 0,
              },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              bids: [], // Bids reset for retry
              retryNumber: 1,
            }),
          });

        const store = useGameStore.getState();
        await store.retryShowcase();

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/showcase/retry"),
          expect.objectContaining({
            method: "POST",
          }),
        );

        const state = useGameStore.getState();
        expect(state.gameState?.showcaseState?.state.finale_retry_number).toBe(
          1,
        );
        expect(state.gameState?.showcaseBids).toEqual([]);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe(null);
      });

      it("should handle retry error", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({
            error: "Retry not needed",
          }),
        });

        const store = useGameStore.getState();

        await expect(store.retryShowcase()).rejects.toThrow("Retry not needed");
      });
    });
  });
});
