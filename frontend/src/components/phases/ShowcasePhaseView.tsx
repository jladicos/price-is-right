import { useState, useEffect, useRef } from "react";
import {
  Box,
  HStack,
  VStack,
  Button,
  Text,
  Heading,
} from "@chakra-ui/react";
import { PodiumDisplay } from "../PodiumDisplay";
import { ProductInsetCard } from "../ProductInsetCard";
import { GameControlStrip } from "../GameControlStrip";
import { ShowcaseModal } from "../ShowcaseModal";
import { useGameStore } from "../../store/gameStore";
import { useAuthStore } from "../../store/authStore";
import { showToast } from "../../utils/toast";
import type { GameState, ContestantWithPlayer, BidWithPlayer } from "../../store/gameStore";

interface ShowcasePhaseViewProps {
  gameState: GameState;
}

export function ShowcasePhaseView({ gameState }: ShowcasePhaseViewProps) {
  const { currentPlayer } = useAuthStore();
  const {
    initializeShowcase,
    submitPass,
    submitBidDecision,
    submitShowcaseBid,
    unlockShowcaseBid,
    updateShowcaseBid,
    revealShowcaseWinner,
    retryShowcase,
    advancePhase,
    startNewGame,
    fetchGameState,
  } = useGameStore();

  const [showcase1Revealed, setShowcase1Revealed] = useState(false);
  const [showcase2Revealed, setShowcase2Revealed] = useState(false);
  const [isShowcase1ModalOpen, setIsShowcase1ModalOpen] = useState(false);
  const [isShowcase2ModalOpen, setIsShowcase2ModalOpen] = useState(false);
  const [showPassBidButtons, setShowPassBidButtons] = useState(false);
  const initializeAttemptedRef = useRef(false);

  const role = currentPlayer?.role || "audience";
  const currentPlayerId = currentPlayer?.id;

  // Parse showcase state
  const showcaseState = gameState.showcaseState;
  const showcaseBids = gameState.showcaseBids || [];

  // Initialize showcase if not already initialized - only once on mount
  useEffect(() => {
    const initialize = async () => {
      if (
        !showcaseState &&
        !initializeAttemptedRef.current &&
        role === "host"
      ) {
        initializeAttemptedRef.current = true;
        try {
          await initializeShowcase();
          // Silent initialization - no toast needed
        } catch (error) {
          showToast({
            title: "Error",
            description:
              error instanceof Error
                ? error.message
                : "Failed to initialize showcase",
            type: "error",
          });
          initializeAttemptedRef.current = false; // Allow retry on error
        }
      }
    };

    initialize();
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show loading screen if showcase not initialized
  if (!showcaseState) {
    return (
      <VStack gap={4} p={8}>
        <Heading>Showcase Showdown</Heading>
        <Text>
          {role === "host"
            ? "Initializing showcase..."
            : "Waiting for host to initialize showcase..."}
        </Text>
      </VStack>
    );
  }

  const { state, showcase1, showcase2, showcase1Value, showcase2Value } =
    showcaseState;

  // Get finalist players
  const player1 = state.finale_player1_id
    ? {
        id: state.finale_player1_id,
        first_name: state.finale_player1_first_name || "",
        last_name: state.finale_player1_last_name || "",
        photo_filename: state.finale_player1_photo || "",
      }
    : null;

  const player2 = state.finale_player2_id
    ? {
        id: state.finale_player2_id,
        first_name: state.finale_player2_first_name || "",
        last_name: state.finale_player2_last_name || "",
        photo_filename: state.finale_player2_photo || "",
      }
    : null;

  // Get showcase assignments
  const player1Showcase = state.finale_player1_showcase;
  const player2Showcase = state.finale_player2_showcase;
  const player1Passed = state.finale_player1_passed;

  // Debug logging
  console.log("[ShowcasePhaseView] Showcase assignments:", {
    player1Showcase,
    player2Showcase,
    player1Passed,
    player1Name: player1 ? `${player1.first_name} ${player1.last_name}` : "N/A",
    player2Name: player2 ? `${player2.first_name} ${player2.last_name}` : "N/A",
  });

  // Get bids
  const player1Bid = showcaseBids.find((b) => b.player_id === player1?.id);
  const player2Bid = showcaseBids.find((b) => b.player_id === player2?.id);

  // Winner info
  const winnerId = state.finale_winner_id;
  const bonusWon = state.finale_bonus_won;

  // Adapt player data to ContestantWithPlayer format for PodiumDisplay
  const player1Contestant: ContestantWithPlayer | null = player1
    ? {
        id: 0, // Fake contestant row ID
        player_id: player1.id,
        position: 1,
        game_segment: "finale",
        status: "active" as const,
        added_at: "",
        revealed_at: "",
        created_at: "",
        updated_at: "",
        first_name: player1.first_name,
        last_name: player1.last_name,
        photo_filename: player1.photo_filename,
        role: "player" as const,
        weight: 1,
      }
    : null;

  const player2Contestant: ContestantWithPlayer | null = player2
    ? {
        id: 0, // Fake contestant row ID
        player_id: player2.id,
        position: 2,
        game_segment: "finale",
        status: "active" as const,
        added_at: "",
        revealed_at: "",
        created_at: "",
        updated_at: "",
        first_name: player2.first_name,
        last_name: player2.last_name,
        photo_filename: player2.photo_filename,
        role: "player" as const,
        weight: 1,
      }
    : null;

  // Adapt showcase bids to BidWithPlayer format
  const player1BidAdapted: BidWithPlayer | null = player1Bid
    ? {
        ...player1Bid,
        id: player1Bid.id,
        player_id: player1Bid.player_id,
        product_id: "", // Not applicable for showcase
        round_number: 0,
        game_segment: "finale",
        bid_amount: player1Bid.bid_amount,
        is_locked: 1,
        is_winner: winnerId === player1?.id ? 1 : 0,
        retry_number: player1Bid.retry_number,
        created_at: player1Bid.created_at,
        first_name: player1?.first_name || "",
        last_name: player1?.last_name || "",
        photo_filename: player1?.photo_filename || "",
        role: "player" as const,
        weight: 1,
      }
    : null;

  const player2BidAdapted: BidWithPlayer | null = player2Bid
    ? {
        ...player2Bid,
        id: player2Bid.id,
        player_id: player2Bid.player_id,
        product_id: "", // Not applicable for showcase
        round_number: 0,
        game_segment: "finale",
        bid_amount: player2Bid.bid_amount,
        is_locked: 1,
        is_winner: winnerId === player2?.id ? 1 : 0,
        retry_number: player2Bid.retry_number,
        created_at: player2Bid.created_at,
        first_name: player2?.first_name || "",
        last_name: player2?.last_name || "",
        photo_filename: player2?.photo_filename || "",
        role: "player" as const,
        weight: 1,
      }
    : null;

  // Determine current phase (simplified version based on state)
  const isShowcase1Revealed =
    player1Showcase !== null || player2Showcase !== null;
  const isShowcase2Revealed =
    player1Showcase !== null && player2Showcase !== null;
  const showPlayer1BidInput =
    isShowcase1Revealed && !player1Passed && !player1Bid;
  const showPlayer2BidInput = isShowcase2Revealed && !player2Bid;
  const showResults = winnerId !== null;

  // Handlers
  // Handlers for revealing showcases
  const handleRevealShowcase1 = () => {
    setIsShowcase1ModalOpen(true);
  };

  const handleCloseShowcase1Modal = () => {
    setIsShowcase1ModalOpen(false);
    setShowcase1Revealed(true);
    // Show pass/bid buttons after revealing showcase 1
    // If showcases not yet assigned, player1 makes the decision
    if (!player1Passed && !player1Bid && player1) {
      setShowPassBidButtons(true);
    }
  };

  const handleRevealShowcase2 = () => {
    setIsShowcase2ModalOpen(true);
  };

  const handleCloseShowcase2Modal = () => {
    setIsShowcase2ModalOpen(false);
    setShowcase2Revealed(true);
  };

  const handlePass = async () => {
    try {
      console.log("[handlePass] BEFORE submitPass() - Showcase assignments:", {
        player1Showcase,
        player2Showcase,
        player1Passed,
      });

      await submitPass();
      setShowPassBidButtons(false);

      console.log("[handlePass] AFTER submitPass(), BEFORE fetchGameState()");

      // Force a refresh to get updated showcase assignments
      await fetchGameState();

      console.log("[handlePass] AFTER first fetchGameState()");

      showToast({
        title: "Player Passed",
        description: `${player1?.first_name} ${player1?.last_name} passed. ${player2?.first_name} ${player2?.last_name} will bid on Showcase 1.`,
        type: "success",
      });
    } catch (error) {
      showToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to pass",
        type: "error",
      });
    }
  };

  const handleBidDecision = async () => {
    try {
      await submitBidDecision();
      setShowPassBidButtons(false);
      showToast({
        title: "Player Will Bid",
        description: "Player will bid on their showcase.",
        type: "success",
      });
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to record decision",
        type: "error",
      });
    }
  };

  // Handler for submitting a showcase bid (called from PodiumDisplay)
  const handleShowcaseBidSubmit = async (position: number, amount: number) => {
    try {
      // Position 1 = player1, Position 2 = player2
      const playerId = position === 1 ? player1?.id : player2?.id;
      if (!playerId) {
        throw new Error("Player not found");
      }

      await submitShowcaseBid(amount, role === "host" ? playerId : undefined);

      showToast({
        title: "Bid Submitted",
        description: `Bid of $${amount.toLocaleString()} submitted`,
        type: "success",
      });
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to submit bid",
        type: "error",
      });
    }
  };

  // Handler for updating a showcase bid (called from PodiumDisplay)
  const handleShowcaseBidUpdate = async (bidId: number, newAmount: number) => {
    try {
      // Get player ID from the bid
      const bid = showcaseBids.find(b => b.id === bidId);
      if (!bid) {
        throw new Error("Bid not found");
      }

      await updateShowcaseBid(bid.player_id, newAmount);

      showToast({
        title: "Bid Updated",
        description: `Bid updated to $${newAmount.toLocaleString()}`,
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

  // Handler for unlocking a showcase bid (called from PodiumDisplay)
  const handleShowcaseBidUnlock = async (bidId: number) => {
    try {
      // Get player ID from the bid
      const bid = showcaseBids.find(b => b.id === bidId);
      if (!bid) {
        throw new Error("Bid not found");
      }

      await unlockShowcaseBid(bid.player_id);

      showToast({
        title: "Bid Unlocked",
        description: "Bid can now be modified",
        type: "success",
      });
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to unlock bid",
        type: "error",
      });
    }
  };

  const handleRevealWinner = async () => {
    try {
      const result = await revealShowcaseWinner();
      if (result.retryNeeded) {
        showToast({
          title: "Both Players Over",
          description: "Both players went over. Ready for retry.",
          type: "warning",
        });
      } else {
        showToast({
          title: "Winner Revealed",
          description: result.bonusWon
            ? "Winner gets both showcases!"
            : "Winner revealed!",
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
    }
  };

  const handleRetry = async () => {
    try {
      await retryShowcase();
      showToast({
        title: "Retry Started",
        description: "Players can now re-bid on the same showcases",
        type: "info",
      });
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to start retry",
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

  const handleStartNewGame = async () => {
    try {
      await startNewGame();
      showToast({
        title: "Game Started",
        description: "New game started",
        type: "success",
      });
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to start game",
        type: "error",
      });
    }
  };

  const handleRestartGame = async () => {
    if (!confirm("Are you sure you want to restart the game?")) {
      return;
    }
    try {
      await startNewGame();
      showToast({
        title: "Game Restarted",
        description: "New game started",
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

  const handleRestartShowcase = async () => {
    if (!confirm("Are you sure you want to restart the showcase phase? This will reset all bids and decisions.")) {
      return;
    }
    try {
      // Reset local UI state
      setShowcase1Revealed(false);
      setShowcase2Revealed(false);
      setIsShowcase1ModalOpen(false);
      setIsShowcase2ModalOpen(false);
      setShowPassBidButtons(false);

      // Re-initialize showcase on backend
      await initializeShowcase();

      // Fetch updated state
      await fetchGameState();

      showToast({
        title: "Showcase Restarted",
        description: "Showcase phase has been reset to initial state",
        type: "success",
      });
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to restart showcase",
        type: "error",
      });
    }
  };

  return (
    <VStack gap={8} width="100%" p={4} pt="120px" pb="120px">

      {/* Main Content: [Inset] [Podium1] [Podium2] [Inset] */}
      <HStack
        gap={8}
        width="100%"
        maxWidth="1800px"
        alignItems="flex-start"
        justifyContent="center"
      >
        {/* Left Inset - Showcase for player on left */}
        <Box width="300px" flexShrink={0}>
          {(() => {
            const shouldShow =
              player1Showcase &&
              ((player1Showcase === 1 && showcase1Revealed) ||
                (player1Showcase === 2 && showcase2Revealed));
            console.log("[LEFT INSET] Evaluation:", {
              player1Showcase,
              showcase1Revealed,
              showcase2Revealed,
              shouldShow,
            });
            return shouldShow ? (
              <ProductInsetCard
                products={player1Showcase === 1 ? showcase1 : showcase2}
                isVisible={true}
                showPrice={showResults}
                price={player1Showcase === 1 ? showcase1Value : showcase2Value}
                position="left"
              />
            ) : null;
          })()}
        </Box>

        {/* Player 1 Podium */}
        <Box flexShrink={0}>
          <PodiumDisplay
            position={1}
            contestant={player1Contestant}
            bid={player1BidAdapted}
            isCurrentBidder={
              role === "host" &&
              !player1Bid &&
              !showPassBidButtons &&
              showcase1Revealed &&
              ((player1Showcase === 1) || // Player 1 chose to bid on showcase 1
               (player1Passed && player1Showcase === 2 && showcase2Revealed)) // Or passed and now bids on showcase 2
            }
            isWinner={winnerId === player1?.id}
            role={role}
            currentPlayerId={currentPlayerId}
            allContestantsRevealed={true}
            productHasBeenShown={true}
            canReplaceContestants={false}
            onBidSubmit={handleShowcaseBidSubmit}
            onUpdateBid={handleShowcaseBidUpdate}
            onUnlockBid={handleShowcaseBidUnlock}
          />
        </Box>

        {/* Player 2 Podium */}
        <Box flexShrink={0}>
          <PodiumDisplay
            position={2}
            contestant={player2Contestant}
            bid={player2BidAdapted}
            isCurrentBidder={
              role === "host" &&
              !player2Bid &&
              !showPassBidButtons &&
              ((player2Showcase === 1 && showcase1Revealed) || // Player 2 bids on showcase 1 (if player 1 passed)
               (player2Showcase === 2 && showcase2Revealed)) // Or player 2 bids on showcase 2
            }
            isWinner={winnerId === player2?.id}
            role={role}
            currentPlayerId={currentPlayerId}
            allContestantsRevealed={true}
            productHasBeenShown={true}
            canReplaceContestants={false}
            onBidSubmit={handleShowcaseBidSubmit}
            onUpdateBid={handleShowcaseBidUpdate}
            onUnlockBid={handleShowcaseBidUnlock}
          />
        </Box>

        {/* Right Inset - Showcase for player on right */}
        <Box width="300px" flexShrink={0}>
          {(() => {
            const shouldShow =
              player2Showcase &&
              ((player2Showcase === 1 && showcase1Revealed) ||
                (player2Showcase === 2 && showcase2Revealed));
            console.log("[RIGHT INSET] Evaluation:", {
              player2Showcase,
              showcase1Revealed,
              showcase2Revealed,
              shouldShow,
            });
            return shouldShow ? (
              <ProductInsetCard
                products={player2Showcase === 1 ? showcase1 : showcase2}
                isVisible={true}
                showPrice={showResults}
                price={player2Showcase === 1 ? showcase1Value : showcase2Value}
                position="right"
              />
            ) : null;
          })()}
        </Box>
      </HStack>

      {/* Pass/Bid Decision UI */}
      {role === "host" && showPassBidButtons && player1 && (
        <VStack gap={4} width="100%">
          <Text fontSize="xl" fontWeight="bold">
            {player1.first_name} {player1.last_name} Decision:
          </Text>
          <HStack gap={4}>
            <Button
              onClick={handlePass}
              colorPalette="orange"
              size="lg"
            >
              Pass
            </Button>
            <Button
              onClick={handleBidDecision}
              colorPalette="green"
              size="lg"
            >
              Bid
            </Button>
          </HStack>
        </VStack>
      )}

      {/* Fixed Control Strip at Bottom */}
      <GameControlStrip
        gameState={gameState}
        role={role}
        showcase1Revealed={showcase1Revealed}
        showcase2Revealed={showcase2Revealed}
        onRevealShowcase1={handleRevealShowcase1}
        onRevealShowcase2={handleRevealShowcase2}
        showResults={showResults}
        bothShowcaseBidsSubmitted={!!(player1Bid && player2Bid)}
        onRevealShowcaseWinner={handleRevealWinner}
        onRetryShowcase={handleRetry}
        bothPlayersOver={showResults && winnerId === null}
        hasWinner={winnerId !== null}
        onAdvancePhase={handleAdvancePhase}
        onRestartGame={handleRestartGame}
        onStartNewGame={handleStartNewGame}
        onRestartShowcase={handleRestartShowcase}
        onRefreshGameState={handleRefreshGameState}
      />

      {/* Showcase Modals */}
      <ShowcaseModal
        showcaseProducts={showcase1}
        showcaseNumber={1}
        isOpen={isShowcase1ModalOpen}
        onClose={handleCloseShowcase1Modal}
        role={role}
      />
      <ShowcaseModal
        showcaseProducts={showcase2}
        showcaseNumber={2}
        isOpen={isShowcase2ModalOpen}
        onClose={handleCloseShowcase2Modal}
        role={role}
      />
    </VStack>
  );
}
