import { HStack, Button, Text, Box } from '@chakra-ui/react';
import type { GameState } from '../store/gameStore';

interface BiddingControlsProps {
  gameState: GameState;
  isProductModalOpen: boolean;
  allBidsSubmitted: boolean;
  onShowProduct: () => void;
  onHideProduct: () => void;
  onRevealWinner: () => void;
  onAdvancePhase: () => void;
  isLoading?: boolean;
}

export function BiddingControls({
  gameState,
  isProductModalOpen,
  allBidsSubmitted,
  onShowProduct,
  onHideProduct,
  onRevealWinner,
  onAdvancePhase,
  isLoading = false,
}: BiddingControlsProps) {
  const workflow = gameState.workflow;
  const isBiddingPhase = workflow.phase_type === 'bidding';

  if (!isBiddingPhase) {
    return null;
  }

  const metadata = workflow.phase_metadata ? JSON.parse(workflow.phase_metadata) : {};
  const productId = metadata.product_id;
  const currentBids = gameState.currentBids || [];
  const hasBids = currentBids.length > 0;

  return (
    <Box bg="gray.800" p={4} borderRadius="lg" boxShadow="xl" data-testid="bidding-controls">
      <HStack gap={4} justify="center" wrap="wrap">
        {/* Phase Info */}
        <Box bg="blue.600" px={4} py={2} borderRadius="md" minWidth="200px">
          <Text
            fontSize="sm"
            fontWeight="bold"
            color="white"
            textAlign="center"
            textTransform="uppercase"
            letterSpacing="wide"
          >
            {workflow.current_segment} - Round {workflow.current_segment_index + 1}
          </Text>
          {productId && (
            <Text fontSize="xs" color="blue.100" textAlign="center" mt={1}>
              Product: {productId}
            </Text>
          )}
        </Box>

        {/* Product Display Controls */}
        {!isProductModalOpen ? (
          <Button
            onClick={onShowProduct}
            colorPalette="green"
            size="lg"
            disabled={isLoading}
            data-testid="show-product-button"
          >
            Show Product
          </Button>
        ) : (
          <Button
            onClick={onHideProduct}
            colorPalette="orange"
            size="lg"
            disabled={isLoading}
            data-testid="hide-product-button"
          >
            Hide Product Modal
          </Button>
        )}

        {/* Reveal Winner Button */}
        {hasBids && (
          <Button
            onClick={onRevealWinner}
            colorPalette="yellow"
            size="lg"
            disabled={!allBidsSubmitted || isLoading}
            data-testid="reveal-winner-button"
          >
            Reveal Winner
            {!allBidsSubmitted && (
              <Text as="span" ml={2} fontSize="xs">
                (Waiting for {5 - currentBids.length} bids)
              </Text>
            )}
          </Button>
        )}

        {/* Advance Phase Button */}
        <Button
          onClick={onAdvancePhase}
          colorPalette="blue"
          size="lg"
          variant="outline"
          disabled={isLoading}
          data-testid="advance-phase-button"
        >
          Advance to Next Phase →
        </Button>

        {/* Bidding Status */}
        <Box bg="gray.700" px={4} py={2} borderRadius="md">
          <Text fontSize="sm" color="white" textAlign="center">
            Bids: {currentBids.length} / 5
          </Text>
          {allBidsSubmitted && (
            <Text fontSize="xs" color="green.300" textAlign="center" mt={1}>
              All bids received!
            </Text>
          )}
        </Box>
      </HStack>
    </Box>
  );
}
