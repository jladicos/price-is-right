import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Spinner,
  Center,
} from "@chakra-ui/react";
import { BiddingPhaseView } from "../components/phases/BiddingPhaseView";
import { WheelPhaseView } from "./WheelPhaseView";
import { ShowcasePhaseView } from "../components/phases/ShowcasePhaseView";
import { apiRequest } from "../utils/api";
import { showToast } from "../utils/toast";
import type { GameState } from "../store/gameStore";

type PhaseTab = "bidding" | "wheel" | "showcase";

interface TestDataResponse {
  phase: PhaseTab;
  testState: GameState;
  players: Array<{
    id: number;
    firstName: string;
    lastName: string;
    photoFilename: string;
  }>;
}

export default function UITestPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<PhaseTab>("bidding");
  const [testData, setTestData] = useState<TestDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTestData = useCallback(async (phase: PhaseTab) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest<TestDataResponse>(
        `/admin/ui-test-data?phase=${phase}`
      );
      setTestData(response);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch test data";
      setError(errorMessage);
      showToast({
        title: "Error",
        description: errorMessage,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch data when tab changes
  useEffect(() => {
    fetchTestData(activeTab);
  }, [activeTab, fetchTestData]);

  const handleTabChange = (tab: PhaseTab) => {
    setActiveTab(tab);
  };

  const renderPhaseView = () => {
    if (isLoading) {
      return (
        <Center h="400px">
          <Spinner size="xl" />
        </Center>
      );
    }

    if (error || !testData) {
      return (
        <Center h="400px">
          <VStack gap={4}>
            <Text color="red.500">{error || "No test data available"}</Text>
            <Button onClick={() => fetchTestData(activeTab)}>Retry</Button>
          </VStack>
        </Center>
      );
    }

    // Render the appropriate phase view with test data
    switch (activeTab) {
      case "bidding":
        return <BiddingPhaseView gameState={testData.testState} />;
      case "wheel":
        return <WheelPhaseView gameState={testData.testState} />;
      case "showcase":
        return <ShowcasePhaseView gameState={testData.testState} />;
      default:
        return null;
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bg="white"
        borderBottom="1px solid"
        borderColor="gray.200"
        zIndex={1000}
        px={4}
        py={2}
      >
        <HStack justify="space-between" maxW="1800px" mx="auto">
          <HStack gap={4}>
            <Heading size="md">UI Test Mode</Heading>
            <Text color="gray.500" fontSize="sm">
              Display only - interactions disabled
            </Text>
          </HStack>

          <HStack gap={2}>
            {/* Tab buttons */}
            <Button
              size="sm"
              colorPalette={activeTab === "bidding" ? "blue" : "gray"}
              variant={activeTab === "bidding" ? "solid" : "outline"}
              onClick={() => handleTabChange("bidding")}
            >
              Bidding
            </Button>
            <Button
              size="sm"
              colorPalette={activeTab === "wheel" ? "blue" : "gray"}
              variant={activeTab === "wheel" ? "solid" : "outline"}
              onClick={() => handleTabChange("wheel")}
            >
              Wheel
            </Button>
            <Button
              size="sm"
              colorPalette={activeTab === "showcase" ? "blue" : "gray"}
              variant={activeTab === "showcase" ? "solid" : "outline"}
              onClick={() => handleTabChange("showcase")}
            >
              Showcase
            </Button>

            <Box w="1px" h="24px" bg="gray.300" mx={2} />

            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchTestData(activeTab)}
            >
              Refresh Data
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/welcome")}
            >
              Exit
            </Button>
          </HStack>
        </HStack>
      </Box>

      {/* Phase Content - with top padding for fixed header */}
      <Box pt="60px">{renderPhaseView()}</Box>

      {/* Info overlay */}
      {testData && (
        <Box
          position="fixed"
          bottom="100px"
          right="20px"
          bg="blackAlpha.700"
          color="white"
          p={3}
          borderRadius="md"
          fontSize="sm"
          maxW="250px"
          zIndex={1001}
        >
          <Text fontWeight="bold" mb={1}>
            Test Players:
          </Text>
          {testData.players.slice(0, 3).map((p) => (
            <Text key={p.id} fontSize="xs">
              {p.firstName} {p.lastName}
            </Text>
          ))}
          {testData.players.length > 3 && (
            <Text fontSize="xs" color="gray.400">
              +{testData.players.length - 3} more
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}
