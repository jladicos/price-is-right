import { useState, useEffect } from 'react';
import { Box, Text, Image, Link, VStack } from '@chakra-ui/react';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { GameControlStrip } from '../GameControlStrip';
import { showToast } from '../../utils/toast';
import { getProductImageUrl } from '../../utils/imageUrls';
import type { GameState } from '../../store/gameStore';

interface AudienceBidPhaseViewProps {
  gameState: GameState;
}

/**
 * AudienceBidPhaseView - Display phase for audience bidding
 * Shows WaitingScreen background with product modal overlay
 * Price is hidden (audience guesses the value outside the game)
 * Host controls when to advance to next phase
 */
export function AudienceBidPhaseView({ gameState }: AudienceBidPhaseViewProps) {
  const { currentPlayer } = useAuthStore();
  const {
    advancePhase,
    goToPreviousPhase,
    showProduct,
    hideProductModal,
    startNewGame,
    fetchGameState,
  } = useGameStore();

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  const role = currentPlayer?.role || 'audience';
  const audienceBidProduct = gameState.audienceBidProduct;

  // Parse phase metadata for modal visibility
  const metadata = gameState.workflow.phase_metadata
    ? JSON.parse(gameState.workflow.phase_metadata)
    : {};
  const productModalVisible = metadata.product_modal_visible || false;

  // Sync product modal state with server
  useEffect(() => {
    setIsProductModalOpen(productModalVisible);
  }, [productModalVisible]);

  const handleShowProduct = async () => {
    setIsProductModalOpen(true);
    try {
      await showProduct();
    } catch (error) {
      setIsProductModalOpen(false);
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to show product',
        type: 'error',
      });
    }
  };

  const handleHideProductModal = async () => {
    setIsProductModalOpen(false);
    try {
      await hideProductModal();
    } catch (error) {
      setIsProductModalOpen(true);
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to hide product',
        type: 'error',
      });
    }
  };

  const handleAdvancePhase = async () => {
    try {
      await advancePhase();
    } catch (error) {
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to advance phase',
        type: 'error',
      });
    }
  };

  const handleRestartGame = async () => {
    if (!confirm('Are you sure you want to restart the game? This will reset everything.')) {
      return;
    }

    try {
      await startNewGame();
    } catch (error) {
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to restart game',
        type: 'error',
      });
    }
  };

  const handleStartNewGame = async () => {
    try {
      await startNewGame();
    } catch (error) {
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start new game',
        type: 'error',
      });
    }
  };

  const handleRefreshGameState = async () => {
    try {
      await fetchGameState();
    } catch (error) {
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to refresh game state',
        type: 'error',
      });
    }
  };

  return (
    <>
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="black"
        pb="80px" // Space for control strip
      >
        {/* WaitingScreen text in background */}
        <Text
          fontFamily="'Pricedown', sans-serif"
          fontSize={{ base: '4xl', md: '6xl', lg: '8xl' }}
          color="white"
          textAlign="center"
          px={4}
          position="absolute"
        >
          The Cost is Accurate
        </Text>

        {/* Product Modal Overlay - only shown when revealed */}
        {isProductModalOpen && audienceBidProduct && (
          <Box
            position="relative"
            bg="gray.800"
            borderRadius="xl"
            p={8}
            maxWidth="500px"
            width="90%"
            boxShadow="0 0 40px rgba(255, 255, 255, 0.2)"
            zIndex={10}
          >
            <VStack gap={6}>
              {/* Product Image */}
              <Box width="100%" borderRadius="lg" bg="white" p={4}>
                <Image
                  src={getProductImageUrl(audienceBidProduct.images[0])}
                  alt={audienceBidProduct.name}
                  width="100%"
                  objectFit="contain"
                  fallbackSrc={getProductImageUrl('default.png')}
                />
              </Box>

              {/* Product Name */}
              <Text fontSize="2xl" fontWeight="bold" color="white" textAlign="center">
                {audienceBidProduct.name}
              </Text>
            </VStack>
          </Box>
        )}

        {/* Fixed URL Link - near top of screen */}
        {audienceBidProduct?.url && (
          <Link
            href={audienceBidProduct.url}
            target="_blank"
            rel="noopener noreferrer"
            position="fixed"
            top="1em"
            left="50%"
            transform="translateX(-50%)"
            color="white"
            fontSize="xl"
            textDecoration="underline"
            _hover={{ color: 'gray.300' }}
            zIndex={1001}
          >
            {audienceBidProduct.url}
          </Link>
        )}
      </Box>

      {/* Fixed Control Strip at Bottom */}
      <GameControlStrip
        gameState={gameState}
        role={role}
        isProductModalOpen={isProductModalOpen}
        onShowProduct={handleShowProduct}
        onHideProduct={handleHideProductModal}
        onAdvancePhase={handleAdvancePhase}
        onRestartGame={handleRestartGame}
        onStartNewGame={handleStartNewGame}
        onRefreshGameState={handleRefreshGameState}
        onGoToPreviousPhase={goToPreviousPhase}
      />
    </>
  );
}
