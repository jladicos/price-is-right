import { useState, useEffect } from "react";
import { Box, HStack, VStack, Button } from "@chakra-ui/react";
import { PodiumsRow } from "../PodiumsRow";
import { ProductModal } from "../ProductModal";
import { ProductInsetCard } from "../ProductInsetCard";
import { GameControlStrip } from "../GameControlStrip";
import { ManualSelectContestantModal } from "../ManualSelectContestantModal";
import { useGameStore } from "../../store/gameStore";
import { useAuthStore } from "../../store/authStore";
import { showToast } from "../../utils/toast";
import { apiRequest } from "../../utils/api";
import type { GameState } from "../../store/gameStore";

interface BiddingPhaseViewProps {
  gameState: GameState;
}

interface ProductData {
  name: string;
  images: string[];
}

export function BiddingPhaseView({ gameState }: BiddingPhaseViewProps) {
  const { currentPlayer } = useAuthStore();
  const {
    submitBid,
    showProduct,
    hideProductModal,
    revealWinner,
    unlockBid,
    updateBidAmount,
    advancePhase,
    revealContestant,
    replaceContestantRandom,
    manualSelectContestant,
    refreshContestantsRow,
    startNewGame,
    fetchGameState,
  } = useGameStore();

  const [product, setProduct] = useState<ProductData | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [showAllOverToast, setShowAllOverToast] = useState(false);
  const [isRevealingWinner, setIsRevealingWinner] = useState(false);
  const [isManualSelectModalOpen, setIsManualSelectModalOpen] = useState(false);
  const [manualSelectPosition, setManualSelectPosition] = useState<
    number | null
  >(null);

  const role = currentPlayer?.role || "audience";
  const contestants = gameState.contestantsRow;
  const currentBids = gameState.currentBids || [];
  const currentBidderPosition = gameState.currentBidderPosition;

  // Parse phase metadata
  const metadata = gameState.workflow.phase_metadata
    ? JSON.parse(gameState.workflow.phase_metadata)
    : {};
  const productId = metadata.product_id;
  const productModalVisible = metadata.product_modal_visible || false;
  const productInsetVisible = metadata.product_inset_visible || false;
  const productPriceVisible = metadata.product_price_visible || false;
  const productPrice = metadata.product_price;
  const winnerInfo = metadata.winner_info;
  const hasWinnerBeenRevealed =
    winnerInfo && typeof winnerInfo === "object" && winnerInfo.player_id;

  // Fetch product data when productId changes
  useEffect(() => {
    if (!productId) return;

    const fetchProduct = async () => {
      try {
        const data = await apiRequest<{
          success: boolean;
          product: ProductData;
        }>(`/products/${productId}`);

        setProduct(data.product);
      } catch (error) {
        console.error("Error fetching product:", error);
        showToast({
          title: "Error",
          description: "Failed to load product information",
          type: "error",
        });
      }
    };

    fetchProduct();
  }, [productId]);

  // Sync product modal state
  useEffect(() => {
    setIsProductModalOpen(productModalVisible);
  }, [productModalVisible]);

  // Calculate derived state
  const winnerPosition = winnerInfo ? winnerInfo.position : null;
  const allContestantsRevealed = contestants.every(
    (c) => c.status === "active",
  );
  const productHasBeenShown = productModalVisible || productInsetVisible;
  const allBidsSubmitted =
    contestants.filter((c) => c.status === "active").length ===
      currentBids.length && currentBids.length === 5;

  // Handlers
  const handleShowProduct = async () => {
    // Optimistically show the modal immediately for instant feedback
    setIsProductModalOpen(true);
    try {
      await showProduct();
    } catch (error) {
      // Revert on error
      setIsProductModalOpen(false);
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to show product",
        type: "error",
      });
    }
  };

  const handleHideProductModal = async () => {
    // Optimistically hide the modal immediately for instant feedback
    setIsProductModalOpen(false);
    try {
      await hideProductModal();
    } catch (error) {
      // Revert on error
      setIsProductModalOpen(true);
      showToast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to hide product modal",
        type: "error",
      });
    }
  };

  const handleRevealWinner = async () => {
    setIsRevealingWinner(true);
    try {
      const result = await revealWinner();

      if (result.allOver) {
        // Show "all over" toast
        setShowAllOverToast(true);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          setShowAllOverToast(false);
        }, 5000);
      } else if (result.winner) {
        showToast({
          title: "Winner!",
          description: `${result.winner.first_name} ${result.winner.last_name} wins with $${result.winner.bid_amount}!`,
          type: "success",
        });
      }
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to reveal winner",
        type: "error",
      });
    } finally {
      setIsRevealingWinner(false);
    }
  };

  const handleBidSubmit = async (position: number, amount: number) => {
    try {
      // Find the contestant at this position to get their player_id
      const contestant = contestants.find((c) => c.position === position);
      const playerId = contestant?.player_id;

      await submitBid(amount, playerId);
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to submit bid",
        type: "error",
      });
    }
  };

  const handleUnlockBid = async (bidId: number) => {
    try {
      await unlockBid(bidId);
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to unlock bid",
        type: "error",
      });
    }
  };

  const handleUpdateBid = async (bidId: number, newAmount: number) => {
    try {
      await updateBidAmount(bidId, newAmount);
      showToast({
        title: "Bid Updated",
        description: `Bid updated to $${newAmount}`,
        type: "success",
      });
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update bid",
        type: "error",
      });
    }
  };

  const handleAdvancePhase = async () => {
    try {
      await advancePhase();
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to advance phase",
        type: "error",
      });
    }
  };

  const handleDismissAllOverToast = () => {
    setShowAllOverToast(false);
  };

  const handleRevealContestant = async (contestantRowId: number) => {
    try {
      await revealContestant(contestantRowId);
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to reveal contestant",
        type: "error",
      });
    }
  };

  const handleReplaceContestantRandom = async (contestantRowId: number) => {
    try {
      await replaceContestantRandom(contestantRowId);
      showToast({
        title: "Contestant Replaced",
        description: "Random contestant selected. Reveal them to continue!",
        type: "success",
      });
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to replace contestant",
        type: "error",
      });
    }
  };

  const handleReplaceContestantManual = async (
    _contestantRowId: number,
    position: number,
  ) => {
    setManualSelectPosition(position);
    setIsManualSelectModalOpen(true);
  };

  const handleManualSelectConfirm = async (
    playerId: number,
    position: number,
    segment: string,
  ) => {
    try {
      await manualSelectContestant(playerId, position, segment);
      setIsManualSelectModalOpen(false);
      setManualSelectPosition(null);
      showToast({
        title: "Contestant Selected",
        description: "Contestant manually selected. Reveal them to continue!",
        type: "success",
      });
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to select contestant",
        type: "error",
      });
    }
  };

  const handleRestartGame = async () => {
    if (
      !confirm(
        "Are you sure you want to restart the game? This will reset everything.",
      )
    ) {
      return;
    }

    try {
      await startNewGame();
      showToast({
        title: "Game Restarted",
        description: "New game started. 5 contestants selected.",
        type: "success",
      });
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to restart game",
        type: "error",
      });
    }
  };

  const handleStartNewGame = async () => {
    try {
      await startNewGame();
      showToast({
        title: "Game Started",
        description: "New game started. 5 contestants selected.",
        type: "success",
      });
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to start new game",
        type: "error",
      });
    }
  };

  const handleRefreshGameState = async () => {
    try {
      await fetchGameState();
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to refresh game state",
        type: "error",
      });
    }
  };

  const handleRefreshContestantsRow = async () => {
    if (!confirm("Replace all 5 contestants with new random selections?")) {
      return;
    }

    try {
      const currentSegment = gameState.workflow.current_segment as
        | "section_1"
        | "section_2";
      await refreshContestantsRow(currentSegment);
      showToast({
        title: "Row Refreshed",
        description: "5 new contestants selected. Reveal them to continue!",
        type: "success",
      });
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to refresh contestants row",
        type: "error",
      });
    }
  };

  return (
    <VStack gap={8} width="100%" p={4} pt="200px" pb="120px">
      {/* Add top padding to position podiums lower, and bottom padding for fixed control strip */}
      {/* Main Game Area: Podiums + Product Card */}
      <HStack
        align="start"
        justify="center"
        gap={8}
        width="100%"
        maxWidth="1600px"
      >
        {/* Podiums */}
        <Box flex="1">
          <PodiumsRow
            contestants={contestants}
            bids={currentBids}
            currentBidderPosition={currentBidderPosition}
            winnerPosition={winnerPosition}
            role={role}
            currentPlayerId={currentPlayer?.id}
            allContestantsRevealed={allContestantsRevealed}
            productHasBeenShown={productHasBeenShown}
            canReplaceContestants={!hasWinnerBeenRevealed}
            onBidSubmit={handleBidSubmit}
            onUpdateBid={handleUpdateBid}
            onUnlockBid={handleUnlockBid}
            onRevealContestant={handleRevealContestant}
            onReplaceContestantRandom={handleReplaceContestantRandom}
            onReplaceContestantManual={handleReplaceContestantManual}
          />
        </Box>

        {/* Product Inset Card */}
        {productInsetVisible && (
          <Box width="250px" flexShrink={0}>
            <ProductInsetCard
              product={product}
              productId={productId}
              isVisible={productInsetVisible}
              showPrice={productPriceVisible}
              price={productPrice}
            />
          </Box>
        )}
      </HStack>

      {/* Fixed Control Strip at Bottom */}
      <GameControlStrip
        gameState={gameState}
        role={role}
        isProductModalOpen={isProductModalOpen}
        allBidsSubmitted={allBidsSubmitted}
        onShowProduct={handleShowProduct}
        onHideProduct={handleHideProductModal}
        onRevealWinner={handleRevealWinner}
        onAdvancePhase={handleAdvancePhase}
        onRestartGame={handleRestartGame}
        onStartNewGame={handleStartNewGame}
        onRefreshGameState={handleRefreshGameState}
        onRefreshContestantsRow={handleRefreshContestantsRow}
        isLoading={isRevealingWinner}
      />

      {/* Product Modal */}
      <ProductModal
        product={product}
        productId={productId}
        isOpen={isProductModalOpen}
        onClose={handleHideProductModal}
        role={role}
      />

      {/* Manual Select Contestant Modal */}
      <ManualSelectContestantModal
        isOpen={isManualSelectModalOpen}
        onClose={() => {
          setIsManualSelectModalOpen(false);
          setManualSelectPosition(null);
        }}
        onConfirm={handleManualSelectConfirm}
        currentSegment={gameState.workflow.current_segment}
        initialPosition={manualSelectPosition || 1}
      />

      {/* All Over Toast */}
      {showAllOverToast && (
        <Box
          position="fixed"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          bg="red.500"
          color="white"
          px={8}
          py={6}
          borderRadius="xl"
          boxShadow="2xl"
          zIndex={9999}
          textAlign="center"
          minWidth="400px"
        >
          <VStack gap={4}>
            <Box fontSize="2xl" fontWeight="bold">
              Everyone Overbid!
            </Box>
            <Box fontSize="lg">Try again with lower bids</Box>
            <Button
              colorPalette="white"
              variant="outline"
              onClick={handleDismissAllOverToast}
              size="sm"
            >
              Dismiss
            </Button>
          </VStack>
        </Box>
      )}
    </VStack>
  );
}
