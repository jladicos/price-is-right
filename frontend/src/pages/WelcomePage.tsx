import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  VStack,
  Heading,
  Text,
  Avatar,
  HStack,
  useToast,
  Spinner,
  Center,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { useAuthStore } from '../store/authStore';
import { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';

export default function WelcomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { currentPlayer, loading, logout } = useAuthStore();
  const [gameEnabled, setGameEnabled] = useState(true);

  // Show error message if passed via navigation state
  useEffect(() => {
    if (location.state && (location.state as any).error) {
      toast({
        title: 'Access Denied',
        description: (location.state as any).error,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      // Clear the state so it doesn't show again on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, toast, navigate]);

  // Fetch game status
  useEffect(() => {
    const fetchGameStatus = async () => {
      try {
        const response = await apiRequest<{ enabled: boolean }>('/api/game/status');
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
      toast({
        title: 'Logout failed',
        description: err instanceof Error ? err.message : 'An error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handlePlaceholderClick = (feature: string) => {
    toast({
      title: 'Coming soon',
      description: `${feature} will be available in the next phase of development.`,
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  if (loading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (!currentPlayer) {
    return null; // ProtectedRoute will handle redirect
  }

  const playerPhotoUrl = `/images/players/${currentPlayer.photoFilename}`;

  return (
    <Container maxW="2xl" centerContent py={10}>
      <VStack spacing={8} w="100%">
        <Box w="100%" bg="white" p={8} borderRadius="lg" shadow="md" textAlign="center">
          <VStack spacing={6}>
            <Avatar
              size="2xl"
              name={`${currentPlayer.firstName} ${currentPlayer.lastName}`}
              src={playerPhotoUrl}
            />

            <VStack spacing={2}>
              <Heading size="lg">Welcome, {currentPlayer.firstName}!</Heading>
              <Text color="gray.600" fontSize="sm" textTransform="capitalize">
                Role: {currentPlayer.role}
              </Text>
            </VStack>

            {!gameEnabled && (
              <Alert status="warning" borderRadius="md">
                <AlertIcon />
                <Box>
                  <AlertTitle>Game Currently Disabled</AlertTitle>
                  <AlertDescription>
                    The game is currently in maintenance mode. Please check back later.
                  </AlertDescription>
                </Box>
              </Alert>
            )}

            <VStack spacing={3} w="100%" pt={4}>
              {currentPlayer.role === 'host' && (
                <>
                  <Button
                    colorScheme="blue"
                    width="100%"
                    size="lg"
                    onClick={() => handlePlaceholderClick('Game Control')}
                    isDisabled={!gameEnabled}
                  >
                    Game Control
                  </Button>
                  <Button
                    colorScheme="purple"
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
                  colorScheme="green"
                  width="100%"
                  size="lg"
                  onClick={() => handlePlaceholderClick('Enter Game')}
                  isDisabled={!gameEnabled}
                >
                  Enter Game
                </Button>
              )}

              {currentPlayer.role === 'audience' && (
                <Button
                  colorScheme="teal"
                  width="100%"
                  size="lg"
                  onClick={() => handlePlaceholderClick('Watch Game')}
                  isDisabled={!gameEnabled}
                >
                  Watch Game
                </Button>
              )}
            </VStack>
          </VStack>
        </Box>

        <HStack spacing={4}>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </HStack>
      </VStack>
    </Container>
  );
}
