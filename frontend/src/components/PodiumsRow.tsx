import { HStack } from '@chakra-ui/react';
import { PodiumDisplay } from './PodiumDisplay';
import type { ContestantWithPlayer, BidWithPlayer } from '../store/gameStore';

interface PodiumsRowProps {
  contestants: ContestantWithPlayer[];
  bids: BidWithPlayer[];
  currentBidderPosition: number | null;
  winnerPosition: number | null;
  role: string; // 'host', 'player', or 'audience'
  currentPlayerId?: number; // ID of logged-in player (if applicable)
  allContestantsRevealed?: boolean; // All contestants have been revealed
  productHasBeenShown?: boolean; // Product has been shown at least once
  canReplaceContestants?: boolean; // Whether replacement is allowed (disabled after winner revealed)
  onBidSubmit?: (position: number, amount: number) => void;
  onUpdateBid?: (bidId: number, newAmount: number) => void;
  onUnlockBid?: (bidId: number) => void;
  onRevealContestant?: (contestantRowId: number) => void;
  onReplaceContestantRandom?: (contestantRowId: number) => void;
  onReplaceContestantManual?: (contestantRowId: number, position: number) => void;
}

export function PodiumsRow({
  contestants,
  bids,
  currentBidderPosition,
  winnerPosition,
  role,
  currentPlayerId,
  allContestantsRevealed = false,
  productHasBeenShown = false,
  canReplaceContestants = true,
  onBidSubmit,
  onUpdateBid,
  onUnlockBid,
  onRevealContestant,
  onReplaceContestantRandom,
  onReplaceContestantManual,
}: PodiumsRowProps) {
  // Create an array of 5 positions
  const positions = [1, 2, 3, 4, 5];

  // Helper to find contestant by position
  const getContestantByPosition = (position: number): ContestantWithPlayer | null => {
    return contestants.find((c) => c.position === position) || null;
  };

  // Helper to find bid by position
  const getBidByPosition = (position: number): BidWithPlayer | null => {
    const contestant = getContestantByPosition(position);
    if (!contestant) return null;
    return bids.find((b) => b.player_id === contestant.player_id) || null;
  };

  // Find the leftmost pending contestant (lowest position number)
  const getNextPendingPosition = (): number | null => {
    const pendingContestants = contestants
      .filter((c) => c.status === 'pending_reveal')
      .sort((a, b) => a.position - b.position);
    return pendingContestants.length > 0 ? pendingContestants[0].position : null;
  };

  const nextPendingPosition = getNextPendingPosition();

  return (
    <HStack gap={6} justify="center" wrap="nowrap" align="start" data-testid="podiums-row" py={4}>
      {positions.map((position) => {
        const contestant = getContestantByPosition(position);
        const bid = getBidByPosition(position);
        const isCurrentBidder = currentBidderPosition === position;
        const isWinner = winnerPosition === position;
        const shouldShowRevealButton = position === nextPendingPosition;

        return (
          <PodiumDisplay
            key={position}
            position={position}
            contestant={contestant}
            bid={bid}
            isCurrentBidder={isCurrentBidder}
            isWinner={isWinner}
            role={role}
            currentPlayerId={currentPlayerId}
            shouldShowRevealButton={shouldShowRevealButton}
            allContestantsRevealed={allContestantsRevealed}
            productHasBeenShown={productHasBeenShown}
            canReplaceContestants={canReplaceContestants}
            onBidSubmit={onBidSubmit}
            onUpdateBid={onUpdateBid}
            onUnlockBid={onUnlockBid}
            onRevealContestant={onRevealContestant}
            onReplaceContestantRandom={onReplaceContestantRandom}
            onReplaceContestantManual={onReplaceContestantManual}
          />
        );
      })}
    </HStack>
  );
}
