import { useState } from 'react';
import { HStack, Button, Text, Box } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from './ui/menu';
import { ExportDatabaseModal } from './ExportDatabaseModal';
import { ImportDatabaseModal } from './ImportDatabaseModal';
import { StartGameConfirmModal } from './StartGameConfirmModal';
import type { GameState } from '../store/gameStore';

interface GameControlStripProps {
  gameState: GameState;
  role: string;
  isProductModalOpen?: boolean;
  allBidsSubmitted?: boolean;
  onShowProduct?: () => void;
  onHideProduct?: () => void;
  onRevealWinner?: () => void;
  onAdvancePhase?: () => void;
  onRestartGame?: () => void;
  onStartNewGame?: () => void;
  onRefreshGameState?: () => void;
  onRefreshContestantsRow?: () => void;
  isLoading?: boolean;
}

export function GameControlStrip({
  gameState,
  role,
  isProductModalOpen = false,
  allBidsSubmitted = false,
  onShowProduct,
  onHideProduct,
  onRevealWinner,
  onAdvancePhase,
  onRestartGame,
  onStartNewGame,
  onRefreshGameState,
  onRefreshContestantsRow,
  isLoading = false,
}: GameControlStripProps) {
  const navigate = useNavigate();
  const workflow = gameState.workflow;
  const isBiddingPhase = workflow.phase_type === 'bidding';

  // Modal state
  const [isStartGameModalOpen, setIsStartGameModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const metadata = workflow.phase_metadata ? JSON.parse(workflow.phase_metadata) : {};
  const productId = metadata.product_id;
  const winnerInfo = metadata.winner_info;
  const hasWinnerBeenRevealed = winnerInfo && typeof winnerInfo === 'object' && winnerInfo.player_id;
  const currentBids = gameState.currentBids || [];
  const hasBids = currentBids.length > 0;

  // Handler for start new game
  const handleStartNewGameClick = () => {
    // Check if there's a game in progress
    const hasGameInProgress = workflow && workflow.phase_type !== 'not_started';

    if (hasGameInProgress) {
      // Show confirmation modal if game is in progress
      setIsStartGameModalOpen(true);
    } else if (onStartNewGame) {
      // Start directly if no game in progress
      onStartNewGame();
    }
  };

  const handleConfirmStartNewGame = () => {
    setIsStartGameModalOpen(false);
    if (onStartNewGame) {
      onStartNewGame();
    }
  };

  const handleImportSuccess = () => {
    setIsImportModalOpen(false);
    if (onRefreshGameState) {
      onRefreshGameState();
    }
  };

  return (
    <Box
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      bg="gray.800"
      borderTop="3px solid"
      borderColor="blue.500"
      p={4}
      boxShadow="0 -4px 20px rgba(0,0,0,0.3)"
      zIndex={1000}
      data-testid="game-control-strip"
    >
      <HStack gap={4} justify="space-between" wrap="wrap">
        {/* Left: Navigation */}
        <HStack gap={2}>
          <Button
            onClick={() => navigate('/welcome')}
            colorPalette="blue"
            variant="solid"
            size="md"
          >
            ← Welcome
          </Button>

          {role === 'host' && (
            <MenuRoot>
              <MenuTrigger asChild>
                <Button colorPalette="purple" variant="solid" size="md">
                  Utilities ⋮
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem value="start-new" onClick={handleStartNewGameClick}>
                  Start New Game
                </MenuItem>
                {isBiddingPhase && !hasWinnerBeenRevealed && (
                  <MenuItem value="refresh-row" onClick={onRefreshContestantsRow}>
                    Refresh Entire Row
                  </MenuItem>
                )}
                <MenuItem value="export" onClick={() => setIsExportModalOpen(true)}>
                  Export Game State
                </MenuItem>
                <MenuItem value="import" onClick={() => setIsImportModalOpen(true)}>
                  Import Game State
                </MenuItem>
                <MenuItem value="restart" onClick={onRestartGame}>
                  Restart Game
                </MenuItem>
              </MenuContent>
            </MenuRoot>
          )}
        </HStack>

        {/* Center: Phase-specific controls */}
        {role === 'host' && isBiddingPhase && (
          <HStack gap={4} justify="center" flex="1" wrap="wrap">
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
            </Box>

            {/* Product Display Controls */}
            {!isProductModalOpen ? (
              <Button onClick={onShowProduct} colorPalette="green" size="lg" disabled={isLoading}>
                Show Product
              </Button>
            ) : (
              <Button onClick={onHideProduct} colorPalette="orange" size="lg" disabled={isLoading}>
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
              >
                Reveal Winner
                {!allBidsSubmitted && (
                  <Text as="span" ml={2} fontSize="xs">
                    ({5 - currentBids.length} left)
                  </Text>
                )}
              </Button>
            )}

            {/* Advance Phase Button */}
            <Button
              onClick={onAdvancePhase}
              colorPalette="cyan"
              size="lg"
              variant="solid"
              disabled={isLoading}
            >
              Next Phase →
            </Button>
          </HStack>
        )}

        {/* Right: Status info */}
        {isBiddingPhase && (
          <Box bg="gray.700" px={4} py={2} borderRadius="md" minWidth="120px">
            <Text fontSize="sm" color="white" textAlign="center">
              Bids: {currentBids.length} / 5
            </Text>
            {allBidsSubmitted && (
              <Text fontSize="xs" color="green.300" textAlign="center" mt={1}>
                All bids in!
              </Text>
            )}
          </Box>
        )}
      </HStack>

      {/* Modals */}
      <StartGameConfirmModal
        isOpen={isStartGameModalOpen}
        onClose={() => setIsStartGameModalOpen(false)}
        onConfirm={handleConfirmStartNewGame}
      />

      <ExportDatabaseModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />

      <ImportDatabaseModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={handleImportSuccess}
      />
    </Box>
  );
}
