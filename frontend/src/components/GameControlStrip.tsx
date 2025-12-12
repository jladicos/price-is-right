import { useState } from 'react';
import { HStack, Button, Text, Box } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from './ui/menu';
import { ExportDatabaseModal } from './ExportDatabaseModal';
import { ImportDatabaseModal } from './ImportDatabaseModal';
import { StartGameConfirmModal } from './StartGameConfirmModal';
import { useAuthStore } from '../store/authStore';
import { showToast } from '../utils/toast';
import type { GameState } from '../store/gameStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface GameControlStripProps {
  gameState: GameState;
  role: string;
  isProductModalOpen?: boolean;
  allBidsSubmitted?: boolean;
  onShowProduct?: () => void;
  onHideProduct?: () => void;
  onRevealWinner?: () => void;
  onAdvancePhase?: () => void;
  onNextSpinner?: () => void;
  onResetWheel?: () => void; // Debug: reset wheel to first player
  onRestartGame?: () => void;
  onStartNewGame?: () => void;
  onRefreshGameState?: () => void;
  onRefreshContestantsRow?: () => void;
  onRestartShowcase?: () => void; // Debug: restart showcase phase
  onGoToPreviousPhase?: () => void; // Go back to previous phase
  isLoading?: boolean;
  showNextSpinnerButton?: boolean;
  // Showcase phase controls
  showcase1Revealed?: boolean;
  showcase2Revealed?: boolean;
  onRevealShowcase1?: () => void;
  onRevealShowcase2?: () => void;
  showResults?: boolean;
  bothShowcaseBidsSubmitted?: boolean;
  onRevealShowcaseWinner?: () => void;
  onRetryShowcase?: () => void;
  bothPlayersOver?: boolean;
  hasWinner?: boolean;
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
  onNextSpinner,
  onResetWheel,
  onRestartGame,
  onStartNewGame,
  onRefreshGameState,
  onRefreshContestantsRow,
  onRestartShowcase,
  onGoToPreviousPhase,
  isLoading = false,
  showNextSpinnerButton = false,
  // Showcase phase controls
  showcase1Revealed = false,
  showcase2Revealed = false,
  onRevealShowcase1,
  onRevealShowcase2,
  showResults = false,
  bothShowcaseBidsSubmitted = false,
  onRevealShowcaseWinner,
  onRetryShowcase,
  bothPlayersOver = false,
  _hasWinner = false,
}: GameControlStripProps) {
  const navigate = useNavigate();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const workflow = gameState.workflow;
  const isBiddingPhase = workflow.phase_type === 'bidding';
  const isAudienceBidPhase = workflow.phase_type === 'audience_bid';
  const isWheelPhase = workflow.phase_type === 'wheel';
  const isShowcasePhase = workflow.phase_type === 'showcase';

  // Modal state
  const [isStartGameModalOpen, setIsStartGameModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const metadata = workflow.phase_metadata ? JSON.parse(workflow.phase_metadata) : {};
  const winnerInfo = metadata.winner_info;
  const hasWinnerBeenRevealed =
    winnerInfo && typeof winnerInfo === 'object' && winnerInfo.player_id;
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

  const handleExportWinners = async () => {
    try {
      if (!sessionToken) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE_URL}/admin/export-winners`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      const result = await response.json();

      // Log winners to browser console for easy access
      console.log('=== GAME WINNERS ===');
      console.log('Section 1 Bidding Winners:', result.winners?.section1BiddingWinners || []);
      console.log('Section 2 Bidding Winners:', result.winners?.section2BiddingWinners || []);
      console.log('Showcase Winner:', result.winners?.showcaseWinner || 'Not yet determined');
      console.log('====================');

      showToast({
        title: 'Winners exported',
        description: `Saved to ${result.filePath} (also logged to console)`,
        type: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'An error occurred',
        type: 'error',
      });
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
                {onGoToPreviousPhase && (
                  <MenuItem value="previous-phase" onClick={onGoToPreviousPhase}>
                    ← Previous Phase
                  </MenuItem>
                )}
                {isBiddingPhase && !hasWinnerBeenRevealed && (
                  <MenuItem value="refresh-row" onClick={onRefreshContestantsRow}>
                    Refresh Entire Row
                  </MenuItem>
                )}
                {isWheelPhase && onResetWheel && (
                  <MenuItem value="reset-wheel" onClick={onResetWheel}>
                    Reset to First Player
                  </MenuItem>
                )}
                {isShowcasePhase && onRestartShowcase && (
                  <MenuItem value="restart-showcase" onClick={onRestartShowcase}>
                    🔄 Restart Showcase Phase
                  </MenuItem>
                )}
                <MenuItem value="export" onClick={() => setIsExportModalOpen(true)}>
                  Export Game State
                </MenuItem>
                <MenuItem value="export-winners" onClick={handleExportWinners}>
                  Export Winners
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

        {/* Audience Bid Phase Controls */}
        {role === 'host' && isAudienceBidPhase && (
          <HStack gap={4} justify="center" flex="1" wrap="wrap">
            {/* Phase Info */}
            <Box bg="teal.600" px={4} py={2} borderRadius="md" minWidth="200px">
              <Text
                fontSize="sm"
                fontWeight="bold"
                color="white"
                textAlign="center"
                textTransform="uppercase"
                letterSpacing="wide"
              >
                {workflow.current_segment} - Audience Bid
              </Text>
            </Box>

            {/* Product Display Controls */}
            {!isProductModalOpen ? (
              <Button onClick={onShowProduct} colorPalette="green" size="lg" disabled={isLoading}>
                Show Product
              </Button>
            ) : (
              <Button onClick={onHideProduct} colorPalette="orange" size="lg" disabled={isLoading}>
                Hide Product
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

        {/* Wheel Phase Controls */}
        {role === 'host' && isWheelPhase && (
          <HStack gap={4} justify="center" flex="1" wrap="wrap">
            {/* Phase Info */}
            <Box bg="purple.600" px={4} py={2} borderRadius="md" minWidth="200px">
              <Text
                fontSize="sm"
                fontWeight="bold"
                color="white"
                textAlign="center"
                textTransform="uppercase"
                letterSpacing="wide"
              >
                {workflow.current_segment} - Wheel
              </Text>
            </Box>

            {/* Next Spinner Button */}
            {showNextSpinnerButton && (
              <Button onClick={onNextSpinner} colorPalette="teal" size="lg" disabled={isLoading}>
                Next Spinner →
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

        {/* Showcase Phase Controls */}
        {role === 'host' && isShowcasePhase && (
          <HStack gap={4} justify="center" flex="1" wrap="wrap">
            {/* Phase Info */}
            <Box bg="pink.600" px={4} py={2} borderRadius="md" minWidth="200px">
              <Text
                fontSize="sm"
                fontWeight="bold"
                color="white"
                textAlign="center"
                textTransform="uppercase"
                letterSpacing="wide"
              >
                Package Playoff
              </Text>
            </Box>

            {/* Reveal Showcase 1 */}
            {!showcase1Revealed && onRevealShowcase1 && (
              <Button
                onClick={onRevealShowcase1}
                colorPalette="blue"
                size="lg"
                disabled={isLoading}
              >
                Reveal Package 1
              </Button>
            )}

            {/* Reveal Showcase 2 */}
            {showcase1Revealed && !showcase2Revealed && onRevealShowcase2 && (
              <Button
                onClick={onRevealShowcase2}
                colorPalette="blue"
                size="lg"
                disabled={isLoading}
              >
                Reveal Package 2
              </Button>
            )}

            {/* Reveal Winner */}
            {!showResults && onRevealShowcaseWinner && showcase2Revealed && (
              <Button
                onClick={onRevealShowcaseWinner}
                colorPalette="green"
                size="lg"
                disabled={isLoading || !bothShowcaseBidsSubmitted}
              >
                Reveal Winner
                {!bothShowcaseBidsSubmitted && (
                  <Text as="span" ml={2} fontSize="xs">
                    (waiting for bids)
                  </Text>
                )}
              </Button>
            )}

            {/* Retry (when both players over) */}
            {showResults && bothPlayersOver && onRetryShowcase && (
              <Button
                onClick={onRetryShowcase}
                colorPalette="orange"
                size="lg"
                disabled={isLoading}
              >
                Start Retry
              </Button>
            )}

            {/* No "Next Phase" button - Showcase is the final phase */}
          </HStack>
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
