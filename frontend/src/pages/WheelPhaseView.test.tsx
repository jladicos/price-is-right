import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../test/test-utils';
import { WheelPhaseView } from './WheelPhaseView';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import type { GameState } from '../store/gameStore';

// Mock the stores
vi.mock('../store/gameStore', () => ({
  useGameStore: vi.fn(),
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

// Mock the components that we're not testing
vi.mock('../components/WheelDisplay', () => ({
  WheelDisplay: ({
    currentValue,
    targetValue,
    isSpinning,
    onSpin,
    disabled,
    showSpinButton,
  }: {
    currentValue: number;
    targetValue?: number;
    isSpinning: boolean;
    onSpin: () => void;
    disabled: boolean;
    showSpinButton: boolean;
  }) => (
    <div
      data-testid="wheel-display"
      data-current-value={currentValue}
      data-target-value={targetValue}
      data-is-spinning={isSpinning}
      data-disabled={disabled}
      data-show-spin-button={showSpinButton}
    >
      <button onClick={onSpin} disabled={disabled}>
        Spin
      </button>
    </div>
  ),
}));

vi.mock('../components/GameControlStrip', () => ({
  GameControlStrip: () => <div data-testid="game-control-strip" />,
}));

vi.mock('../components/PhaseBackground', () => ({
  PhaseBackground: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="phase-background">{children}</div>
  ),
}));

vi.mock('../components/PlayerCard', () => ({
  PlayerCard: ({ player }: { player: { first_name: string } }) => (
    <div data-testid="player-card">{player.first_name}</div>
  ),
}));

describe('WheelPhaseView', () => {
  const mockTriggerWheelAnimation = vi.fn();
  const mockSpinWheel = vi.fn();
  const mockStayOnWheelSpin = vi.fn();
  const mockStartSpinOff = vi.fn();
  const mockAdvancePhase = vi.fn();
  const mockGoToPreviousPhase = vi.fn();
  const mockStartNewGame = vi.fn();
  const mockFetchGameState = vi.fn();
  const mockResetWheelPhase = vi.fn();

  const baseGameState: GameState = {
    workflow: {
      id: 1,
      current_segment: 'section_1_finale',
      current_segment_index: 0,
      phase_type: 'wheel',
      phase_metadata: '{"type":"wheel"}',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      officially_started: 1,
    },
    contestantsRow: [],
    eligibleAudienceCount: 0,
    wheelSpins: [],
    currentSpinner: 1,
    currentWheelPosition: 50,
    spinoffNumber: 0,
    playerTotals: [
      {
        player_id: 1,
        first_name: 'John',
        last_name: 'Doe',
        photo_filename: 'john.jpg',
        position: 1,
        total: 0,
        eliminated: false,
      },
      {
        player_id: 2,
        first_name: 'Jane',
        last_name: 'Smith',
        photo_filename: 'jane.jpg',
        position: 2,
        total: 0,
        eliminated: false,
      },
    ],
    wheelWinner: null,
    needsSpinoff: false,
  };

  const mockGameStoreState = {
    spinWheel: mockSpinWheel,
    stayOnWheelSpin: mockStayOnWheelSpin,
    startSpinOff: mockStartSpinOff,
    advancePhase: mockAdvancePhase,
    goToPreviousPhase: mockGoToPreviousPhase,
    isWheelAnimating: false,
    pendingSpinTarget: null,
    lastProcessedSpinTimestamp: null,
    startNewGame: mockStartNewGame,
    fetchGameState: mockFetchGameState,
    resetWheelPhase: mockResetWheelPhase,
    triggerWheelAnimation: mockTriggerWheelAnimation,
  };

  const mockAuthStoreState = {
    currentPlayer: {
      id: 1,
      role: 'host' as const,
      firstName: 'Host',
      lastName: 'User',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Default mock implementations
    (useGameStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockGameStoreState);
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockAuthStoreState);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Wheel Animation Sync', () => {
    it('should trigger animation when pendingSpin is detected', async () => {
      // Set a known time for the test
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));

      // Create a timestamp that's very recent (within 4 seconds)
      const pendingSpinTimestamp = Date.now() - 1000; // 1 second ago

      const gameStateWithPendingSpin: GameState = {
        ...baseGameState,
        pendingSpin: {
          targetValue: 75,
          timestamp: pendingSpinTimestamp,
          playerId: 1,
        },
      };

      render(<WheelPhaseView gameState={gameStateWithPendingSpin} />);

      // Advance timers to trigger useEffect
      await vi.advanceTimersByTimeAsync(0);

      // Verify triggerWheelAnimation was called
      expect(mockTriggerWheelAnimation).toHaveBeenCalledWith(75, pendingSpinTimestamp);
    });

    it('should NOT trigger animation when already animating', async () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      const pendingSpinTimestamp = Date.now() - 1000; // 1 second ago (recent)

      const gameStateWithPendingSpin: GameState = {
        ...baseGameState,
        pendingSpin: {
          targetValue: 75,
          timestamp: pendingSpinTimestamp,
          playerId: 1,
        },
      };

      // Set isWheelAnimating to true
      (useGameStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockGameStoreState,
        isWheelAnimating: true,
      });

      render(<WheelPhaseView gameState={gameStateWithPendingSpin} />);

      // Advance timers to ensure useEffect has run
      await vi.advanceTimersByTimeAsync(100);

      // Should NOT trigger animation because already animating
      expect(mockTriggerWheelAnimation).not.toHaveBeenCalled();
    });

    it('should NOT trigger animation for already processed spin', async () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      const currentTime = Date.now();
      const oldTimestamp = currentTime - 2000; // Spin from 2 seconds ago
      const processedTimestamp = currentTime - 1000; // Processed 1 second ago

      const gameStateWithPendingSpin: GameState = {
        ...baseGameState,
        pendingSpin: {
          targetValue: 75,
          timestamp: oldTimestamp, // Older than lastProcessedSpinTimestamp
          playerId: 1,
        },
      };

      // Set lastProcessedSpinTimestamp to a newer timestamp
      (useGameStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockGameStoreState,
        lastProcessedSpinTimestamp: processedTimestamp,
      });

      render(<WheelPhaseView gameState={gameStateWithPendingSpin} />);

      // Advance timers to ensure useEffect has run
      await vi.advanceTimersByTimeAsync(100);

      // Should NOT trigger animation because spin was already processed
      expect(mockTriggerWheelAnimation).not.toHaveBeenCalled();
    });

    it('should NOT trigger animation for stale spins (older than 4 seconds)', async () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      // Create a timestamp that's more than 4 seconds old
      const staleTimestamp = Date.now() - 5000;

      const gameStateWithStaleSpin: GameState = {
        ...baseGameState,
        pendingSpin: {
          targetValue: 75,
          timestamp: staleTimestamp,
          playerId: 1,
        },
      };

      render(<WheelPhaseView gameState={gameStateWithStaleSpin} />);

      // Advance timers to ensure useEffect has run
      await vi.advanceTimersByTimeAsync(100);

      // Should NOT trigger animation because spin is stale
      expect(mockTriggerWheelAnimation).not.toHaveBeenCalled();
    });

    it('should NOT trigger animation when no pendingSpin exists', async () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));

      render(<WheelPhaseView gameState={baseGameState} />);

      // Advance timers to ensure useEffect has run
      await vi.advanceTimersByTimeAsync(100);

      // Should NOT trigger animation because there's no pendingSpin
      expect(mockTriggerWheelAnimation).not.toHaveBeenCalled();
    });

    // Boundary condition: timestamp exactly equal to lastProcessedSpinTimestamp
    it('should NOT trigger animation when pendingSpin timestamp equals lastProcessedSpinTimestamp', async () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      const sameTimestamp = Date.now() - 1000; // Recent spin

      const gameStateWithPendingSpin: GameState = {
        ...baseGameState,
        pendingSpin: {
          targetValue: 75,
          timestamp: sameTimestamp,
          playerId: 1,
        },
      };

      // Set lastProcessedSpinTimestamp to the SAME timestamp
      (useGameStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockGameStoreState,
        lastProcessedSpinTimestamp: sameTimestamp, // Same timestamp = already processed
      });

      render(<WheelPhaseView gameState={gameStateWithPendingSpin} />);

      await vi.advanceTimersByTimeAsync(100);

      // Should NOT trigger because timestamp <= lastProcessedSpinTimestamp
      expect(mockTriggerWheelAnimation).not.toHaveBeenCalled();
    });

    // Boundary condition: spin exactly at 4000ms (should still trigger)
    it('should trigger animation for spin exactly at 4000ms age (boundary)', async () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      // Spin from exactly 4000ms ago - this should still trigger (boundary is > 4000, not >= 4000)
      const boundaryTimestamp = Date.now() - 4000;

      const gameStateWithBoundarySpin: GameState = {
        ...baseGameState,
        pendingSpin: {
          targetValue: 75,
          timestamp: boundaryTimestamp,
          playerId: 1,
        },
      };

      render(<WheelPhaseView gameState={gameStateWithBoundarySpin} />);

      await vi.advanceTimersByTimeAsync(0);

      // Should trigger because spinAge (4000) is NOT > 4000
      expect(mockTriggerWheelAnimation).toHaveBeenCalledWith(75, boundaryTimestamp);
    });

    // Boundary condition: spin at 4001ms (should NOT trigger)
    it('should NOT trigger animation for spin at 4001ms age (just over boundary)', async () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      // Spin from 4001ms ago - this should NOT trigger
      const justOverBoundaryTimestamp = Date.now() - 4001;

      const gameStateWithOldSpin: GameState = {
        ...baseGameState,
        pendingSpin: {
          targetValue: 75,
          timestamp: justOverBoundaryTimestamp,
          playerId: 1,
        },
      };

      render(<WheelPhaseView gameState={gameStateWithOldSpin} />);

      await vi.advanceTimersByTimeAsync(100);

      // Should NOT trigger because spinAge (4001) > 4000
      expect(mockTriggerWheelAnimation).not.toHaveBeenCalled();
    });

    // Test with player role (not host) - animation sync should work for all roles
    it('should trigger animation for player role (not just host)', async () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      const pendingSpinTimestamp = Date.now() - 1000;

      const gameStateWithPendingSpin: GameState = {
        ...baseGameState,
        pendingSpin: {
          targetValue: 75,
          timestamp: pendingSpinTimestamp,
          playerId: 1,
        },
      };

      // Set auth store to player role
      (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentPlayer: {
          id: 2,
          role: 'player' as const,
          firstName: 'Jane',
          lastName: 'Smith',
        },
      });

      render(<WheelPhaseView gameState={gameStateWithPendingSpin} />);

      await vi.advanceTimersByTimeAsync(0);

      // Animation sync should still work for players
      expect(mockTriggerWheelAnimation).toHaveBeenCalledWith(75, pendingSpinTimestamp);
    });

    // Test with audience role
    it('should trigger animation for audience role', async () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      const pendingSpinTimestamp = Date.now() - 1000;

      const gameStateWithPendingSpin: GameState = {
        ...baseGameState,
        pendingSpin: {
          targetValue: 75,
          timestamp: pendingSpinTimestamp,
          playerId: 1,
        },
      };

      // Set auth store to audience role
      (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentPlayer: {
          id: 3,
          role: 'audience' as const,
          firstName: 'Audience',
          lastName: 'Member',
        },
      });

      render(<WheelPhaseView gameState={gameStateWithPendingSpin} />);

      await vi.advanceTimersByTimeAsync(0);

      // Animation sync should still work for audience
      expect(mockTriggerWheelAnimation).toHaveBeenCalledWith(75, pendingSpinTimestamp);
    });

    // Test with null currentPlayer
    it('should trigger animation even when currentPlayer is null', async () => {
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      const pendingSpinTimestamp = Date.now() - 1000;

      const gameStateWithPendingSpin: GameState = {
        ...baseGameState,
        pendingSpin: {
          targetValue: 75,
          timestamp: pendingSpinTimestamp,
          playerId: 1,
        },
      };

      // Set auth store to have no current player
      (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentPlayer: null,
      });

      render(<WheelPhaseView gameState={gameStateWithPendingSpin} />);

      await vi.advanceTimersByTimeAsync(0);

      // Animation sync should still work even without a logged-in user
      expect(mockTriggerWheelAnimation).toHaveBeenCalledWith(75, pendingSpinTimestamp);
    });
  });

  describe('Basic Rendering', () => {
    it('should render wheel display', () => {
      render(<WheelPhaseView gameState={baseGameState} />);

      expect(screen.getByTestId('wheel-display')).toBeInTheDocument();
    });

    it('should render game control strip', () => {
      render(<WheelPhaseView gameState={baseGameState} />);

      expect(screen.getByTestId('game-control-strip')).toBeInTheDocument();
    });

    it('should render phase background', () => {
      render(<WheelPhaseView gameState={baseGameState} />);

      expect(screen.getByTestId('phase-background')).toBeInTheDocument();
    });

    it('should render current spinner', () => {
      render(<WheelPhaseView gameState={baseGameState} />);

      // John is the current spinner (player_id: 1)
      // There may be multiple "John" elements (name badge + player card)
      const johnElements = screen.getAllByText('John');
      expect(johnElements.length).toBeGreaterThan(0);
    });
  });

  describe('Wheel Display Props', () => {
    it('should pass current wheel position to WheelDisplay', () => {
      const gameStateWithPosition: GameState = {
        ...baseGameState,
        currentWheelPosition: 75,
      };

      render(<WheelPhaseView gameState={gameStateWithPosition} />);

      const wheelDisplay = screen.getByTestId('wheel-display');
      expect(wheelDisplay).toHaveAttribute('data-current-value', '75');
    });

    it('should pass target value when animating', () => {
      (useGameStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockGameStoreState,
        isWheelAnimating: true,
        pendingSpinTarget: 50,
      });

      render(<WheelPhaseView gameState={baseGameState} />);

      const wheelDisplay = screen.getByTestId('wheel-display');
      expect(wheelDisplay).toHaveAttribute('data-target-value', '50');
      expect(wheelDisplay).toHaveAttribute('data-is-spinning', 'true');
    });

    it('should disable wheel when animating', () => {
      (useGameStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockGameStoreState,
        isWheelAnimating: true,
      });

      render(<WheelPhaseView gameState={baseGameState} />);

      const wheelDisplay = screen.getByTestId('wheel-display');
      expect(wheelDisplay).toHaveAttribute('data-disabled', 'true');
    });
  });

  describe('Winner Display', () => {
    it('should show winner when wheel phase is complete', () => {
      const gameStateWithWinner: GameState = {
        ...baseGameState,
        wheelWinner: 1, // John is the winner
        playerTotals: [
          {
            player_id: 1,
            first_name: 'John',
            last_name: 'Doe',
            photo_filename: 'john.jpg',
            position: 1,
            total: 0.85,
            eliminated: false,
          },
          {
            player_id: 2,
            first_name: 'Jane',
            last_name: 'Smith',
            photo_filename: 'jane.jpg',
            position: 2,
            total: 0.65,
            eliminated: false,
          },
        ],
      };

      render(<WheelPhaseView gameState={gameStateWithWinner} />);

      // WINNER badge should be visible
      expect(screen.getByText('WINNER')).toBeInTheDocument();
    });

    it('should NOT show winner celebration while animating', () => {
      const gameStateWithWinner: GameState = {
        ...baseGameState,
        wheelWinner: 1,
      };

      (useGameStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        ...mockGameStoreState,
        isWheelAnimating: true,
      });

      render(<WheelPhaseView gameState={gameStateWithWinner} />);

      // WINNER badge should NOT be visible while animating
      expect(screen.queryByText('WINNER')).not.toBeInTheDocument();
    });
  });

  describe('Tie/Spinoff Display', () => {
    it('should show TIE badge when spinoff is needed', () => {
      const gameStateWithTie: GameState = {
        ...baseGameState,
        needsSpinoff: true,
        currentSpinner: null,
        playerTotals: [
          {
            player_id: 1,
            first_name: 'John',
            last_name: 'Doe',
            photo_filename: 'john.jpg',
            position: 1,
            total: 0.75,
            eliminated: false,
          },
          {
            player_id: 2,
            first_name: 'Jane',
            last_name: 'Smith',
            photo_filename: 'jane.jpg',
            position: 2,
            total: 0.75,
            eliminated: false,
          },
        ],
        wheelSpins: [
          {
            id: 1,
            player_id: 1,
            game_segment: 'section_1_finale',
            spin_number: 1,
            result: 0.75,
            spinoff_number: 0,
            created_at: '2025-01-01T00:00:00Z',
          },
          {
            id: 2,
            player_id: 2,
            game_segment: 'section_1_finale',
            spin_number: 1,
            result: 0.75,
            spinoff_number: 0,
            created_at: '2025-01-01T00:00:00Z',
          },
        ],
      };

      render(<WheelPhaseView gameState={gameStateWithTie} />);

      // TIE badges should be visible (one for each tied player)
      const tieBadges = screen.getAllByText('TIE');
      expect(tieBadges.length).toBeGreaterThanOrEqual(1);
    });
  });
});
