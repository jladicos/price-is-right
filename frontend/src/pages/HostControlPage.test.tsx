import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import HostControlPage from './HostControlPage';
import type { GameState } from '../store/gameStore';

// Create mock functions
const mockStartNewGame = vi.fn();
const mockAdvancePhase = vi.fn();
const mockRevealContestant = vi.fn();
const mockReplaceContestantRandom = vi.fn();
const mockReplaceContestantManual = vi.fn();
const mockRefreshContestantsRow = vi.fn();
const mockRefresh = vi.fn();
const mockClearError = vi.fn();

// Mock useGameState hook
vi.mock('../hooks/useGameState', () => ({
  useGameState: vi.fn(),
}));

// Mock useGameStore hook
vi.mock('../store/gameStore', () => ({
  useGameStore: vi.fn(),
}));

// Mock toast utilities
vi.mock('../utils/toast', () => ({
  showToast: vi.fn(),
}));

// Import after mocking
import { useGameState } from '../hooks/useGameState';
import { useGameStore } from '../store/gameStore';

describe('HostControlPage', () => {
  const mockGameState: GameState = {
    workflow: {
      id: 1,
      current_segment: 'section_1',
      current_segment_index: 0,
      phase_type: 'bidding',
      phase_metadata: '{"type":"bidding"}',
      created_at: '2025-11-20T12:00:00Z',
      updated_at: '2025-11-20T12:00:00Z',
    },
    contestantsRow: [
      {
        id: 1,
        player_id: 10,
        position: 1,
        game_segment: 'section_1',
        status: 'pending_reveal',
        added_at: '2025-11-20T12:00:00Z',
        revealed_at: null,
        created_at: '2025-11-20T12:00:00Z',
        updated_at: '2025-11-20T12:00:00Z',
        first_name: 'John',
        last_name: 'Doe',
        photo_filename: 'john-doe.jpg',
        role: 'audience',
      },
      {
        id: 2,
        player_id: 11,
        position: 2,
        game_segment: 'section_1',
        status: 'active',
        added_at: '2025-11-20T12:00:00Z',
        revealed_at: '2025-11-20T12:01:00Z',
        created_at: '2025-11-20T12:00:00Z',
        updated_at: '2025-11-20T12:01:00Z',
        first_name: 'Jane',
        last_name: 'Smith',
        photo_filename: 'jane-smith.jpg',
        role: 'player',
      },
    ],
    eligibleAudienceCount: 50,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations
    mockStartNewGame.mockResolvedValue(undefined);
    mockAdvancePhase.mockResolvedValue(undefined);
    mockRevealContestant.mockResolvedValue(undefined);
    mockReplaceContestantRandom.mockResolvedValue(undefined);
    mockReplaceContestantManual.mockResolvedValue(undefined);
    mockRefreshContestantsRow.mockResolvedValue(undefined);

    // Mock useGameState hook
    vi.mocked(useGameState).mockReturnValue({
      gameState: mockGameState,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
      clearError: mockClearError,
    });

    // Mock useGameStore hook
    vi.mocked(useGameStore).mockReturnValue({
      startNewGame: mockStartNewGame,
      advancePhase: mockAdvancePhase,
      revealContestant: mockRevealContestant,
      replaceContestantRandom: mockReplaceContestantRandom,
      replaceContestantManual: mockReplaceContestantManual,
      refreshContestantsRow: mockRefreshContestantsRow,
    });

    // Mock window.confirm
    global.confirm = vi.fn(() => true);
  });

  describe('Rendering', () => {
    it('should render the page with current game state', () => {
      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      expect(screen.getByText('Host Game Control')).toBeInTheDocument();
      expect(screen.getByText(/Current Phase:/)).toBeInTheDocument();
      expect(screen.getByText(/bidding/)).toBeInTheDocument();
      expect(screen.getByText(/Segment:/)).toBeInTheDocument();
      // Check for segment value - use getAllByText since it appears multiple times
      const segmentTexts = screen.getAllByText(/section_1/);
      expect(segmentTexts.length).toBeGreaterThan(0);
      expect(screen.getByText(/Eligible Audience:/)).toBeInTheDocument();
      expect(screen.getByText(/50/)).toBeInTheDocument();
    });

    it('should render contestants row', () => {
      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      expect(screen.getByText(/Contestants Row \(2\/5\)/)).toBeInTheDocument();
      expect(screen.getByText(/Position 1: John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Position 2: Jane Smith/)).toBeInTheDocument();
    });

    it('should show reveal button for pending contestants', () => {
      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const revealButtons = screen.getAllByRole('button', { name: /Reveal/i });
      expect(revealButtons).toHaveLength(1);
    });

    it('should not show reveal button for active contestants', () => {
      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      // Jane Smith is active, should not have a reveal button next to her name
      const revealButtons = screen.getAllByRole('button', { name: /Reveal/i });
      expect(revealButtons).toHaveLength(1); // Only John Doe has one
    });

    it('should render error state when error exists', () => {
      vi.mocked(useGameState).mockReturnValue({
        gameState: null,
        isLoading: false,
        error: 'Failed to load game state',
        refresh: mockRefresh,
        clearError: mockClearError,
      });

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      expect(screen.getByText('Error Loading Game State')).toBeInTheDocument();
      expect(screen.getByText('Failed to load game state')).toBeInTheDocument();
    });

    it('should render empty state when no contestants', () => {
      vi.mocked(useGameState).mockReturnValue({
        gameState: { ...mockGameState, contestantsRow: [] },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        clearError: mockClearError,
      });

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      expect(screen.getByText(/No contestants selected yet/)).toBeInTheDocument();
    });
  });

  describe('Start New Game', () => {
    it('should start game directly when no game in progress (phase=not_started)', async () => {
      const user = userEvent.setup();

      // Mock not_started state
      vi.mocked(useGameState).mockReturnValue({
        gameState: {
          workflow: {
            id: 1,
            current_segment: 'section_1',
            current_segment_index: 0,
            phase_type: 'not_started',
            phase_metadata: null,
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
          },
          contestantsRow: [],
          eligibleAudienceCount: 50,
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        clearError: mockClearError,
      });

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const startButton = screen.getByRole('button', { name: /Start New Game/i });
      await user.click(startButton);

      // Should call startNewGame directly without showing modal
      await waitFor(() => {
        expect(mockStartNewGame).toHaveBeenCalled();
      });
    });

    it('should show confirmation modal when game is in progress', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const startButton = screen.getByRole('button', { name: /Start New Game/i });
      await user.click(startButton);

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText('Start New Game?')).toBeInTheDocument();
      });

      // Should not start game yet
      expect(mockStartNewGame).not.toHaveBeenCalled();
    });

    it('should start game when confirmed in modal', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const startButton = screen.getByRole('button', { name: /Start New Game/i });
      await user.click(startButton);

      // Find and click the confirm button in the modal
      const confirmButtons = await screen.findAllByRole('button', { name: /Start New Game/i });
      const modalConfirmButton = confirmButtons[1]; // Second one is in the modal
      await user.click(modalConfirmButton);

      await waitFor(() => {
        expect(mockStartNewGame).toHaveBeenCalled();
      });
    });

    it('should not start game when modal is cancelled', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const startButton = screen.getByRole('button', { name: /Start New Game/i });
      await user.click(startButton);

      // Click cancel in modal
      const cancelButton = await screen.findByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockStartNewGame).not.toHaveBeenCalled();
    });

    it('should show loading state while starting game', async () => {
      const user = userEvent.setup();

      // Mock not_started so no modal is shown
      vi.mocked(useGameState).mockReturnValue({
        gameState: {
          workflow: {
            id: 1,
            current_segment: 'section_1',
            current_segment_index: 0,
            phase_type: 'not_started',
            phase_metadata: null,
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
          },
          contestantsRow: [],
          eligibleAudienceCount: 50,
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        clearError: mockClearError,
      });

      let resolveStart: () => void;
      const startPromise = new Promise<void>((resolve) => {
        resolveStart = resolve;
      });
      mockStartNewGame.mockReturnValue(startPromise);

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const startButton = screen.getByRole('button', { name: /Start New Game/i });
      await user.click(startButton);

      // Button should be disabled during loading
      await waitFor(() => {
        expect(startButton).toBeDisabled();
      });

      resolveStart!();
      await waitFor(() => {
        expect(startButton).not.toBeDisabled();
      });
    });
  });

  describe('Reveal Contestant', () => {
    it('should call revealContestant when reveal button clicked', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const revealButton = screen.getByRole('button', { name: /Reveal/i });
      await user.click(revealButton);

      expect(mockRevealContestant).toHaveBeenCalledWith(1);
    });

    it('should show loading state on the specific reveal button', async () => {
      const user = userEvent.setup();
      let resolveReveal: () => void;
      const revealPromise = new Promise<void>((resolve) => {
        resolveReveal = resolve;
      });
      mockRevealContestant.mockReturnValue(revealPromise);

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const revealButton = screen.getByRole('button', { name: /Reveal/i });
      await user.click(revealButton);

      expect(revealButton).toBeDisabled();

      resolveReveal!();
      await waitFor(() => {
        expect(mockRevealContestant).toHaveBeenCalled();
      });
    });
  });

  describe('Replace Contestant', () => {
    it('should open replace modal when replace button clicked', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const replaceButtons = screen.getAllByRole('button', { name: /Replace$/i });
      await user.click(replaceButtons[0]);

      // Modal should be open
      expect(screen.getByText('Replace Contestant')).toBeInTheDocument();
      expect(screen.getByText('Current Contestant')).toBeInTheDocument();
    });
  });

  describe('Refresh Contestants Row', () => {
    it('should call refreshContestantsRow when button clicked and confirmed', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const refreshButton = screen.getByRole('button', {
        name: /Refresh Entire Row/i,
      });
      await user.click(refreshButton);

      expect(global.confirm).toHaveBeenCalledWith(
        'Refresh all 5 contestants? This will replace everyone in the row.',
      );
      expect(mockRefreshContestantsRow).toHaveBeenCalledWith('section_1');
    });

    it('should not call refreshContestantsRow when cancelled', async () => {
      const user = userEvent.setup();
      global.confirm = vi.fn(() => false);

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const refreshButton = screen.getByRole('button', {
        name: /Refresh Entire Row/i,
      });
      await user.click(refreshButton);

      expect(mockRefreshContestantsRow).not.toHaveBeenCalled();
    });

    it('should use correct segment for section_2', async () => {
      const user = userEvent.setup();

      vi.mocked(useGameState).mockReturnValue({
        gameState: {
          ...mockGameState,
          workflow: { ...mockGameState.workflow, current_segment: 'section_2' },
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        clearError: mockClearError,
      });

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const refreshButton = screen.getByRole('button', {
        name: /Refresh Entire Row/i,
      });
      await user.click(refreshButton);

      expect(mockRefreshContestantsRow).toHaveBeenCalledWith('section_2');
    });

    it('should disable refresh button when no contestants', () => {
      vi.mocked(useGameState).mockReturnValue({
        gameState: { ...mockGameState, contestantsRow: [] },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        clearError: mockClearError,
      });

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const refreshButton = screen.getByRole('button', {
        name: /Refresh Entire Row/i,
      });
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('Advance Phase', () => {
    it('should call advancePhase when button clicked', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const advanceButton = screen.getByRole('button', {
        name: /Advance to Next Phase/i,
      });
      await user.click(advanceButton);

      expect(mockAdvancePhase).toHaveBeenCalled();
    });

    it('should not show advance button when game not started', () => {
      vi.mocked(useGameState).mockReturnValue({
        gameState: {
          ...mockGameState,
          workflow: { ...mockGameState.workflow, phase_type: 'not_started' },
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        clearError: mockClearError,
      });

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      expect(
        screen.queryByRole('button', { name: /Advance to Next Phase/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('Manual Select Modal', () => {
    it('should open manual select modal when button clicked', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const manualSelectButton = screen.getByRole('button', {
        name: /Manual Select/i,
      });
      await user.click(manualSelectButton);

      expect(screen.getByText('Manually Select Contestant')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should disable buttons when isLoading is true', () => {
      vi.mocked(useGameState).mockReturnValue({
        gameState: mockGameState,
        isLoading: true,
        error: null,
        refresh: mockRefresh,
        clearError: mockClearError,
      });

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      expect(screen.getByRole('button', { name: /Start New Game/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Manual Select/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Refresh Entire Row/i })).toBeDisabled();
    });
  });

  describe('Contestant Display', () => {
    it('should show status and role for each contestant', () => {
      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      expect(screen.getByText(/Status: pending_reveal/)).toBeInTheDocument();
      expect(screen.getByText(/Role: audience/)).toBeInTheDocument();
      expect(screen.getByText(/Status: active/)).toBeInTheDocument();
      expect(screen.getByText(/Role: player/)).toBeInTheDocument();
    });

    it('should show revealed_at timestamp for revealed contestants', () => {
      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      expect(screen.getByText(/Revealed at:/)).toBeInTheDocument();
    });

    it('should not show revealed_at for pending contestants', () => {
      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const revealedTexts = screen.getAllByText(/Revealed at:/);
      expect(revealedTexts).toHaveLength(1); // Only Jane Smith
    });
  });

  describe('Error Handling', () => {
    it('should show error toast when startNewGame fails', async () => {
      const user = userEvent.setup();
      const showToast = await import('../utils/toast');
      mockStartNewGame.mockRejectedValue(new Error('Failed to initialize game'));

      // Mock not_started so no modal is shown
      vi.mocked(useGameState).mockReturnValue({
        gameState: {
          workflow: {
            id: 1,
            current_segment: 'section_1',
            current_segment_index: 0,
            phase_type: 'not_started',
            phase_metadata: null,
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
          },
          contestantsRow: [],
          eligibleAudienceCount: 50,
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        clearError: mockClearError,
      });

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const startButton = screen.getByRole('button', { name: /Start New Game/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(showToast.showToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to initialize game',
          type: 'error',
        });
      });

      // Loading state should be reset
      expect(startButton).not.toBeDisabled();
    });

    it('should show error toast when advancePhase fails', async () => {
      const user = userEvent.setup();
      const showToast = await import('../utils/toast');
      mockAdvancePhase.mockRejectedValue(new Error('Invalid phase transition'));

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const advanceButton = screen.getByRole('button', {
        name: /Advance to Next Phase/i,
      });
      await user.click(advanceButton);

      await waitFor(() => {
        expect(showToast.showToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Invalid phase transition',
          type: 'error',
        });
      });
    });

    it('should show error toast when revealContestant fails', async () => {
      const user = userEvent.setup();
      const showToast = await import('../utils/toast');
      mockRevealContestant.mockRejectedValue(new Error('Contestant not found'));

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const revealButton = screen.getByRole('button', { name: /Reveal/i });
      await user.click(revealButton);

      await waitFor(() => {
        expect(showToast.showToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Contestant not found',
          type: 'error',
        });
      });

      // Loading state should be reset (button no longer disabled)
      await waitFor(() => {
        expect(revealButton).not.toBeDisabled();
      });
    });

    it('should show error toast when refreshContestantsRow fails', async () => {
      const user = userEvent.setup();
      const showToast = await import('../utils/toast');
      mockRefreshContestantsRow.mockRejectedValue(
        new Error('Not enough eligible players'),
      );

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const refreshButton = screen.getByRole('button', {
        name: /Refresh Entire Row/i,
      });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(showToast.showToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Not enough eligible players',
          type: 'error',
        });
      });
    });

    it('should handle non-Error exceptions', async () => {
      const user = userEvent.setup();
      const showToast = await import('../utils/toast');
      mockStartNewGame.mockRejectedValue('String error');

      // Mock not_started so no modal is shown
      vi.mocked(useGameState).mockReturnValue({
        gameState: {
          workflow: {
            id: 1,
            current_segment: 'section_1',
            current_segment_index: 0,
            phase_type: 'not_started',
            phase_metadata: null,
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
          },
          contestantsRow: [],
          eligibleAudienceCount: 50,
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        clearError: mockClearError,
      });

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const startButton = screen.getByRole('button', { name: /Start New Game/i });
      await user.click(startButton);

      await waitFor(() => {
        expect(showToast.showToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to start game',
          type: 'error',
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null workflow gracefully', () => {
      vi.mocked(useGameState).mockReturnValue({
        gameState: {
          workflow: null as any,
          contestantsRow: [],
          eligibleAudienceCount: 0,
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        clearError: mockClearError,
      });

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      // Should render without crashing
      expect(screen.getByText('Host Game Control')).toBeInTheDocument();
      // Should show placeholder for missing workflow data
      const phaseText = screen.getByText(/Current Phase:/);
      expect(phaseText).toBeInTheDocument();
    });

    it('should display zero eligible audience count', () => {
      vi.mocked(useGameState).mockReturnValue({
        gameState: {
          ...mockGameState,
          eligibleAudienceCount: 0,
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        clearError: mockClearError,
      });

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      // Should show the label and zero value
      expect(screen.getByText(/Eligible Audience:/)).toBeInTheDocument();

      // Find the card with audience count info
      const audienceElement = screen.getByText(/Eligible Audience:/).parentElement;
      expect(audienceElement?.textContent).toContain('Eligible Audience: 0');
    });

    it('should disable start game button when insufficient audience members', () => {
      vi.mocked(useGameState).mockReturnValue({
        gameState: {
          ...mockGameState,
          eligibleAudienceCount: 3, // Less than 5
          workflow: {
            ...mockGameState.workflow,
            phase_type: 'not_started', // No game in progress
          },
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        clearError: mockClearError,
      });

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      // Button should be disabled
      const startButton = screen.getByRole('button', { name: /Start New Game/i });
      expect(startButton).toBeDisabled();

      // Should show warning message
      expect(
        screen.getByText(/Cannot start game: Need at least 5 eligible audience members/),
      ).toBeInTheDocument();
      expect(screen.getByText(/Currently have 3/)).toBeInTheDocument();
    });

    it('should enable start game button when sufficient audience members', () => {
      vi.mocked(useGameState).mockReturnValue({
        gameState: {
          ...mockGameState,
          eligibleAudienceCount: 10, // More than 5
          workflow: {
            ...mockGameState.workflow,
            phase_type: 'not_started', // No game in progress
          },
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        clearError: mockClearError,
      });

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      // Button should be enabled
      const startButton = screen.getByRole('button', { name: /Start New Game/i });
      expect(startButton).not.toBeDisabled();

      // Should NOT show warning message
      expect(
        screen.queryByText(/Cannot start game: Need at least 5 eligible audience members/),
      ).not.toBeInTheDocument();
    });

    it('should handle null gameState without error', () => {
      vi.mocked(useGameState).mockReturnValue({
        gameState: null,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        clearError: mockClearError,
      });

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      // Should show empty state
      expect(screen.getByText(/No contestants selected yet/)).toBeInTheDocument();
    });

    it('should handle multiple contestants with same status', () => {
      vi.mocked(useGameState).mockReturnValue({
        gameState: {
          ...mockGameState,
          contestantsRow: [
            ...mockGameState.contestantsRow,
            {
              id: 3,
              player_id: 12,
              position: 3,
              game_segment: 'section_1',
              status: 'pending_reveal',
              added_at: '2025-11-20T12:00:00Z',
              revealed_at: null,
              created_at: '2025-11-20T12:00:00Z',
              updated_at: '2025-11-20T12:00:00Z',
              first_name: 'Bob',
              last_name: 'Jones',
              photo_filename: 'bob.jpg',
              role: 'audience',
            },
          ],
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        clearError: mockClearError,
      });

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      // Should show reveal buttons for both pending contestants
      const revealButtons = screen.getAllByRole('button', { name: /Reveal/i });
      expect(revealButtons).toHaveLength(2);
    });

    it('should prevent multiple rapid clicks on start game button', async () => {
      const user = userEvent.setup();
      let resolveStart: () => void;
      const startPromise = new Promise<void>((resolve) => {
        resolveStart = resolve;
      });
      mockStartNewGame.mockReturnValue(startPromise);

      // Mock not_started so no modal is shown
      vi.mocked(useGameState).mockReturnValue({
        gameState: {
          workflow: {
            id: 1,
            current_segment: 'section_1',
            current_segment_index: 0,
            phase_type: 'not_started',
            phase_metadata: null,
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
          },
          contestantsRow: [],
          eligibleAudienceCount: 50,
        },
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        clearError: mockClearError,
      });

      render(
        <MemoryRouter>
          <HostControlPage />
        </MemoryRouter>,
      );

      const startButton = screen.getByRole('button', { name: /Start New Game/i });

      // Click multiple times rapidly
      await user.click(startButton);
      await user.click(startButton);
      await user.click(startButton);

      // Should only call once because button is disabled after first click
      expect(mockStartNewGame).toHaveBeenCalledTimes(1);

      resolveStart!();
    });
  });
});
