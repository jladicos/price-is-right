import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import { PodiumsRow } from './PodiumsRow';
import type { ContestantWithPlayer, BidWithPlayer } from '../store/gameStore';

describe('PodiumsRow', () => {
  const createMockContestant = (position: number, status = 'active'): ContestantWithPlayer => ({
    id: position,
    player_id: position + 100,
    position,
    game_segment: 'section_1',
    status,
    added_at: `2024-01-01T00:0${position}:00Z`,
    revealed_at: status === 'active' ? `2024-01-01T00:0${position}:30Z` : null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    first_name: `Player${position}`,
    last_name: 'Test',
    photo_filename: `player${position}.jpg`,
    role: 'player',
  });

  const createMockBid = (position: number, amount: number): BidWithPlayer => ({
    id: position,
    player_id: position + 100,
    product_id: 'test-product',
    round_number: 1,
    game_segment: 'section_1',
    bid_amount: amount,
    is_locked: 1,
    is_winner: 0,
    retry_number: 0,
    created_at: `2024-01-01T00:1${position}:00Z`,
    first_name: `Player${position}`,
    last_name: 'Test',
    photo_filename: `player${position}.jpg`,
    position,
  });

  describe('Rendering', () => {
    it('should render 5 podium positions', () => {
      render(
        <PodiumsRow
          contestants={[]}
          bids={[]}
          currentBidderPosition={null}
          winnerPosition={null}
          role="audience"
        />,
      );

      expect(screen.getByTestId('podiums-row')).toBeInTheDocument();

      // All 5 positions should be rendered (empty in this case)
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByTestId(`podium-${i}-empty`)).toBeInTheDocument();
      }
    });

    it('should render contestants at their positions', () => {
      const contestants = [
        createMockContestant(1),
        createMockContestant(2),
        createMockContestant(3),
      ];

      render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={null}
          winnerPosition={null}
          role="audience"
        />,
      );

      // Positions 1-3 should show contestants
      expect(screen.getByTestId('podium-1')).toBeInTheDocument();
      expect(screen.getByTestId('podium-2')).toBeInTheDocument();
      expect(screen.getByTestId('podium-3')).toBeInTheDocument();

      // Positions 4-5 should be empty
      expect(screen.getByTestId('podium-4-empty')).toBeInTheDocument();
      expect(screen.getByTestId('podium-5-empty')).toBeInTheDocument();

      // Check contestant names are displayed
      expect(screen.getByText('Player1')).toBeInTheDocument();
      expect(screen.getByText('Player2')).toBeInTheDocument();
      expect(screen.getByText('Player3')).toBeInTheDocument();
    });
  });

  describe('Contestant Reveal Order', () => {
    it('should show reveal button on leftmost pending contestant', () => {
      const contestants = [
        createMockContestant(1, 'active'),
        createMockContestant(2, 'pending_reveal'),
        createMockContestant(3, 'pending_reveal'),
        createMockContestant(4, 'pending_reveal'),
        createMockContestant(5, 'pending_reveal'),
      ];

      const onRevealContestant = vi.fn();

      render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={null}
          winnerPosition={null}
          role="host"
          onRevealContestant={onRevealContestant}
        />,
      );

      // Only position 2 (leftmost pending) should have reveal button
      expect(screen.queryByTestId('reveal-contestant-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('reveal-contestant-2')).toBeInTheDocument();
      expect(screen.queryByTestId('reveal-contestant-3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reveal-contestant-4')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reveal-contestant-5')).not.toBeInTheDocument();
    });

    it('should move reveal button to next pending after revealing', () => {
      const contestants = [
        createMockContestant(1, 'active'),
        createMockContestant(2, 'active'),
        createMockContestant(3, 'active'),
        createMockContestant(4, 'pending_reveal'),
        createMockContestant(5, 'pending_reveal'),
      ];

      const onRevealContestant = vi.fn();

      render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={null}
          winnerPosition={null}
          role="host"
          onRevealContestant={onRevealContestant}
        />,
      );

      // Position 4 (leftmost pending) should have reveal button
      expect(screen.getByTestId('reveal-contestant-4')).toBeInTheDocument();
      expect(screen.queryByTestId('reveal-contestant-5')).not.toBeInTheDocument();
    });

    it('should not show any reveal button when all revealed', () => {
      const contestants = [
        createMockContestant(1, 'active'),
        createMockContestant(2, 'active'),
        createMockContestant(3, 'active'),
        createMockContestant(4, 'active'),
        createMockContestant(5, 'active'),
      ];

      render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={null}
          winnerPosition={null}
          role="host"
        />,
      );

      // No reveal buttons should be present
      for (let i = 1; i <= 5; i++) {
        expect(screen.queryByTestId(`reveal-contestant-${i}`)).not.toBeInTheDocument();
      }
    });
  });

  describe('Bidding Display', () => {
    it('should display bids at correct positions', () => {
      const contestants = [
        createMockContestant(1),
        createMockContestant(2),
        createMockContestant(3),
      ];

      const bids = [createMockBid(1, 4), createMockBid(2, 5)];

      render(
        <PodiumsRow
          contestants={contestants}
          bids={bids}
          currentBidderPosition={null}
          winnerPosition={null}
          role="audience"
        />,
      );

      // Positions 1 and 2 should show bids
      expect(screen.getByTestId('bid-amount-1')).toHaveTextContent('4');
      expect(screen.getByTestId('bid-amount-2')).toHaveTextContent('5');

      // Position 3 should show no bid (---)
      const display3 = screen.getByTestId('digital-display-3');
      expect(display3).toHaveTextContent('---');
    });

    it('should match bids to contestants by player_id', () => {
      // Contestants at positions 1, 3, 5
      const contestants = [
        createMockContestant(1), // player_id: 101
        createMockContestant(3), // player_id: 103
        createMockContestant(5), // player_id: 105
      ];

      // Bids for player_ids 101 and 105
      const bids = [
        createMockBid(1, 4), // player_id: 101
        createMockBid(5, 6), // player_id: 105
      ];

      render(
        <PodiumsRow
          contestants={contestants}
          bids={bids}
          currentBidderPosition={null}
          winnerPosition={null}
          role="audience"
        />,
      );

      // Position 1 should have bid
      expect(screen.getByTestId('bid-amount-1')).toHaveTextContent('4');

      // Position 3 should have no bid
      const display3 = screen.getByTestId('digital-display-3');
      expect(display3).toHaveTextContent('---');

      // Position 5 should have bid
      expect(screen.getByTestId('bid-amount-5')).toHaveTextContent('6');
    });
  });

  describe('Current Bidder Indication', () => {
    it('should mark correct podium as current bidder', () => {
      const contestants = [
        createMockContestant(1),
        createMockContestant(2),
        createMockContestant(3),
      ];

      render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={2}
          winnerPosition={null}
          role="audience"
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      const podium2 = screen.getByTestId('podium-2');
      expect(podium2).toHaveAttribute('data-current', 'true');
    });
  });

  describe('Winner Display', () => {
    it('should mark correct podium as winner', () => {
      const contestants = [
        createMockContestant(1),
        createMockContestant(2),
        createMockContestant(3),
      ];

      const bids = [createMockBid(1, 4), createMockBid(2, 5), createMockBid(3, 3)];

      render(
        <PodiumsRow
          contestants={contestants}
          bids={bids}
          currentBidderPosition={null}
          winnerPosition={2}
          role="audience"
        />,
      );

      const podium2 = screen.getByTestId('podium-2');
      expect(podium2).toHaveAttribute('data-winner', 'true');

      // Winner label should be visible
      expect(screen.getByTestId('winner-label-2')).toBeInTheDocument();
    });
  });

  describe('Props Propagation', () => {
    it('should pass allContestantsRevealed to all podiums', () => {
      const contestants = [createMockContestant(1), createMockContestant(2)];

      render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={1}
          winnerPosition={null}
          role="host"
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      // When all contestants revealed and product shown,
      // current bidder should show input
      expect(screen.getByTestId('bid-input-1')).toBeInTheDocument();
    });

    it('should prevent bid input when product not shown', () => {
      const contestants = [createMockContestant(1)];

      render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={1}
          winnerPosition={null}
          role="host"
          allContestantsRevealed={true}
          productHasBeenShown={false}
        />,
      );

      // Should not show input when product not shown
      expect(screen.queryByTestId('bid-input-1')).not.toBeInTheDocument();
    });
  });

  describe('Bid Matching Edge Cases (Critical)', () => {
    it('should handle bid with no matching contestant', () => {
      const contestants = [
        createMockContestant(1), // player_id: 101
      ];

      const bids = [
        createMockBid(2, 5), // player_id: 102 (no match)
      ];

      render(
        <PodiumsRow
          contestants={contestants}
          bids={bids}
          currentBidderPosition={null}
          winnerPosition={null}
          role="audience"
        />,
      );

      // Position 1 should show contestant but no bid (---)
      expect(screen.getByText('Player1')).toBeInTheDocument();
      const display1 = screen.getByTestId('digital-display-1');
      expect(display1).toHaveTextContent('---');

      // Position 2 should be empty
      expect(screen.getByTestId('podium-2-empty')).toBeInTheDocument();
    });

    it('should handle contestant at non-sequential positions', () => {
      const contestants = [
        createMockContestant(1), // player_id: 101
        createMockContestant(3), // player_id: 103
        createMockContestant(5), // player_id: 105
      ];

      const bids = [createMockBid(1, 4), createMockBid(5, 6)];

      render(
        <PodiumsRow
          contestants={contestants}
          bids={bids}
          currentBidderPosition={null}
          winnerPosition={null}
          role="audience"
        />,
      );

      // Position 1 should have bid
      expect(screen.getByTestId('bid-amount-1')).toHaveTextContent('4');

      // Position 2 should be empty
      expect(screen.getByTestId('podium-2-empty')).toBeInTheDocument();

      // Position 3 should have contestant but no bid
      expect(screen.getByText('Player3')).toBeInTheDocument();
      const display3 = screen.getByTestId('digital-display-3');
      expect(display3).toHaveTextContent('---');

      // Position 4 should be empty
      expect(screen.getByTestId('podium-4-empty')).toBeInTheDocument();

      // Position 5 should have bid
      expect(screen.getByTestId('bid-amount-5')).toHaveTextContent('6');
    });

    it('should display duplicate bid amounts at different positions', () => {
      const contestants = [
        createMockContestant(1),
        createMockContestant(2),
        createMockContestant(3),
      ];

      const bids = [
        createMockBid(1, 4),
        createMockBid(2, 4), // Duplicate amount
        createMockBid(3, 5),
      ];

      render(
        <PodiumsRow
          contestants={contestants}
          bids={bids}
          currentBidderPosition={null}
          winnerPosition={null}
          role="audience"
        />,
      );

      // Both should display (backend should reject, but UI shows)
      expect(screen.getByTestId('bid-amount-1')).toHaveTextContent('4');
      expect(screen.getByTestId('bid-amount-2')).toHaveTextContent('4');
      expect(screen.getByTestId('bid-amount-3')).toHaveTextContent('5');
    });
  });

  describe('Reveal Order Edge Cases (Critical)', () => {
    it('should show reveal on position 1 when all pending', () => {
      const contestants = [
        createMockContestant(1, 'pending_reveal'),
        createMockContestant(2, 'pending_reveal'),
        createMockContestant(3, 'pending_reveal'),
        createMockContestant(4, 'pending_reveal'),
        createMockContestant(5, 'pending_reveal'),
      ];

      const onRevealContestant = vi.fn();

      render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={null}
          winnerPosition={null}
          role="host"
          onRevealContestant={onRevealContestant}
        />,
      );

      // Should show reveal button on position 1 (leftmost)
      expect(screen.getByTestId('reveal-contestant-1')).toBeInTheDocument();
      expect(screen.queryByTestId('reveal-contestant-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reveal-contestant-3')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reveal-contestant-4')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reveal-contestant-5')).not.toBeInTheDocument();
    });

    it('should handle empty contestants array', () => {
      render(
        <PodiumsRow
          contestants={[]}
          bids={[]}
          currentBidderPosition={null}
          winnerPosition={null}
          role="audience"
        />,
      );

      // Should render 5 empty podiums
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByTestId(`podium-${i}-empty`)).toBeInTheDocument();
      }
    });

    it('should handle only one contestant', () => {
      const contestants = [
        createMockContestant(3), // Only position 3
      ];

      render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={null}
          winnerPosition={null}
          role="audience"
        />,
      );

      // Positions 1, 2 should be empty
      expect(screen.getByTestId('podium-1-empty')).toBeInTheDocument();
      expect(screen.getByTestId('podium-2-empty')).toBeInTheDocument();

      // Position 3 should have contestant
      expect(screen.getByTestId('podium-3')).toBeInTheDocument();
      expect(screen.getByText('Player3')).toBeInTheDocument();

      // Positions 4, 5 should be empty
      expect(screen.getByTestId('podium-4-empty')).toBeInTheDocument();
      expect(screen.getByTestId('podium-5-empty')).toBeInTheDocument();
    });
  });

  describe('Current Bidder and Winner Edge Cases (Critical)', () => {
    it('should handle currentBidderPosition out of range (too high)', () => {
      const contestants = [createMockContestant(1), createMockContestant(2)];

      render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={6} // Out of range
          winnerPosition={null}
          role="host"
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      // Should not crash, no podium should be marked as current
      expect(screen.queryByTestId('bid-input-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('bid-input-2')).not.toBeInTheDocument();
    });

    it('should handle currentBidderPosition at zero', () => {
      const contestants = [createMockContestant(1)];

      render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={0} // Invalid position
          winnerPosition={null}
          role="host"
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      // Should not crash
      expect(screen.queryByTestId('bid-input-1')).not.toBeInTheDocument();
    });

    it('should handle currentBidderPosition at empty position', () => {
      const contestants = [createMockContestant(1), createMockContestant(3)];

      render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={2} // No contestant at position 2
          winnerPosition={null}
          role="host"
          allContestantsRevealed={true}
          productHasBeenShown={true}
        />,
      );

      // Position 2 should be empty, no input shown
      expect(screen.getByTestId('podium-2-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('bid-input-2')).not.toBeInTheDocument();
    });

    it('should handle winnerPosition out of range', () => {
      const contestants = [createMockContestant(1), createMockContestant(2)];

      render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={null}
          winnerPosition={10} // Out of range
          role="audience"
        />,
      );

      // Should not crash, no podium should be marked as winner
      expect(screen.queryByTestId('winner-label-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('winner-label-2')).not.toBeInTheDocument();
    });

    it('should handle winnerPosition at empty position', () => {
      const contestants = [createMockContestant(1), createMockContestant(3)];

      render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={null}
          winnerPosition={2} // No contestant at position 2
          role="audience"
        />,
      );

      // Position 2 is empty, no winner display
      expect(screen.getByTestId('podium-2-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('winner-label-2')).not.toBeInTheDocument();
    });
  });

  describe('Props Propagation to All Podiums (Critical)', () => {
    it('should pass all callbacks to all 5 podiums', async () => {
      const contestants = [createMockContestant(1), createMockContestant(2)];

      const onBidSubmit = vi.fn();
      const onUpdateBid = vi.fn();
      const onRevealContestant = vi.fn();
      const onReplaceRandom = vi.fn();
      const onReplaceManual = vi.fn();
      const user = userEvent.setup();

      render(
        <PodiumsRow
          contestants={contestants}
          bids={[]}
          currentBidderPosition={null}
          winnerPosition={null}
          role="host"
          canReplaceContestants={true}
          onBidSubmit={onBidSubmit}
          onUpdateBid={onUpdateBid}
          onRevealContestant={onRevealContestant}
          onReplaceContestantRandom={onReplaceRandom}
          onReplaceContestantManual={onReplaceManual}
        />,
      );

      // Verify callbacks work by checking manage buttons exist for contestants
      expect(screen.getByTestId('manage-contestant-1')).toBeInTheDocument();
      expect(screen.getByTestId('manage-contestant-2')).toBeInTheDocument();

      // Click menu to open it
      await user.click(screen.getByTestId('manage-contestant-1'));

      // Click replace option
      await user.click(screen.getByText('Replace with Random'));
      expect(onReplaceRandom).toHaveBeenCalledWith(contestants[0].id);
    });

    it('should handle undefined callbacks gracefully', () => {
      const contestants = [createMockContestant(1, 'active')];

      // Should not crash with no callbacks
      expect(() => {
        render(
          <PodiumsRow
            contestants={contestants}
            bids={[]}
            currentBidderPosition={null}
            winnerPosition={null}
            role="host"
            // All callbacks undefined
          />,
        );
      }).not.toThrow();
    });
  });
});
