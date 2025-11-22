import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameState } from './useGameState';
import { useGameStore } from '../store/gameStore';
import type { GameState } from '../store/gameStore';

// Mock timers
vi.useFakeTimers();

const mockGameState: GameState = {
  workflow: {
    id: 1,
    current_segment: 'section_1',
    current_segment_index: 0,
    phase_type: 'bidding',
    phase_metadata: '{"type":"bidding","product_id":"car-001"}',
    created_at: '2025-11-20T12:00:00Z',
    updated_at: '2025-11-20T12:00:00Z',
  },
  contestantsRow: [],
  eligibleAudienceCount: 50,
};

describe('useGameState', () => {
  let mockFetchGameState: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset store
    useGameStore.setState({
      gameState: null,
      isLoading: false,
      error: null,
      lastUpdated: 0,
    });

    // Mock fetchGameState
    mockFetchGameState = vi.fn().mockResolvedValue(undefined);
    useGameStore.setState({
      fetchGameState: mockFetchGameState,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should fetch game state on mount', () => {
    renderHook(() => useGameState());

    expect(mockFetchGameState).toHaveBeenCalledTimes(1);
  });

  it('should poll game state at specified interval', async () => {
    renderHook(() => useGameState({ pollInterval: 2000 }));

    expect(mockFetchGameState).toHaveBeenCalledTimes(1);

    // Advance time by 2 seconds
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockFetchGameState).toHaveBeenCalledTimes(2);

    // Advance another 2 seconds
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockFetchGameState).toHaveBeenCalledTimes(3);
  });

  it('should use custom poll interval', async () => {
    renderHook(() => useGameState({ pollInterval: 5000 }));

    expect(mockFetchGameState).toHaveBeenCalledTimes(1);

    // Should not poll after 2 seconds
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockFetchGameState).toHaveBeenCalledTimes(1);

    // Should poll after 5 seconds
    await vi.advanceTimersByTimeAsync(3000);
    expect(mockFetchGameState).toHaveBeenCalledTimes(2);
  });

  it('should stop polling when unmounted', async () => {
    const { unmount } = renderHook(() => useGameState({ pollInterval: 2000 }));

    expect(mockFetchGameState).toHaveBeenCalledTimes(1);

    // Unmount the hook
    unmount();

    // Advance time - should not poll anymore
    vi.advanceTimersByTime(2000);
    await vi.runAllTimersAsync();
    expect(mockFetchGameState).toHaveBeenCalledTimes(1);
  });

  it('should not poll when disabled', () => {
    renderHook(() => useGameState({ enabled: false }));

    expect(mockFetchGameState).not.toHaveBeenCalled();

    // Advance time - should still not poll
    vi.advanceTimersByTime(2000);
    expect(mockFetchGameState).not.toHaveBeenCalled();
  });

  it('should return game state from store', () => {
    useGameStore.setState({ gameState: mockGameState });

    const { result } = renderHook(() => useGameState({ enabled: false }));

    expect(result.current.gameState).toEqual(mockGameState);
  });

  it('should return loading state from store', () => {
    useGameStore.setState({ isLoading: true });

    const { result } = renderHook(() => useGameState({ enabled: false }));

    expect(result.current.isLoading).toBe(true);
  });

  it('should return error from store', () => {
    useGameStore.setState({ error: 'Test error' });

    const { result } = renderHook(() => useGameState({ enabled: false }));

    expect(result.current.error).toBe('Test error');
  });

  it('should provide refresh function', () => {
    const { result } = renderHook(() => useGameState({ enabled: false }));

    expect(typeof result.current.refresh).toBe('function');

    result.current.refresh();

    expect(mockFetchGameState).toHaveBeenCalledTimes(1);
  });

  it('should provide clearError function', () => {
    const mockClearError = vi.fn();
    useGameStore.setState({
      error: 'Test error',
      clearError: mockClearError,
    });

    const { result } = renderHook(() => useGameState({ enabled: false }));

    result.current.clearError();

    expect(mockClearError).toHaveBeenCalledTimes(1);
  });

  it('should restart polling when interval changes', async () => {
    const { rerender } = renderHook(({ interval }) => useGameState({ pollInterval: interval }), {
      initialProps: { interval: 2000 },
    });

    expect(mockFetchGameState).toHaveBeenCalledTimes(1);

    // Change interval
    rerender({ interval: 3000 });

    // Should have restarted (called again on mount)
    expect(mockFetchGameState).toHaveBeenCalledTimes(2);

    // Old interval (2s) should not trigger
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockFetchGameState).toHaveBeenCalledTimes(2);

    // New interval (3s) should trigger
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetchGameState).toHaveBeenCalledTimes(3);
  });

  it('should handle enabled toggle', async () => {
    const { rerender } = renderHook(
      ({ enabled }) => useGameState({ enabled, pollInterval: 2000 }),
      {
        initialProps: { enabled: true },
      },
    );

    expect(mockFetchGameState).toHaveBeenCalledTimes(1);

    // Disable
    rerender({ enabled: false });

    // Advance time - should not poll
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockFetchGameState).toHaveBeenCalledTimes(1);

    // Re-enable
    rerender({ enabled: true });

    // Should start polling again
    expect(mockFetchGameState).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2000);
    expect(mockFetchGameState).toHaveBeenCalledTimes(3);
  });

  it('should use default poll interval of 2 seconds', async () => {
    renderHook(() => useGameState());

    expect(mockFetchGameState).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(mockFetchGameState).toHaveBeenCalledTimes(2);
  });

  describe('Edge Cases and Error Handling', () => {
    it('should continue polling even if fetchGameState fails', async () => {
      mockFetchGameState.mockRejectedValue(new Error('Network error'));

      renderHook(() => useGameState({ pollInterval: 2000 }));

      expect(mockFetchGameState).toHaveBeenCalledTimes(1);

      // Advance time - should still poll despite error
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockFetchGameState).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(2000);
      expect(mockFetchGameState).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple mount/unmount cycles without memory leaks', async () => {
      const { unmount: unmount1 } = renderHook(() => useGameState({ pollInterval: 2000 }));
      expect(mockFetchGameState).toHaveBeenCalledTimes(1);
      unmount1();

      const { unmount: unmount2 } = renderHook(() => useGameState({ pollInterval: 2000 }));
      expect(mockFetchGameState).toHaveBeenCalledTimes(2);
      unmount2();

      const { unmount: unmount3 } = renderHook(() => useGameState({ pollInterval: 2000 }));
      expect(mockFetchGameState).toHaveBeenCalledTimes(3);
      unmount3();

      // Advance time - no polling should happen since all are unmounted
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockFetchGameState).toHaveBeenCalledTimes(3);
    });

    it('should not fetch after unmount even if timers are running', async () => {
      const { unmount } = renderHook(() => useGameState({ pollInterval: 1000 }));

      expect(mockFetchGameState).toHaveBeenCalledTimes(1);

      // Unmount immediately
      unmount();

      // Try to advance time multiple times
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      // Should never call again after unmount
      expect(mockFetchGameState).toHaveBeenCalledTimes(1);
    });

    it('should handle very fast poll intervals', async () => {
      renderHook(() => useGameState({ pollInterval: 100 }));

      expect(mockFetchGameState).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(100);
      expect(mockFetchGameState).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(100);
      expect(mockFetchGameState).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent rerenders without duplicate intervals', async () => {
      const { rerender } = renderHook(() => useGameState({ pollInterval: 2000 }));

      expect(mockFetchGameState).toHaveBeenCalledTimes(1);

      // Trigger multiple rerenders quickly
      rerender();
      rerender();
      rerender();

      // Should not have created multiple intervals
      expect(mockFetchGameState).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2000);
      // Should only poll once, not multiple times
      expect(mockFetchGameState).toHaveBeenCalledTimes(2);
    });

    it('should properly clean up old interval when changing from enabled to disabled', async () => {
      const { rerender } = renderHook(
        ({ enabled }) => useGameState({ enabled, pollInterval: 1000 }),
        {
          initialProps: { enabled: true },
        },
      );

      expect(mockFetchGameState).toHaveBeenCalledTimes(1);

      // Poll once
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockFetchGameState).toHaveBeenCalledTimes(2);

      // Disable
      rerender({ enabled: false });

      // Advance time multiple times - should not poll
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockFetchGameState).toHaveBeenCalledTimes(2);
    });

    it('should handle rapid enable/disable toggling', async () => {
      const { rerender } = renderHook(
        ({ enabled }) => useGameState({ enabled, pollInterval: 2000 }),
        {
          initialProps: { enabled: true },
        },
      );

      expect(mockFetchGameState).toHaveBeenCalledTimes(1);

      // Toggle rapidly
      rerender({ enabled: false });
      rerender({ enabled: true });
      expect(mockFetchGameState).toHaveBeenCalledTimes(2);

      rerender({ enabled: false });
      rerender({ enabled: true });
      expect(mockFetchGameState).toHaveBeenCalledTimes(3);

      // Should still poll correctly
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockFetchGameState).toHaveBeenCalledTimes(4);
    });

    it('should call refresh function and trigger immediate fetch', () => {
      const { result } = renderHook(() => useGameState({ enabled: false }));

      expect(mockFetchGameState).not.toHaveBeenCalled();

      // Call refresh multiple times
      result.current.refresh();
      result.current.refresh();
      result.current.refresh();

      expect(mockFetchGameState).toHaveBeenCalledTimes(3);
    });

    it('should expose all store values correctly', () => {
      useGameStore.setState({
        gameState: mockGameState,
        isLoading: true,
        error: 'Test error',
        lastUpdated: 12345,
      });

      const { result } = renderHook(() => useGameState({ enabled: false }));

      expect(result.current.gameState).toEqual(mockGameState);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBe('Test error');
      expect(typeof result.current.refresh).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
    });

    it('should handle interval change mid-poll cycle', async () => {
      const { rerender } = renderHook(({ interval }) => useGameState({ pollInterval: interval }), {
        initialProps: { interval: 5000 },
      });

      expect(mockFetchGameState).toHaveBeenCalledTimes(1);

      // Advance halfway through interval
      await vi.advanceTimersByTimeAsync(2500);
      expect(mockFetchGameState).toHaveBeenCalledTimes(1);

      // Change interval
      rerender({ interval: 1000 });
      expect(mockFetchGameState).toHaveBeenCalledTimes(2);

      // New interval should apply
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockFetchGameState).toHaveBeenCalledTimes(3);
    });

    it('should not start polling on mount if enabled is false', async () => {
      renderHook(() => useGameState({ enabled: false, pollInterval: 1000 }));

      expect(mockFetchGameState).not.toHaveBeenCalled();

      // Advance time
      await vi.advanceTimersByTimeAsync(5000);

      // Still should not have called
      expect(mockFetchGameState).not.toHaveBeenCalled();
    });
  });
});
