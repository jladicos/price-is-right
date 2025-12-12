import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import { PodiumDisplay } from './PodiumDisplay';
import type { ContestantWithPlayer, BidWithPlayer } from '../store/gameStore';

describe('PodiumDisplay', () => {
  const mockContestant: ContestantWithPlayer = {
    id: 1,
    player_id: 10,
    position: 1,
    game_segment: 'section_1',
    status: 'active',
    added_at: '2024-01-01T00:00:00Z',
    revealed_at: '2024-01-01T00:01:00Z',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    first_name: 'John',
    last_name: 'Doe',
    photo_filename: 'john_doe.jpg',
    role: 'player',
  };

  const mockBid: BidWithPlayer = {
    id: 1,
    player_id: 10,
    product_id: 'simply-mango',
    round_number: 1,
    game_segment: 'section_1',
    bid_amount: 4,
    is_locked: 1,
    is_winner: 0,
    retry_number: 0,
    created_at: '2024-01-01T00:02:00Z',
    first_name: 'John',
    last_name: 'Doe',
    photo_filename: 'john_doe.jpg',
    position: 1,
  };

  describe('Empty Podium', () => {
    it('should render empty podium when no contestant', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={null}
          bid={null}
          isCurrentBidder={false}
          isWinner={false}
          role="host"
        />,
      );

      expect(screen.getByTestId('podium-1-empty')).toBeInTheDocument();
      // Position numbers were removed from podiums
    });
  });

  describe('Pending Reveal', () => {
    it('should show reveal button only when shouldShowRevealButton is true', () => {
      const onRevealContestant = vi.fn();
      const pendingContestant = { ...mockContestant, status: 'pending_reveal' };

      const { rerender } = render(
        <PodiumDisplay
          position={1}
          contestant={pendingContestant}
          bid={null}
          isCurrentBidder={false}
          isWinner={false}
          role="host"
          shouldShowRevealButton={false}
          onRevealContestant={onRevealContestant}
        />,
      );

      expect(screen.queryByTestId('reveal-contestant-1')).not.toBeInTheDocument();

      rerender(
        <PodiumDisplay
          position={1}
          contestant={pendingContestant}
          bid={null}
          isCurrentBidder={false}
          isWinner={false}
          role="host"
          shouldShowRevealButton={true}
          onRevealContestant={onRevealContestant}
        />,
      );

      expect(screen.getByTestId('reveal-contestant-1')).toBeInTheDocument();
    });

    it('should call onRevealContestant when button clicked', () => {
      const onRevealContestant = vi.fn();
      const pendingContestant = { ...mockContestant, status: 'pending_reveal' };

      render(
        <PodiumDisplay
          position={1}
          contestant={pendingContestant}
          bid={null}
          isCurrentBidder={false}
          isWinner={false}
          role="host"
          shouldShowRevealButton={true}
          onRevealContestant={onRevealContestant}
        />,
      );

      fireEvent.click(screen.getByTestId('reveal-contestant-1'));
      expect(onRevealContestant).toHaveBeenCalledWith(1);
    });
  });

  describe('Active Contestant', () => {
    it('should display contestant name', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={false}
          isWinner={false}
          role="audience"
        />,
      );

      expect(screen.getByText('John')).toBeInTheDocument();
    });

    it('should show bid input when current bidder and conditions met', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      expect(screen.getByTestId('bid-input-1')).toBeInTheDocument();
    });

    it('should NOT show bid input if product not shown', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={false}
        />,
      );

      expect(screen.queryByTestId('bid-input-1')).not.toBeInTheDocument();
    });

    it('should show bid amount when bid exists', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={mockBid}
          isCurrentBidder={false}
          isWinner={false}
          role="audience"
        />,
      );

      expect(screen.getByTestId('bid-amount-1')).toHaveTextContent('4');
    });
  });

  describe('Bid Submission (Player)', () => {
    it('should call onBidSubmit when player submits bid', () => {
      const onBidSubmit = vi.fn();

      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={true}
          onBidSubmit={onBidSubmit}
        />,
      );

      const input = screen.getByTestId('bid-input-1');
      const submitButton = screen.getByTestId('bid-submit-1');

      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.click(submitButton);

      expect(onBidSubmit).toHaveBeenCalledWith(1, 5);
    });

    it('should submit bid when player presses Enter', () => {
      const onBidSubmit = vi.fn();

      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={true}
          onBidSubmit={onBidSubmit}
        />,
      );

      const input = screen.getByTestId('bid-input-1');

      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onBidSubmit).toHaveBeenCalledWith(1, 5);
    });

    it('should show submit button for player but not host', () => {
      const { rerender } = render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      expect(screen.getByTestId('bid-submit-1')).toBeInTheDocument();

      rerender(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="host"
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      expect(screen.queryByTestId('bid-submit-1')).not.toBeInTheDocument();
    });
  });

  describe('Bid Editing (Host)', () => {
    it('should enter edit mode when host clicks bid', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={mockBid}
          isCurrentBidder={false}
          isWinner={false}
          role="host"
        />,
      );

      const bidDisplay = screen.getByTestId('digital-display-1');
      fireEvent.click(bidDisplay);

      // Should show input with current bid value
      expect(screen.getByTestId('bid-input-1')).toBeInTheDocument();
      expect(screen.getByTestId('bid-input-1')).toHaveValue(4);
    });

    it('should call onUpdateBid when host edits bid', () => {
      const onUpdateBid = vi.fn();

      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={mockBid}
          isCurrentBidder={false}
          isWinner={false}
          role="host"
          onUpdateBid={onUpdateBid}
        />,
      );

      const bidDisplay = screen.getByTestId('digital-display-1');
      fireEvent.click(bidDisplay);

      const input = screen.getByTestId('bid-input-1');
      fireEvent.change(input, { target: { value: '6' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onUpdateBid).toHaveBeenCalledWith(1, 6);
    });

    it('should exit edit mode when host presses Escape', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={mockBid}
          isCurrentBidder={false}
          isWinner={false}
          role="host"
        />,
      );

      const bidDisplay = screen.getByTestId('digital-display-1');
      fireEvent.click(bidDisplay);

      expect(screen.getByTestId('bid-input-1')).toBeInTheDocument();

      const input = screen.getByTestId('bid-input-1');
      fireEvent.keyDown(input, { key: 'Escape' });

      // Should show bid amount again, not input
      expect(screen.queryByTestId('bid-input-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('bid-amount-1')).toBeInTheDocument();
    });
  });

  describe('Winner Display', () => {
    it('should show WINNER badge when isWinner is true', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={mockBid}
          isCurrentBidder={false}
          isWinner={true}
          role="audience"
        />,
      );

      expect(screen.getByTestId('winner-label-1')).toBeInTheDocument();
      expect(screen.getByText('WINNER!')).toBeInTheDocument();
    });

    it('should replace name with WINNER badge', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={mockBid}
          isCurrentBidder={false}
          isWinner={true}
          role="audience"
        />,
      );

      // Name should not be displayed (replaced by badge)
      expect(screen.queryByText('John')).not.toBeInTheDocument();
      expect(screen.getByText('WINNER!')).toBeInTheDocument();
    });

    it('should mark podium with data-winner attribute', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={mockBid}
          isCurrentBidder={false}
          isWinner={true}
          role="audience"
        />,
      );

      const podium = screen.getByTestId('podium-1');
      expect(podium).toHaveAttribute('data-winner', 'true');
    });
  });

  describe('Replace Button (Host)', () => {
    it('should show replace button for host', () => {
      const onReplaceRandom = vi.fn();
      const onReplaceManual = vi.fn();

      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={false}
          isWinner={false}
          role="host"
          canReplaceContestants={true}
          onReplaceContestantRandom={onReplaceRandom}
          onReplaceContestantManual={onReplaceManual}
        />,
      );

      expect(screen.getByTestId('manage-contestant-1')).toBeInTheDocument();
    });

    it('should call onReplaceContestant when button clicked', async () => {
      const user = userEvent.setup();
      const onReplaceRandom = vi.fn();
      const onReplaceManual = vi.fn();

      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={false}
          isWinner={false}
          role="host"
          canReplaceContestants={true}
          onReplaceContestantRandom={onReplaceRandom}
          onReplaceContestantManual={onReplaceManual}
        />,
      );

      // Click the menu button
      const menuButton = screen.getByTestId('manage-contestant-1');
      await user.click(menuButton);

      // Menu should open with both options
      expect(screen.getByText('Replace with Random')).toBeInTheDocument();
      expect(screen.getByText('Replace with Manual')).toBeInTheDocument();

      // Click random option
      await user.click(screen.getByText('Replace with Random'));
      expect(onReplaceRandom).toHaveBeenCalledWith(mockContestant.id);
    });

    it('should not show replace button for non-host', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={false}
          isWinner={false}
          role="player"
        />,
      );

      expect(screen.queryByTestId('replace-contestant-1')).not.toBeInTheDocument();
    });
  });

  describe('Bid Validation (Critical)', () => {
    it('should reject negative bid amounts', () => {
      const onBidSubmit = vi.fn();

      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={true}
          onBidSubmit={onBidSubmit}
        />,
      );

      const input = screen.getByTestId('bid-input-1');
      const submitButton = screen.getByTestId('bid-submit-1');

      fireEvent.change(input, { target: { value: '-5' } });
      fireEvent.click(submitButton);

      // Should NOT call onBidSubmit for negative values
      expect(onBidSubmit).not.toHaveBeenCalled();
    });

    it('should reject zero bids', () => {
      const onBidSubmit = vi.fn();

      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={true}
          onBidSubmit={onBidSubmit}
        />,
      );

      const input = screen.getByTestId('bid-input-1');
      const submitButton = screen.getByTestId('bid-submit-1');

      fireEvent.change(input, { target: { value: '0' } });
      fireEvent.click(submitButton);

      expect(onBidSubmit).not.toHaveBeenCalled();
    });

    it('should reject empty string bids', () => {
      const onBidSubmit = vi.fn();

      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={true}
          onBidSubmit={onBidSubmit}
        />,
      );

      const input = screen.getByTestId('bid-input-1');
      const submitButton = screen.getByTestId('bid-submit-1');

      fireEvent.change(input, { target: { value: '' } });
      fireEvent.click(submitButton);

      expect(onBidSubmit).not.toHaveBeenCalled();
    });

    it('should reject non-numeric bids', () => {
      const onBidSubmit = vi.fn();

      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={true}
          onBidSubmit={onBidSubmit}
        />,
      );

      const input = screen.getByTestId('bid-input-1');
      const submitButton = screen.getByTestId('bid-submit-1');

      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.click(submitButton);

      expect(onBidSubmit).not.toHaveBeenCalled();
    });

    it('should truncate decimal inputs via parseInt', () => {
      const onBidSubmit = vi.fn();

      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={true}
          onBidSubmit={onBidSubmit}
        />,
      );

      const input = screen.getByTestId('bid-input-1');
      const submitButton = screen.getByTestId('bid-submit-1');

      fireEvent.change(input, { target: { value: '4.7' } });
      fireEvent.click(submitButton);

      // parseInt('4.7', 10) = 4
      expect(onBidSubmit).toHaveBeenCalledWith(1, 4);
    });

    it('should handle very large numbers', () => {
      const onBidSubmit = vi.fn();

      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={true}
          onBidSubmit={onBidSubmit}
        />,
      );

      const input = screen.getByTestId('bid-input-1');
      const submitButton = screen.getByTestId('bid-submit-1');

      fireEvent.change(input, { target: { value: '999999' } });
      fireEvent.click(submitButton);

      expect(onBidSubmit).toHaveBeenCalledWith(1, 999999);
    });

    it('should reject bid with leading non-numeric characters', () => {
      const onBidSubmit = vi.fn();

      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={true}
          onBidSubmit={onBidSubmit}
        />,
      );

      const input = screen.getByTestId('bid-input-1');
      const submitButton = screen.getByTestId('bid-submit-1');

      fireEvent.change(input, { target: { value: '$5' } });
      fireEvent.click(submitButton);

      // parseInt('$5', 10) = NaN
      expect(onBidSubmit).not.toHaveBeenCalled();
    });

    it('should validate on Enter key press', () => {
      const onBidSubmit = vi.fn();

      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={true}
          onBidSubmit={onBidSubmit}
        />,
      );

      const input = screen.getByTestId('bid-input-1');

      // Test negative via Enter
      fireEvent.change(input, { target: { value: '-10' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onBidSubmit).not.toHaveBeenCalled();

      // Test valid via Enter
      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onBidSubmit).toHaveBeenCalledWith(1, 5);
    });
  });

  describe('Edit Mode State Management (Critical)', () => {
    it('should handle editing to invalid values', () => {
      const onUpdateBid = vi.fn();

      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={mockBid}
          isCurrentBidder={false}
          isWinner={false}
          role="host"
          onUpdateBid={onUpdateBid}
        />,
      );

      const bidDisplay = screen.getByTestId('digital-display-1');
      fireEvent.click(bidDisplay);

      const input = screen.getByTestId('bid-input-1');

      // Try to edit to negative
      fireEvent.change(input, { target: { value: '-5' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onUpdateBid).not.toHaveBeenCalled();

      // Try to edit to zero
      fireEvent.change(input, { target: { value: '0' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onUpdateBid).not.toHaveBeenCalled();

      // Try to edit to non-numeric
      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onUpdateBid).not.toHaveBeenCalled();
    });

    it('should reset state properly on Escape', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={mockBid}
          isCurrentBidder={false}
          isWinner={false}
          role="host"
        />,
      );

      const bidDisplay = screen.getByTestId('digital-display-1');
      fireEvent.click(bidDisplay);

      expect(screen.getByTestId('bid-input-1')).toHaveValue(4);

      // Change the value
      const input = screen.getByTestId('bid-input-1');
      fireEvent.change(input, { target: { value: '10' } });

      // Press Escape
      fireEvent.keyDown(input, { key: 'Escape' });

      // Should exit edit mode and show original bid
      expect(screen.queryByTestId('bid-input-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('bid-amount-1')).toHaveTextContent('4');
    });

    it('should handle multiple edit attempts', () => {
      const onUpdateBid = vi.fn();

      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={mockBid}
          isCurrentBidder={false}
          isWinner={false}
          role="host"
          onUpdateBid={onUpdateBid}
        />,
      );

      const bidDisplay = screen.getByTestId('digital-display-1');

      // First edit
      fireEvent.click(bidDisplay);
      let input = screen.getByTestId('bid-input-1');
      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onUpdateBid).toHaveBeenCalledWith(1, 5);

      // Should exit edit mode after successful submit
      expect(screen.queryByTestId('bid-input-1')).not.toBeInTheDocument();
    });
  });

  describe('Callback Safety (Critical)', () => {
    it('should handle undefined onBidSubmit gracefully', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={true}
          // onBidSubmit is undefined
        />,
      );

      const input = screen.getByTestId('bid-input-1');
      const submitButton = screen.getByTestId('bid-submit-1');

      fireEvent.change(input, { target: { value: '5' } });

      // Should not crash
      expect(() => {
        fireEvent.click(submitButton);
      }).not.toThrow();
    });

    it('should handle undefined onUpdateBid gracefully', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={mockBid}
          isCurrentBidder={false}
          isWinner={false}
          role="host"
          // onUpdateBid is undefined
        />,
      );

      const bidDisplay = screen.getByTestId('digital-display-1');
      fireEvent.click(bidDisplay);

      const input = screen.getByTestId('bid-input-1');
      fireEvent.change(input, { target: { value: '6' } });

      // Should not crash
      expect(() => {
        fireEvent.keyDown(input, { key: 'Enter' });
      }).not.toThrow();
    });

    it('should handle undefined onRevealContestant gracefully', () => {
      const pendingContestant = { ...mockContestant, status: 'pending_reveal' };

      // Should not crash when rendering without callback
      expect(() => {
        render(
          <PodiumDisplay
            position={1}
            contestant={pendingContestant}
            bid={null}
            isCurrentBidder={false}
            isWinner={false}
            role="host"
            shouldShowRevealButton={true}
            // onRevealContestant is undefined
          />,
        );
      }).not.toThrow();

      // Button should not appear when callback is undefined (checked in component logic line 166)
      expect(screen.queryByTestId('reveal-contestant-1')).not.toBeInTheDocument();
    });

    it('should handle undefined onReplaceContestant gracefully', () => {
      // Should not crash when rendering without callback
      expect(() => {
        render(
          <PodiumDisplay
            position={1}
            contestant={mockContestant}
            bid={null}
            isCurrentBidder={false}
            isWinner={false}
            role="host"
            // onReplaceContestant is undefined
          />,
        );
      }).not.toThrow();

      // Button should not appear when callback is undefined
      expect(screen.queryByTestId('replace-contestant-1')).not.toBeInTheDocument();
    });
  });

  describe('Current Bidder Logic - All Conditions (Critical)', () => {
    it('should not show input if not current bidder', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={false} // Not current bidder
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      expect(screen.queryByTestId('bid-input-1')).not.toBeInTheDocument();
    });

    it('should not show input if player IDs do not match', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant} // player_id: 10
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={999} // Different player
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      expect(screen.queryByTestId('bid-input-1')).not.toBeInTheDocument();
    });

    it('should not show input if bid already exists', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={mockBid} // Bid exists
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      expect(screen.queryByTestId('bid-input-1')).not.toBeInTheDocument();
    });

    it('should not show input if not all contestants revealed', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={false} // Not all revealed
          productHasBeenShown={true}
        />,
      );

      expect(screen.queryByTestId('bid-input-1')).not.toBeInTheDocument();
    });

    it('should require BOTH allRevealed AND productShown', () => {
      const { rerender } = render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={false}
        />,
      );

      // Should not show when productShown=false
      expect(screen.queryByTestId('bid-input-1')).not.toBeInTheDocument();

      rerender(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={false}
          productHasBeenShown={true}
        />,
      );

      // Should not show when allRevealed=false
      expect(screen.queryByTestId('bid-input-1')).not.toBeInTheDocument();

      rerender(
        <PodiumDisplay
          position={1}
          contestant={mockContestant}
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="player"
          currentPlayerId={10}
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      // Should show when BOTH are true
      expect(screen.getByTestId('bid-input-1')).toBeInTheDocument();
    });

    it('should allow host to input bid for any player', () => {
      render(
        <PodiumDisplay
          position={1}
          contestant={mockContestant} // player_id: 10
          bid={null}
          isCurrentBidder={true}
          isWinner={false}
          role="host"
          currentPlayerId={999} // Different player, but host can still input
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      expect(screen.getByTestId('bid-input-1')).toBeInTheDocument();
    });
  });
});
