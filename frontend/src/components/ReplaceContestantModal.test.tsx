import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import { ReplaceContestantModal } from './ReplaceContestantModal';
import type { ContestantWithPlayer } from '../store/gameStore';
import * as apiModule from '../utils/api';

// Mock API and toast
vi.mock('../utils/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('../utils/toast', () => ({
  showToast: vi.fn(),
}));

describe('ReplaceContestantModal', () => {
  const mockOnClose = vi.fn();
  const mockOnReplaceRandom = vi.fn();
  const mockOnReplaceManual = vi.fn();

  const mockContestant: ContestantWithPlayer = {
    id: 1,
    player_id: 10,
    position: 2,
    game_segment: 'section_1',
    status: 'active',
    added_at: '2025-11-20T12:00:00Z',
    revealed_at: '2025-11-20T12:01:00Z',
    created_at: '2025-11-20T12:00:00Z',
    updated_at: '2025-11-20T12:01:00Z',
    first_name: 'John',
    last_name: 'Doe',
    photo_filename: 'john.jpg',
    role: 'audience',
  };

  const mockPlayers = [
    {
      id: 1,
      firstName: 'Alice',
      lastName: 'Anderson',
      photoFilename: 'alice.jpg',
      role: 'audience',
      active: true,
    },
    {
      id: 2,
      firstName: 'Bob',
      lastName: 'Baker',
      photoFilename: 'bob.jpg',
      role: 'player',
      active: true,
    },
    {
      id: 3,
      firstName: 'Charlie',
      lastName: 'Clark',
      photoFilename: 'charlie.jpg',
      role: 'audience',
      active: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnReplaceRandom.mockResolvedValue(undefined);
    mockOnReplaceManual.mockResolvedValue(undefined);
    vi.mocked(apiModule.apiRequest).mockResolvedValue({
      players: mockPlayers,
      total: 3,
    });
  });

  describe('Rendering', () => {
    it('should not render when closed', () => {
      render(
        <ReplaceContestantModal
          isOpen={false}
          onClose={mockOnClose}
          contestant={null}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      expect(screen.queryByText('Replace Contestant')).not.toBeInTheDocument();
    });

    it('should render with loading state when contestant is null', () => {
      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={null}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Modal should still render with title
      expect(screen.getByText('Replace Contestant')).toBeInTheDocument();
      // Should show loading message
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render modal when open with contestant', async () => {
      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      expect(screen.getByText('Replace Contestant')).toBeInTheDocument();
      expect(screen.getByText('Current Contestant')).toBeInTheDocument();
      expect(screen.getByText('Replacement Method')).toBeInTheDocument();
    });

    it('should display current contestant information', async () => {
      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      expect(screen.getByText(/Name:/)).toBeInTheDocument();
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Position:/)).toBeInTheDocument();
      expect(screen.getByText(/2/)).toBeInTheDocument();
      expect(screen.getByText(/Status:/)).toBeInTheDocument();
      expect(screen.getByText(/active/)).toBeInTheDocument();
    });

    it('should default to random replacement mode', async () => {
      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      const randomButton = screen.getByRole('button', {
        name: /Random Selection/i,
      });
      expect(randomButton).toHaveClass('chakra-button');
    });
  });

  describe('Replacement Mode Selection', () => {
    it('should allow switching to manual mode', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('Search Players')).toBeInTheDocument();
      });
    });

    it('should fetch players when switching to manual mode', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(apiModule.apiRequest).toHaveBeenCalledWith('/players?active=true');
      });
    });

    it('should show players list in manual mode', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
        expect(screen.getByText('Bob Baker')).toBeInTheDocument();
        expect(screen.getByText('Charlie Clark')).toBeInTheDocument();
      });
    });

    it('should switch back to random mode', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Switch to manual
      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
      });

      // Switch back to random
      const randomButton = screen.getByRole('button', {
        name: /Random Selection/i,
      });
      await user.click(randomButton);

      await waitFor(() => {
        expect(screen.queryByText('Alice Anderson')).not.toBeInTheDocument();
      });
    });
  });

  describe('Random Replacement', () => {
    it('should show random replacement description', async () => {
      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      expect(
        screen.getByText(/A random player from the eligible audience pool/),
      ).toBeInTheDocument();
    });

    it('should call onReplaceRandom when confirmed in random mode', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      const confirmButton = screen.getByRole('button', {
        name: /Replace Random/i,
      });
      await user.click(confirmButton);

      expect(mockOnReplaceRandom).toHaveBeenCalledWith(1);
    });

    it('should close modal after successful random replacement', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      const confirmButton = screen.getByRole('button', {
        name: /Replace Random/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should show loading state during random replacement', async () => {
      const user = userEvent.setup();
      let resolveReplace: () => void;
      const replacePromise = new Promise<void>((resolve) => {
        resolveReplace = resolve;
      });
      mockOnReplaceRandom.mockReturnValue(replacePromise);

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      const confirmButton = screen.getByRole('button', {
        name: /Replace Random/i,
      });
      await user.click(confirmButton);

      expect(confirmButton).toBeDisabled();

      resolveReplace!();

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Manual Replacement', () => {
    it('should allow selecting a player in manual mode', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Switch to manual mode
      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
      });

      // Select a player
      const aliceCard = screen.getByText('Alice Anderson').closest('div')!;
      await user.click(aliceCard);

      // Should show preview
      await waitFor(() => {
        expect(screen.getByText('Replacement Preview')).toBeInTheDocument();
      });
    });

    it('should show replacement preview with correct details', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Switch to manual and select player
      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
      });

      const aliceCard = screen.getByText('Alice Anderson').closest('div')!;
      await user.click(aliceCard);

      await waitFor(() => {
        const preview = screen.getByText('Replacement Preview').closest('div')!;
        expect(preview).toHaveTextContent('New Player: Alice Anderson');
        expect(preview).toHaveTextContent('Position: 2');
      });
    });

    it('should filter players by search term', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Switch to manual mode
      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
      });

      // Search for bob
      const searchInput = screen.getByPlaceholderText('Search by name...');
      await user.type(searchInput, 'bob');

      await waitFor(() => {
        expect(screen.getByText('Bob Baker')).toBeInTheDocument();
        expect(screen.queryByText('Alice Anderson')).not.toBeInTheDocument();
        expect(screen.queryByText('Charlie Clark')).not.toBeInTheDocument();
      });
    });

    it('should call onReplaceManual with correct parameters', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Switch to manual and select player
      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
      });

      const aliceCard = screen.getByText('Alice Anderson').closest('div')!;
      await user.click(aliceCard);

      // Confirm replacement
      const confirmButton = screen.getByRole('button', {
        name: /Replace with Selected/i,
      });
      await user.click(confirmButton);

      expect(mockOnReplaceManual).toHaveBeenCalledWith(1, 1);
    });

    it('should disable confirm button when no player selected in manual mode', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Switch to manual mode
      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', {
        name: /Replace with Selected/i,
      });
      expect(confirmButton).toBeDisabled();
    });

    it('should enable confirm button when player selected', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Switch to manual and select player
      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', {
        name: /Replace with Selected/i,
      });
      expect(confirmButton).toBeDisabled();

      const aliceCard = screen.getByText('Alice Anderson').closest('div')!;
      await user.click(aliceCard);

      await waitFor(() => {
        expect(confirmButton).not.toBeDisabled();
      });
    });

    it('should close modal after successful manual replacement', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Switch to manual and select player
      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
      });

      const aliceCard = screen.getByText('Alice Anderson').closest('div')!;
      await user.click(aliceCard);

      const confirmButton = screen.getByRole('button', {
        name: /Replace with Selected/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should show loading state while fetching players', async () => {
      const user = userEvent.setup();
      let resolveApi: (value: unknown) => void;
      const apiPromise = new Promise((resolve) => {
        resolveApi = resolve;
      });
      vi.mocked(apiModule.apiRequest).mockReturnValue(apiPromise);

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Switch to manual mode
      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('Loading players...')).toBeInTheDocument();
      });

      resolveApi!({ players: mockPlayers, total: 3 });

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
      });
    });

    it('should show no players found when search has no results', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Switch to manual mode
      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by name...');
      await user.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No players found')).toBeInTheDocument();
      });
    });
  });

  describe('Cancel and Close', () => {
    it('should call onClose when cancel button clicked', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset to random mode when modal closes', async () => {
      const user = userEvent.setup();
      const { unmount } = render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Switch to manual mode
      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
      });

      // Close and reopen
      unmount();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Should be back in random mode
      expect(
        screen.getByText(/A random player from the eligible audience pool/),
      ).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show error toast when player fetch fails', async () => {
      const user = userEvent.setup();
      const showToast = await import('../utils/toast');
      vi.mocked(apiModule.apiRequest).mockRejectedValue(new Error('Network error'));

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Switch to manual mode to trigger fetch
      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(showToast.showToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Network error',
          type: 'error',
        });
      });
    });

    it('should show error toast when random replacement fails', async () => {
      const user = userEvent.setup();
      const showToast = await import('../utils/toast');
      mockOnReplaceRandom.mockRejectedValue(new Error('Failed to replace contestant'));

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      const confirmButton = screen.getByRole('button', {
        name: /Replace Random/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(showToast.showToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to replace contestant',
          type: 'error',
        });
      });

      // Modal should not close on error
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should show error toast when manual replacement fails', async () => {
      const user = userEvent.setup();
      const showToast = await import('../utils/toast');
      mockOnReplaceManual.mockRejectedValue(new Error('Failed to replace contestant'));

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Switch to manual and select player
      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
      });

      const aliceCard = screen.getByText('Alice Anderson').closest('div')!;
      await user.click(aliceCard);

      const confirmButton = screen.getByRole('button', {
        name: /Replace with Selected/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(showToast.showToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to replace contestant',
          type: 'error',
        });
      });

      // Modal should not close on error
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Additional Edge Cases', () => {
    it('should reset state when switching between modes', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Switch to manual and select a player
      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
      });

      // Switch back to random
      const randomButton = screen.getByRole('button', {
        name: /Random Selection/i,
      });
      await user.click(randomButton);

      // Should show random mode description
      expect(
        screen.getByText(/A random player from the eligible audience pool/),
      ).toBeInTheDocument();
    });

    it('should handle empty players array in manual mode', async () => {
      const user = userEvent.setup();
      vi.mocked(apiModule.apiRequest).mockResolvedValue({
        players: [],
        total: 0,
      });

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('No players found')).toBeInTheDocument();
      });
    });

    it('should not fetch players until switching to manual mode', () => {
      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Should not fetch in random mode
      expect(apiModule.apiRequest).not.toHaveBeenCalled();
    });

    it('should handle rapid mode switching without duplicate API calls', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      const randomButton = screen.getByRole('button', {
        name: /Random Selection/i,
      });

      // Rapid switching
      await user.click(manualButton);
      await user.click(randomButton);
      await user.click(manualButton);

      // Should only fetch when entering manual mode (2 times)
      await waitFor(() => {
        expect(apiModule.apiRequest).toHaveBeenCalledTimes(2);
      });
    });

    it('should show correct button text for each mode', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Random mode button text
      expect(screen.getByRole('button', { name: /Replace Random/i })).toBeInTheDocument();

      // Switch to manual
      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Replace with Selected/i })).toBeInTheDocument();
      });
    });

    it('should handle search filter with zero results in manual mode', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search by name...');
      await user.type(searchInput, 'nonexistent player name');

      await waitFor(() => {
        expect(screen.getByText('No players found')).toBeInTheDocument();
      });
    });

    it('should display correct contestant position in preview', async () => {
      const user = userEvent.setup();

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={mockContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      const manualButton = screen.getByRole('button', {
        name: /Manual Selection/i,
      });
      await user.click(manualButton);

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
      });

      const aliceCard = screen.getByText('Alice Anderson').closest('div')!;
      await user.click(aliceCard);

      await waitFor(() => {
        const preview = screen.getByText('Replacement Preview').closest('div')!;
        // Should show the contestant's position (2), not the new player's ID
        expect(preview).toHaveTextContent('Position: 2');
      });
    });

    it('should handle contestant with different position', async () => {
      const differentPositionContestant: typeof mockContestant = {
        ...mockContestant,
        position: 4,
      };

      render(
        <ReplaceContestantModal
          isOpen={true}
          onClose={mockOnClose}
          contestant={differentPositionContestant}
          onReplaceRandom={mockOnReplaceRandom}
          onReplaceManual={mockOnReplaceManual}
        />,
      );

      // Should display position correctly
      expect(screen.getByText(/Position:/)).toBeInTheDocument();
      expect(screen.getByText(/4/)).toBeInTheDocument();
    });
  });
});
