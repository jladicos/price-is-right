import { useState, useEffect, useMemo } from "react";
import { Box, HStack, VStack, Button, Text } from "@chakra-ui/react";
import { WheelDisplay } from "../components/WheelDisplay";
import { PlayerCard } from "../components/PlayerCard";
import { GameControlStrip } from "../components/GameControlStrip";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { showToast } from "../utils/toast";
import type { GameState } from "../store/gameStore";

interface WheelPhaseViewProps {
  gameState: GameState;
}

export function WheelPhaseView({ gameState }: WheelPhaseViewProps) {
  const { currentPlayer } = useAuthStore();
  const {
    spinWheel,
    stayOnWheelSpin,
    startSpinOff,
    advancePhase,
    isWheelAnimating,
    startNewGame,
    fetchGameState,
    resetWheelPhase,
  } = useGameStore();

  const [targetSpinValue, setTargetSpinValue] = useState<number | null>(null); // Target for animation
  const [isSpinningState, setIsSpinningState] = useState(false);

  const role = currentPlayer?.role || "audience";
  const currentPlayerId = currentPlayer?.id;

  // Parse wheel state from gameState
  const wheelSpins = useMemo(
    () => gameState.wheelSpins || [],
    [gameState.wheelSpins],
  );
  const currentSpinnerId = gameState.currentSpinner;
  const currentWheelPosition = gameState.currentWheelPosition || 100; // Backend provides position
  const playerTotals = gameState.playerTotals || [];
  const needsSpinoff = gameState.needsSpinoff || false;
  const wheelWinner = gameState.wheelWinner;
  const spinoffNumber = gameState.spinoffNumber;

  // Get wheel participants from playerTotals (includes full player info from backend)
  const wheelParticipants = playerTotals;

  // Find current spinner
  const currentSpinnerContestant = currentSpinnerId
    ? wheelParticipants.find((p) => p.player_id === currentSpinnerId)
    : null;

  // Find leader (highest total that is ≤ 100 and not eliminated)
  // Only show leader if at least one player has completed their turn
  const hasAnyCompletedTurn = wheelParticipants.some((p) => {
    const spins = wheelSpins.filter((s) => s.player_id === p.player_id);
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

  // Find waiting spinners (contestants who haven't had their turn yet)
  const waitingSpinners = wheelParticipants.filter((c) => {
    const pt = playerTotals.find((p) => p.player_id === c.player_id);
    const spins = wheelSpins.filter((s) => s.player_id === c.player_id);

    // Skip eliminated players (they disappear)
    if (pt?.eliminated) return false;

    // Skip current spinner (shown separately at top)
    if (c.player_id === currentSpinnerId) return false;

    // Skip leader (shown separately on left)
    if (c.player_id === leaderContestant?.player_id) return false;

    // Only include players who haven't spun yet
    // Players who have spun and completed their turn will either:
    // 1. Be the leader (shown on left)
    // 2. Be eliminated (disappear)
    // 3. Not be the leader (disappear - only best score stays visible)
    return spins.length === 0;
  });

  // Get current player's total
  const currentPlayerTotal = currentSpinnerId
    ? playerTotals.find((pt) => pt.player_id === currentSpinnerId)?.total || 0
    : 0;

  // Get current player's spin count
  const currentPlayerSpins = currentSpinnerId
    ? wheelSpins.filter((s) => s.player_id === currentSpinnerId).length
    : 0;

  // Determine if current user is the current spinner
  const isCurrentSpinner = currentPlayerId === currentSpinnerId;

  // Handle new spins and set animation target
  useEffect(() => {
    if (wheelSpins.length > 0 && isWheelAnimating) {
      const lastSpin = wheelSpins[wheelSpins.length - 1];
      // Only update target if we're animating and don't already have a target
      if (lastSpin.player_id === currentSpinnerId) {
        const targetValue = Math.round(lastSpin.result * 100);
        console.log("[WheelPhaseView] Setting target spin value:", {
          rawResult: lastSpin.result,
          targetValue,
          currentWheelPosition,
        });
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTargetSpinValue(targetValue); // Convert to cents
      }
    }
  }, [wheelSpins, isWheelAnimating, currentSpinnerId, currentWheelPosition]);

  // Sync isSpinning state with store and clear target when done
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSpinningState(isWheelAnimating);

    // When animation completes, clear the target
    if (!isWheelAnimating) {
      setTargetSpinValue(null);
    }
  }, [isWheelAnimating]);

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
      // If no current spinner is set, we shouldn't be able to spin
      if (role === "host") {
        if (!currentSpinnerId) {
          showToast({
            title: "Error",
            description: "No current spinner set. Please advance the game.",
            type: "error",
          });
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
      showToast({
        title: "Stayed",
        description: `Final total: ${currentPlayerTotal}¢`,
        type: "success",
      });
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
      showToast({
        title: "Game Restarted",
        description: "New game started.",
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
        description: "New game started.",
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
  const currentSpinnerHasSpunOnce =
    currentPlayerSpins === 1 &&
    currentPlayerTotal < 100 &&
    currentPlayerTotal > 0;

  const showPlayerControls =
    currentSpinnerHasSpunOnce && (isCurrentSpinner || role === "host");

  // Show "Next Spinner" button if current spinner is done (either stayed or completed max spins or eliminated)
  // A spinner is done when they:
  // 1. Have 2 or more spins (max spins reached)
  // 2. Are eliminated (total >= 100)
  // 3. Have stayed (we need a way to detect this - for now, if they have spins and the Stay/Spin Again buttons aren't showing)
  const currentSpinnerIsDone =
    currentSpinnerId &&
    !currentSpinnerHasSpunOnce && // If the Stay/Spin Again buttons would show, they're NOT done yet
    currentPlayerSpins > 0 && // They must have at least one spin
    !wheelWinner && // No winner yet
    !needsSpinoff; // No tie yet

  const showNextSpinnerButton =
    role === "host" && currentSpinnerIsDone && waitingSpinners.length > 0; // Only if there are more spinners waiting

  // Show host controls if user is host
  const showHostControls = role === "host";

  // Winner celebration
  const showWinnerCelebration = wheelWinner != null;
  const winnerContestant = wheelWinner
    ? wheelParticipants.find((c) => c.player_id === wheelWinner)
    : null;
  const winnerTotal = wheelWinner
    ? playerTotals.find((pt) => pt.player_id === wheelWinner)?.total || 0
    : 0;

  return (
    <VStack gap={8} width="100%" p={4} pt="120px" pb="120px">
      {/* Add top and bottom padding for fixed elements */}

      {/* Main Content: Leader on left, Wheel in center, Current/Waiting on right */}
      <HStack
        gap={8}
        width="100%"
        maxWidth="1800px"
        alignItems="flex-start"
        justifyContent="center"
      >
        {/* Leader Section (Left) */}
        <Box width="200px" flexShrink={0}>
          {leaderContestant && (
            <VStack gap={2} alignItems="center">
              <PlayerCard
                player={{ ...leaderContestant, id: leaderContestant.player_id }}
                size="medium"
                showName
              >
                <VStack gap={2} alignItems="center">
                  <Text
                    fontSize="2xl"
                    fontWeight="bold"
                    color="green.500"
                    textAlign="center"
                  >
                    ${leaderTotal.toFixed(2)}
                  </Text>
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
                </VStack>
              </PlayerCard>
            </VStack>
          )}
        </Box>

        {/* Wheel Display (Center) */}
        <Box width="600px" flexShrink={0}>
          <WheelDisplay
            currentValue={currentWheelPosition}
            targetValue={
              isSpinningState && targetSpinValue !== null
                ? targetSpinValue
                : undefined
            }
            isSpinning={isSpinningState}
            onSpin={handleSpin}
            disabled={isSpinningState || (!isCurrentSpinner && role !== "host")}
          />
        </Box>

        {/* Current Spinner & Waiting Spinners (Right) */}
        <Box flex="1" minWidth="400px">
          <HStack gap={4} alignItems="flex-start" width="100%" wrap="wrap">
            {/* Current Spinner */}
            {currentSpinnerContestant && (
              <VStack gap={2}>
                <PlayerCard
                  player={{
                    ...currentSpinnerContestant,
                    id: currentSpinnerContestant.player_id,
                  }}
                  size="large"
                  variant="highlighted"
                  showName
                >
                  <VStack gap={6} width="100%" alignItems="center">
                    {!isSpinningState && !isWheelAnimating && (
                      <Text
                        fontSize="2xl"
                        fontWeight="bold"
                        color="blue.500"
                        textAlign="center"
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
                          size="md"
                          disabled={isSpinningState}
                        >
                          Stay
                        </Button>
                        <Button
                          onClick={handleSpinAgain}
                          colorPalette="blue"
                          size="md"
                          disabled={isSpinningState}
                        >
                          Spin Again
                        </Button>
                      </HStack>
                    )}
                  </VStack>
                </PlayerCard>
              </VStack>
            )}

            {/* Waiting Spinners */}
            {waitingSpinners.map((spinner) => (
              <Box key={spinner.player_id}>
                <PlayerCard
                  player={{ ...spinner, id: spinner.player_id }}
                  size="small"
                  showName
                />
              </Box>
            ))}
          </HStack>
        </Box>
      </HStack>

      {/* Host Controls (Conditional) - Only show spin-off and winner controls here */}
      {showHostControls && (
        <VStack gap={2} width="100%">
          {needsSpinoff && !wheelWinner && (
            <Button
              onClick={handleStartSpinOff}
              colorPalette="orange"
              size="md"
              disabled={isSpinningState}
            >
              Start Spin-Off (Tie-Breaker)
            </Button>
          )}
          {wheelWinner && (
            <Text fontSize="lg" fontWeight="bold" color="green.500">
              Winner Determined! Use &quot;Next Phase&quot; button below to
              continue.
            </Text>
          )}
        </VStack>
      )}

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
        showNextSpinnerButton={!!showNextSpinnerButton}
      />

      {/* Winner Celebration Modal */}
      {showWinnerCelebration && winnerContestant && (
        <Box
          position="fixed"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          bg="green.500"
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
            <Text fontSize="3xl" fontWeight="bold">
              🎉 Winner! 🎉
            </Text>
            <Text fontSize="xl">
              {winnerContestant.first_name} {winnerContestant.last_name}
            </Text>
            <Text fontSize="lg">Final Total: ${winnerTotal.toFixed(2)}</Text>
            {role === "host" && (
              <Button
                onClick={handleAdvancePhase}
                colorPalette="white"
                variant="outline"
                size="sm"
              >
                Continue to Next Phase
              </Button>
            )}
          </VStack>
        </Box>
      )}
    </VStack>
  );
}
