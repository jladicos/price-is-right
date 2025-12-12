import { useMemo, useEffect } from "react";
import { Box, HStack, VStack, Button, Text } from "@chakra-ui/react";
import { WheelDisplay } from "../components/WheelDisplay";
import { PlayerCard } from "../components/PlayerCard";
import { GameControlStrip } from "../components/GameControlStrip";
import { PhaseBackground } from "../components/PhaseBackground";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { showToast } from "../utils/toast";
import type { GameState } from "../store/gameStore";

interface WheelPhaseViewProps {
  gameState: GameState;
}

/**
 * WheelPhaseView - Simplified architecture
 *
 * Key insight: The store delays fetchGameState() until after animation completes.
 * This means gameState (winner, tie, spinner, etc.) won't change during animation.
 *
 * During animation:
 * - gameState stays the same (old state before spin result)
 * - pendingSpinTarget has the animation target value
 * - isWheelAnimating is true
 *
 * After animation:
 * - fetchGameState() is called, gameState updates with new info
 * - pendingSpinTarget is cleared
 * - isWheelAnimating becomes false
 *
 * This eliminates the need for deferred states (deferredWinner, deferredSpinnerId, etc.)
 */
export function WheelPhaseView({ gameState }: WheelPhaseViewProps) {
  const { currentPlayer } = useAuthStore();
  const {
    spinWheel,
    stayOnWheelSpin,
    startSpinOff,
    advancePhase,
    goToPreviousPhase,
    isWheelAnimating,
    pendingSpinTarget,
    startNewGame,
    fetchGameState,
    resetWheelPhase,
    triggerWheelAnimation,
    lastProcessedSpinTimestamp,
  } = useGameStore();

  const role = currentPlayer?.role || "audience";
  const currentPlayerId = currentPlayer?.id;

  // Parse wheel state from gameState
  const wheelSpins = useMemo(
    () => gameState.wheelSpins || [],
    [gameState.wheelSpins],
  );

  // Detect pending spins from other clients and trigger local animation
  // This syncs the wheel animation across all connected clients
  useEffect(() => {
    const pendingSpin = gameState.pendingSpin;

    if (!pendingSpin) return;

    // Skip if we're already animating
    if (isWheelAnimating) return;

    // Skip if we've already processed this spin (or a newer one)
    if (lastProcessedSpinTimestamp && pendingSpin.timestamp <= lastProcessedSpinTimestamp) {
      return;
    }

    // Skip if the spin is too old (more than 4 seconds) - stale data
    const spinAge = Date.now() - pendingSpin.timestamp;
    if (spinAge > 4000) return;

    // Trigger the animation locally
    triggerWheelAnimation(pendingSpin.targetValue, pendingSpin.timestamp);
  }, [gameState.pendingSpin, isWheelAnimating, lastProcessedSpinTimestamp, triggerWheelAnimation]);

  const currentSpinnerId = gameState.currentSpinner;
  const currentWheelPosition = gameState.currentWheelPosition || 100; // Backend provides position
  const playerTotals = gameState.playerTotals || [];
  const needsSpinoff = gameState.needsSpinoff || false;
  const wheelWinner = gameState.wheelWinner;
  const spinoffNumber = gameState.spinoffNumber;

  // Get wheel participants from playerTotals (includes full player info from backend)
  const wheelParticipants = playerTotals;

  // Find current spinner - state won't change during animation so we can use directly
  const currentSpinnerContestant = currentSpinnerId
    ? wheelParticipants.find((p) => p.player_id === currentSpinnerId)
    : null;

  // Current spinoff number (0 for regular round)
  const currentSpinoffNumber = spinoffNumber || 0;

  // Find leader (highest total that is ≤ 100 and not eliminated)
  // Only show leader if at least one player has completed their turn
  const hasAnyCompletedTurn = wheelParticipants.some((p) => {
    // Filter spins by current spinoff number
    const spins = wheelSpins.filter(
      (s) =>
        s.player_id === p.player_id &&
        s.spinoff_number === currentSpinoffNumber,
    );
    const pt = playerTotals.find((pt) => pt.player_id === p.player_id);

    // Completed if eliminated OR if they've spun and are not the current spinner
    return (
      pt?.eliminated || (spins.length > 0 && p.player_id !== currentSpinnerId)
    );
  });

  const leaderTotal = hasAnyCompletedTurn
    ? playerTotals
        .filter(
          (pt) =>
            !pt.eliminated &&
            pt.total <= 100 &&
            pt.player_id !== currentSpinnerId,
        )
        .reduce((max, pt) => (pt.total > max ? pt.total : max), 0)
    : 0;

  const leaderContestant =
    leaderTotal > 0
      ? wheelParticipants.find((c) => {
          const pt = playerTotals.find((p) => p.player_id === c.player_id);
          return (
            pt &&
            pt.total === leaderTotal &&
            !pt.eliminated &&
            c.player_id !== currentSpinnerId // Exclude current spinner from leader position
          );
        })
      : null;

  // Find all tied players (when needsSpinoff is true)
  const tiedPlayers = needsSpinoff
    ? wheelParticipants.filter((c) => {
        const pt = playerTotals.find((p) => p.player_id === c.player_id);
        return pt && pt.total === leaderTotal && !pt.eliminated;
      })
    : [];

  // Find waiting spinners (contestants who haven't had their turn yet in this round)
  const waitingSpinners = wheelParticipants.filter((c) => {
    const pt = playerTotals.find((p) => p.player_id === c.player_id);
    // Filter spins by current spinoff number
    const spins = wheelSpins.filter(
      (s) =>
        s.player_id === c.player_id &&
        s.spinoff_number === currentSpinoffNumber,
    );

    // Skip eliminated players (they disappear)
    if (pt?.eliminated) return false;

    // Skip current spinner (shown separately at top)
    if (c.player_id === currentSpinnerId) return false;

    // Skip leader (shown separately on left)
    if (c.player_id === leaderContestant?.player_id) return false;

    // Skip tied players when spinoff needed (shown on left)
    if (
      needsSpinoff &&
      tiedPlayers.some((tp) => tp.player_id === c.player_id)
    ) {
      return false;
    }

    // Only include players who haven't spun yet in this round
    // Players who have spun and completed their turn will either:
    // 1. Be the leader (shown on left)
    // 2. Be eliminated (disappear)
    // 3. Not be the leader (disappear - only best score stays visible)
    return spins.length === 0;
  });

  // Get current player's total - state won't change during animation
  const currentPlayerTotal = currentSpinnerId
    ? playerTotals.find((pt) => pt.player_id === currentSpinnerId)?.total || 0
    : 0;

  // Get current player's spin count (in current round)
  const currentPlayerSpins = currentSpinnerId
    ? wheelSpins.filter(
        (s) =>
          s.player_id === currentSpinnerId &&
          s.spinoff_number === currentSpinoffNumber,
      ).length
    : 0;

  // Determine if current user is the current spinner
  const isCurrentSpinner = currentPlayerId === currentSpinnerId;

  // Handlers
  const handleSpin = async () => {
    if (!currentPlayerId) {
      showToast({
        title: "Error",
        description: "You must be logged in to spin",
        type: "error",
      });
      return;
    }

    if (!isCurrentSpinner && role !== "host") {
      showToast({
        title: "Not Your Turn",
        description: "Wait for your turn to spin",
        type: "warning",
      });
      return;
    }

    try {
      // Host spins for the current spinner
      // If no current spinner or spinner is done, silently ignore (wheel should be inactive)
      if (role === "host") {
        if (!currentSpinnerId || currentSpinnerIsDone) {
          return;
        }
        await spinWheel(currentSpinnerId);
      } else {
        // Player can only spin for themselves
        if (!currentPlayerId) return;
        await spinWheel(currentPlayerId);
      }
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to spin wheel",
        type: "error",
      });
    }
  };

  const handleStay = async () => {
    try {
      // Host stays for current spinner, player stays for themselves
      const playerIdToStay =
        role === "host" && currentSpinnerId
          ? currentSpinnerId
          : currentPlayerId;

      if (!playerIdToStay) return;

      await stayOnWheelSpin(playerIdToStay);
    } catch (error) {
      showToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to stay",
        type: "error",
      });
    }
  };

  const handleSpinAgain = async () => {
    try {
      // Host spins for current spinner, player spins for themselves
      const playerIdToSpin =
        role === "host" && currentSpinnerId
          ? currentSpinnerId
          : currentPlayerId;

      if (!playerIdToSpin) return;

      await spinWheel(playerIdToSpin);
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to spin again",
        type: "error",
      });
    }
  };

  const handleNextSpinner = async () => {
    if (!currentSpinnerId) return;

    try {
      // Complete the current player's turn, which advances to next spinner
      await stayOnWheelSpin(currentSpinnerId);
      showToast({
        title: "Turn Complete",
        description: "Moving to next spinner",
        type: "success",
      });
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to advance spinner",
        type: "error",
      });
    }
  };

  const handleStartSpinOff = async () => {
    try {
      const nextSpinoffNumber = (spinoffNumber || 0) + 1;
      await startSpinOff(nextSpinoffNumber);
      showToast({
        title: "Spin-Off Started",
        description: "Tie-breaker round begins!",
        type: "info",
      });
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to start spin-off",
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

  const handleResetWheel = async () => {
    try {
      await resetWheelPhase();
      showToast({
        title: "Wheel Reset",
        description: "Wheel phase has been reset to the first player.",
        type: "success",
      });
    } catch (error) {
      showToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to reset wheel",
        type: "error",
      });
    }
  };

  // Show player controls if user is current spinner and has spun once
  // OR if user is host and current spinner has spun once
  // NOTE: In spin-off rounds, players only get 1 spin - no Stay/Spin Again option
  const isInSpinoff = currentSpinoffNumber > 0;
  const currentSpinnerHasSpunOnce =
    currentPlayerSpins === 1 &&
    currentPlayerTotal < 100 &&
    currentPlayerTotal > 0 &&
    !isInSpinoff; // No second spin option in spin-offs

  const showPlayerControls =
    currentSpinnerHasSpunOnce && (isCurrentSpinner || role === "host");

  // Current spinner is "done" when they've used both spins or are eliminated
  const currentSpinnerIsDone =
    currentSpinnerId &&
    !currentSpinnerHasSpunOnce &&
    currentPlayerSpins > 0 &&
    !wheelWinner &&
    !needsSpinoff;

  // Show "Next Spinner" button for host when current spinner has spun at least once
  // and there are more players waiting to spin
  const showNextSpinnerButton =
    role === "host" &&
    currentSpinnerId &&
    currentPlayerSpins > 0 &&
    waitingSpinners.length > 0 &&
    !wheelWinner &&
    !needsSpinoff;

  // Show host controls if user is host
  const showHostControls = role === "host";

  // Winner celebration - state won't change during animation, so we can use wheelWinner directly
  // showWinnerCelebration will only be true when animation is done AND there's a winner
  const showWinnerCelebration = wheelWinner != null && !isWheelAnimating;
  const winnerContestant = wheelWinner
    ? wheelParticipants.find((c) => c.player_id === wheelWinner)
    : null;
  const winnerTotal = wheelWinner
    ? playerTotals.find((pt) => pt.player_id === wheelWinner)?.total || 0
    : 0;

  // Find runner-up (second best score, not eliminated, not the winner)
  const runnerUpTotal = showWinnerCelebration
    ? playerTotals
        .filter(
          (pt) =>
            !pt.eliminated && pt.total <= 100 && pt.player_id !== wheelWinner,
        )
        .reduce((max, pt) => (pt.total > max ? pt.total : max), 0)
    : 0;

  const runnerUpContestant =
    runnerUpTotal > 0
      ? wheelParticipants.find((c) => {
          const pt = playerTotals.find((p) => p.player_id === c.player_id);
          return (
            pt &&
            pt.total === runnerUpTotal &&
            !pt.eliminated &&
            c.player_id !== wheelWinner
          );
        })
      : null;

  return (
    <>
      <PhaseBackground phase="wheel">
        <Box width="100%" height="100%" position="relative">
          {/* Main Content: Waiting Spinners | Current Spinner | Wheel | Leader */}
          {/* Wheel positioned 10em from right edge */}
          <HStack
            position="absolute"
            right={{ base: "1em", lg: "3em" }}
            top="50%"
            transform="translateY(-50%)"
            gap={{ base: 2, lg: 4 }}
            alignItems="flex-start"
          >
            {/* Waiting Spinners (leftmost) - Hidden when winner is determined */}
            {/* Reversed so next-to-spin is closest to current player */}
            {!showWinnerCelebration && waitingSpinners.length > 0 && (
              <HStack gap={{ base: 2, lg: 4 }} alignItems="flex-start">
                {[...waitingSpinners].reverse().map((spinner) => (
                  <VStack key={spinner.player_id} gap={{ base: 1, lg: 2 }}>
                    <Box
                      bg="white"
                      px={{ base: 1, lg: 2 }}
                      borderRadius="md"
                      boxShadow="sm"
                      border="5px solid black"
                      height={{ base: "40px", lg: "54px" }}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text
                        fontSize={{ base: "xs", lg: "md" }}
                        fontWeight="bold"
                        textAlign="center"
                        color="gray.800"
                      >
                        {spinner.first_name}
                      </Text>
                    </Box>
                    <Box
                      width={{ base: "86px", lg: "120px" }}
                      height={{ base: "86px", lg: "120px" }}
                      overflow="hidden"
                      borderRadius="md"
                      border="3px solid"
                      borderColor="gray.300"
                      boxShadow="sm"
                    >
                      <PlayerCard
                        player={{ ...spinner, id: spinner.player_id }}
                        size="small"
                        fillContainer
                        showName={false}
                        variant="noBorder"
                      />
                    </Box>
                  </VStack>
                ))}
              </HStack>
            )}

            {/* Current Spinner (left of wheel) - Hidden when winner is determined */}
            {!showWinnerCelebration && currentSpinnerContestant && (
              <VStack gap={{ base: 1, lg: 2 }} marginRight={{ base: "-7em", lg: "-14em" }}>
                <Box
                  bg="white"
                  px={{ base: 2, lg: 3 }}
                  borderRadius="md"
                  boxShadow="sm"
                  border="5px solid black"
                  height={{ base: "36px", lg: "48px" }}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text
                    fontSize={{ base: "sm", lg: "xl" }}
                    fontWeight="bold"
                    textAlign="center"
                    color="gray.800"
                  >
                    {currentSpinnerContestant.first_name}
                  </Text>
                </Box>
                <Box
                  width={{ base: "173px", lg: "240px" }}
                  height={{ base: "173px", lg: "240px" }}
                  overflow="hidden"
                  borderRadius="md"
                  border="3px solid"
                  borderColor="blue.500"
                  boxShadow="0 0 20px rgba(59, 130, 246, 0.6)"
                >
                  <PlayerCard
                    player={{
                      ...currentSpinnerContestant,
                      id: currentSpinnerContestant.player_id,
                    }}
                    size="large"
                    fillContainer
                    variant="noBorder"
                    showName={false}
                  />
                </Box>

                {/* Total and controls - OUTSIDE overflow:hidden so they're not clipped */}
                {!isWheelAnimating && (
                  <Text
                    fontSize={{ base: "md", lg: "2xl" }}
                    fontWeight="bold"
                    color="blue.500"
                    textAlign="center"
                    bg="black"
                    px={{ base: 2, lg: 3 }}
                    py={1}
                    borderRadius="md"
                    boxShadow="0 0 10px rgba(255, 255, 255, 0.5)"
                  >
                    ${currentPlayerTotal.toFixed(2)}
                  </Text>
                )}

                {/* Player Controls (Stay/Spin Again buttons) */}
                {showPlayerControls && (
                  <HStack gap={2} justifyContent="center">
                    <Button
                      onClick={handleStay}
                      colorPalette="green"
                      size={{ base: "sm", lg: "md" }}
                      disabled={isWheelAnimating}
                    >
                      Stay
                    </Button>
                    <Button
                      onClick={handleSpinAgain}
                      colorPalette="blue"
                      size={{ base: "sm", lg: "md" }}
                      disabled={isWheelAnimating}
                    >
                      Spin Again
                    </Button>
                  </HStack>
                )}
              </VStack>
            )}

            {/* Wheel Display */}
            <Box
              id="wheel"
              width={{ base: "300px", lg: "600px" }}
              flexShrink={0}
              position="relative"
              right={{ base: "-7.5em", lg: "-15em" }}
              top={{ base: "-1em", lg: "-2em" }}
            >
              <WheelDisplay
                currentValue={currentWheelPosition}
                targetValue={
                  isWheelAnimating && pendingSpinTarget !== null
                    ? pendingSpinTarget
                    : undefined
                }
                isSpinning={isWheelAnimating}
                onSpin={handleSpin}
                disabled={
                  isWheelAnimating ||
                  !currentSpinnerId ||
                  currentSpinnerIsDone ||
                  (!isCurrentSpinner && role !== "host")
                }
                showSpinButton={role === "host" || isCurrentSpinner}
              />
            </Box>

            {/* Leader/Winner Section (right of wheel) */}
            <Box width={showWinnerCelebration ? { base: "210px", lg: "300px" } : { base: "144px", lg: "200px" }} flexShrink={0} marginLeft={{ base: "0.5em", lg: "1em" }}>
              {/* Show winner (large) + runner-up if wheel round is complete, otherwise show leader */}
              {showWinnerCelebration && winnerContestant ? (
                <VStack gap={{ base: 3, lg: 6 }} alignItems="center">
                  {/* Winner - Large */}
                  <VStack gap={2} alignItems="center">
                    {/* Badge outside overflow wrapper */}
                    <Box
                      bg="green.500"
                      color="white"
                      px={3}
                      py={1}
                      borderRadius="full"
                      fontWeight="bold"
                      fontSize="sm"
                      boxShadow="md"
                    >
                      WINNER
                    </Box>
                    <Box
                      width={{ base: "173px", lg: "240px" }}
                      height={{ base: "173px", lg: "240px" }}
                      overflow="hidden"
                      borderRadius="md"
                      border="3px solid"
                      borderColor="green.500"
                      boxShadow="0 0 20px rgba(34, 197, 94, 0.6)"
                    >
                      <PlayerCard
                        player={{ ...winnerContestant, id: winnerContestant.player_id }}
                        size="large"
                        fillContainer
                        variant="noBorder"
                      />
                    </Box>
                    <Text
                      fontSize={{ base: "md", lg: "2xl" }}
                      fontWeight="bold"
                      color="green.500"
                      textAlign="center"
                      bg="black"
                      px={{ base: 2, lg: 3 }}
                      py={1}
                      borderRadius="md"
                      boxShadow="0 0 10px rgba(255, 255, 255, 0.5)"
                    >
                      ${winnerTotal.toFixed(2)}
                    </Text>
                  </VStack>

                  {/* Runner-up - Small, beneath winner */}
                  {runnerUpContestant && (
                    <VStack gap={1} alignItems="center">
                      <Box
                        width={{ base: "86px", lg: "120px" }}
                        height={{ base: "86px", lg: "120px" }}
                        overflow="hidden"
                        borderRadius="md"
                        border="3px solid"
                        borderColor="gray.300"
                        boxShadow="sm"
                      >
                        <PlayerCard
                          player={{
                            ...runnerUpContestant,
                            id: runnerUpContestant.player_id,
                          }}
                          size="small"
                          fillContainer
                          showName={false}
                          variant="noBorder"
                        />
                      </Box>
                      <Text
                        fontSize={{ base: "xs", lg: "md" }}
                        fontWeight="bold"
                        color="gray.500"
                        textAlign="center"
                        bg="black"
                        px={{ base: 1, lg: 3 }}
                        py={1}
                        borderRadius="md"
                        boxShadow="0 0 10px rgba(255, 255, 255, 0.5)"
                      >
                        ${runnerUpTotal.toFixed(2)}
                      </Text>
                    </VStack>
                  )}
                </VStack>
              ) : needsSpinoff && tiedPlayers.length > 0 ? (
                <VStack gap={{ base: 6, lg: 12 }} alignItems="center">
                  {/* Show all tied players */}
                  {tiedPlayers.map((player) => (
                    <VStack key={player.player_id} gap={2} alignItems="center">
                      {/* Badge outside overflow wrapper */}
                      <Box
                        bg="orange.500"
                        color="white"
                        px={3}
                        py={1}
                        borderRadius="full"
                        fontWeight="bold"
                        fontSize="sm"
                        boxShadow="md"
                      >
                        TIE
                      </Box>
                      <Box
                        width={{ base: "108px", lg: "150px" }}
                        height={{ base: "108px", lg: "150px" }}
                        overflow="hidden"
                        borderRadius="md"
                        border="3px solid"
                        borderColor="yellow.400"
                        boxShadow="0 0 15px rgba(250, 204, 21, 0.5)"
                      >
                        <PlayerCard
                          player={{ ...player, id: player.player_id }}
                          size="medium"
                          fillContainer
                          showName={false}
                          variant="noBorder"
                        />
                      </Box>
                      <Text
                        fontSize={{ base: "md", lg: "2xl" }}
                        fontWeight="bold"
                        color="yellow.500"
                        textAlign="center"
                      >
                        ${leaderTotal.toFixed(2)}
                      </Text>
                    </VStack>
                  ))}
                </VStack>
              ) : leaderContestant ? (
                <VStack gap={2} alignItems="center">
                  {/* Badge outside overflow wrapper */}
                  <Box
                    bg="yellow.500"
                    color="white"
                    px={3}
                    py={1}
                    borderRadius="full"
                    fontWeight="bold"
                    fontSize="sm"
                    boxShadow="md"
                  >
                    LEADER
                  </Box>
                  <Box
                    width={{ base: "108px", lg: "150px" }}
                    height={{ base: "108px", lg: "150px" }}
                    overflow="hidden"
                    borderRadius="md"
                    border="3px solid"
                    borderColor="green.500"
                    boxShadow="0 0 15px rgba(34, 197, 94, 0.5)"
                  >
                    <PlayerCard
                      player={{ ...leaderContestant, id: leaderContestant.player_id }}
                      size="medium"
                      fillContainer
                      showName={false}
                      variant="noBorder"
                    />
                  </Box>
                  <Text
                    fontSize={{ base: "md", lg: "2xl" }}
                    fontWeight="bold"
                    color="green.500"
                    textAlign="center"
                    bg="black"
                    px={{ base: 2, lg: 3 }}
                    py={1}
                    borderRadius="md"
                    boxShadow="0 0 10px rgba(255, 255, 255, 0.5)"
                  >
                    ${leaderTotal.toFixed(2)}
                  </Text>
                </VStack>
              ) : null}
            </Box>
          </HStack>

          {/* Host Controls (Conditional) - Only show spin-off and winner controls here */}
          {showHostControls && needsSpinoff && !wheelWinner && (
            <Box position="absolute" bottom="120px" left="50%" transform="translateX(-50%)">
              <Button
                onClick={handleStartSpinOff}
                colorPalette="orange"
                size="md"
                disabled={isWheelAnimating}
              >
                Start Spin-Off (Tie-Breaker)
              </Button>
            </Box>
          )}
        </Box>
      </PhaseBackground>

      {/* Fixed Control Strip at Bottom */}
      <GameControlStrip
        gameState={gameState}
        role={role}
        onAdvancePhase={handleAdvancePhase}
        onNextSpinner={handleNextSpinner}
        onResetWheel={handleResetWheel}
        onRestartGame={handleRestartGame}
        onStartNewGame={handleStartNewGame}
        onRefreshGameState={handleRefreshGameState}
        onGoToPreviousPhase={goToPreviousPhase}
        showNextSpinnerButton={!!showNextSpinnerButton}
      />
    </>
  );
}
