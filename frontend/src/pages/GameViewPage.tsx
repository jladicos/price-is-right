import { useEffect } from "react";
import {
  Container,
  VStack,
  Heading,
  Text,
  Button,
  Spinner,
  Center,
} from "@chakra-ui/react";
import { useGameState } from "../hooks/useGameState";
import { useGameStore } from "../store/gameStore";
import { useAuthStore } from "../store/authStore";
import { BiddingPhaseView } from "../components/phases/BiddingPhaseView";
import { WheelPhaseView } from "./WheelPhaseView";
import { showToast } from "../utils/toast";

export default function GameViewPage() {
  const { currentPlayer } = useAuthStore();
  const { gameState, isLoading, error } = useGameState();
  const { startNewGame } = useGameStore();

  const role = currentPlayer?.role || "audience";

  // Handle errors
  useEffect(() => {
    if (error) {
      showToast({
        title: "Error",
        description: error,
        type: "error",
      });
    }
  }, [error]);

  // Loading state
  if (isLoading && !gameState) {
    return (
      <Center h="100vh">
        <Spinner size="xl">Loading game...</Spinner>
      </Center>
    );
  }

  // No game state
  if (!gameState) {
    return (
      <Container maxW="4xl" centerContent py={10}>
        <VStack gap={6}>
          <Heading>Game Not Available</Heading>
          <Text>
            Unable to load game state. Please try refreshing the page.
          </Text>
        </VStack>
      </Container>
    );
  }

  const phaseType = gameState.workflow.phase_type;

  // Handle "not_started" phase
  if (phaseType === "not_started") {
    return (
      <Container maxW="4xl" centerContent py={10}>
        <VStack gap={6}>
          <Heading>Game Not Started</Heading>
          {role === "host" ? (
            <>
              <Text>Click the button below to start a new game.</Text>
              <Button
                colorPalette="blue"
                size="lg"
                onClick={async () => {
                  try {
                    await startNewGame();
                    showToast({
                      title: "Game Started",
                      description:
                        "5 contestants have been selected. Reveal them to begin!",
                      type: "success",
                    });
                  } catch (err) {
                    showToast({
                      title: "Error",
                      description:
                        err instanceof Error
                          ? err.message
                          : "Failed to start game",
                      type: "error",
                    });
                  }
                }}
              >
                Start New Game
              </Button>
            </>
          ) : (
            <Text>Waiting for the host to start the game...</Text>
          )}
        </VStack>
      </Container>
    );
  }

  // Route to appropriate phase component
  switch (phaseType) {
    case "bidding":
      return <BiddingPhaseView gameState={gameState} />;

    case "contestant_selection":
      // TODO: Implement ContestantSelectionPhaseView
      return (
        <Container maxW="4xl" centerContent py={10}>
          <VStack gap={6}>
            <Heading>Contestant Selection</Heading>
            <Text>
              Contestant selection phase in progress. Use{" "}
              <Text as="span" fontWeight="bold">
                /host/game-control
              </Text>{" "}
              for now.
            </Text>
          </VStack>
        </Container>
      );

    case "wheel":
      return <WheelPhaseView gameState={gameState} />;

    case "showcase":
      // TODO: Implement ShowcasePhaseView (Phase 7)
      return (
        <Container maxW="4xl" centerContent py={10}>
          <VStack gap={6}>
            <Heading>Showcase Showdown</Heading>
            <Text>Showcase Showdown phase - Coming in Phase 7</Text>
          </VStack>
        </Container>
      );

    default:
      return (
        <Container maxW="4xl" centerContent py={10}>
          <VStack gap={6}>
            <Heading>Unknown Phase</Heading>
            <Text>Phase type: {phaseType}</Text>
            <Text>This phase is not yet implemented.</Text>
          </VStack>
        </Container>
      );
  }
}
