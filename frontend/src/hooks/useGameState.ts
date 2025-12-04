import { useEffect, useRef, useCallback } from "react";
import { useGameStore } from "../store/gameStore";

interface UseGameStateOptions {
  /**
   * Polling interval in milliseconds
   * @default 2000 (2 seconds)
   */
  pollInterval?: number;

  /**
   * Whether to start polling immediately
   * @default true
   */
  enabled?: boolean;
}

/**
 * Hook to automatically poll game state at regular intervals
 *
 * @example
 * ```tsx
 * function GamePage() {
 *   const { gameState, isLoading, error } = useGameState();
 *
 *   if (isLoading && !gameState) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *
 *   return <div>Current phase: {gameState?.workflow.phase_type}</div>;
 * }
 * ```
 */
export function useGameState(options: UseGameStateOptions = {}) {
  const { pollInterval = 2000, enabled = true } = options;

  const gameState = useGameStore((state) => state.gameState);
  const isLoading = useGameStore((state) => state.isLoading);
  const error = useGameStore((state) => state.error);
  const fetchGameState = useGameStore((state) => state.fetchGameState);
  const clearError = useGameStore((state) => state.clearError);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual refresh function
  const refresh = useCallback(() => {
    fetchGameState();
  }, [fetchGameState]);

  // Start polling
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Fetch immediately on mount
    fetchGameState();

    // Set up polling interval
    // Skip polling during wheel animation to prevent UI updates before animation completes
    intervalRef.current = setInterval(() => {
      // Check current animation state from store (not from closure)
      const currentlyAnimating = useGameStore.getState().isWheelAnimating;
      if (!currentlyAnimating) {
        fetchGameState();
      }
    }, pollInterval);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pollInterval]);

  return {
    gameState,
    isLoading,
    error,
    refresh,
    clearError,
  };
}
