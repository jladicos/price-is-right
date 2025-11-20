import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  VStack,
  Heading,
  Text,
  HStack,
  Spinner,
  Center,
} from '@chakra-ui/react';
import { Avatar } from '../components/ui/avatar';
import { Alert } from '../components/ui/alert';
import { useAuthStore } from '../store/authStore';
import { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import { showToast } from '../utils/toast';

export default function WelcomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentPlayer, loading, logout } = useAuthStore();
  const [gameEnabled, setGameEnabled] = useState(true);

  // Show error message if passed via navigation state
  useEffect(() => {
    const locationState = location.state as { error?: string } | null;
    if (locationState?.error) {
      showToast({
        title: 'Access Denied',
        description: locationState.error,
        type: 'error',
      });
      // Clear the state so it doesn't show again on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Fetch game status
  useEffect(() => {
    const fetchGameStatus = async () => {
      try {
        const response = await apiRequest<{ enabled: boolean }>('/game/status');
        setGameEnabled(response.enabled);
      } catch (err) {
        console.error('Failed to fetch game status:', err);
      }
    };

    fetchGameStatus();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      showToast({
        title: 'Logout failed',
        description: err instanceof Error ? err.message : 'An error occurred',
        type: 'error',
      });
    }
  };

  const handlePlaceholderClick = (feature: string) => {
    showToast({
      title: 'Coming soon',
      description: `${feature} will be available in the next phase of development.`,
      type: 'info',
    });
  };

  if (loading) {
    return (
      <Center h="100vh">
        <Spinner size="xl">Loading</Spinner>
      </Center>
    );
  }

  if (!currentPlayer) {
    return null; // ProtectedRoute will handle redirect
  }

  const playerPhotoUrl = `/images/players/${currentPlayer.photoFilename}`;

  return (
    <Container maxW="2xl" centerContent py={10}>
      <VStack gap="8" w="100%">
        <Box w="100%" bg="white" p={8} borderRadius="lg" shadow="md" textAlign="center">
          <VStack gap="6">
            <Avatar
              size="2xl"
              name={`${currentPlayer.firstName} ${currentPlayer.lastName}`}
              src={playerPhotoUrl}
            />

            <VStack gap="2">
              <Heading size="lg">Welcome, {currentPlayer.firstName}!</Heading>
              <Text color="gray.600" fontSize="sm" textTransform="capitalize">
                Role: {currentPlayer.role}
              </Text>
            </VStack>

            {!gameEnabled && (
              <Alert status="warning" title="Game Currently Disabled">
                The game is currently in maintenance mode. Please check back later.
              </Alert>
            )}

            <VStack gap="3" w="100%" pt={4}>
              {currentPlayer.role === 'host' && (
                <>
                  <Button
                    colorPalette="blue"
                    width="100%"
                    size="lg"
                    onClick={() => navigate('/host/game-control')}
                    disabled={!gameEnabled}
                  >
                    Game Control
                  </Button>
                  <Button
                    colorPalette="purple"
                    width="100%"
                    size="lg"
                    onClick={() => navigate('/admin')}
                  >
                    Admin Tools
                  </Button>
                </>
              )}

              {currentPlayer.role === 'player' && (
                <Button
                  colorPalette="green"
                  width="100%"
                  size="lg"
                  onClick={() => handlePlaceholderClick('Enter Game')}
                  disabled={!gameEnabled}
                >
                  Enter Game
                </Button>
              )}

              {currentPlayer.role === 'audience' && (
                <Button
                  colorPalette="teal"
                  width="100%"
                  size="lg"
                  onClick={() => handlePlaceholderClick('Watch Game')}
                  disabled={!gameEnabled}
                >
                  Watch Game
                </Button>
              )}
            </VStack>
          </VStack>
        </Box>

        <HStack gap="4">
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </HStack>
      </VStack>
    </Container>
  );
}
