import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Heading,
  Alert,
  AlertIcon,
  AlertDescription,
} from '@chakra-ui/react';
import { useAuthStore } from '../store/authStore';

export default function RootPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [accessCode, setAccessCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { sessionToken, currentPlayer, loading, error, login, clearError } = useAuthStore();

  // Check for URL parameter on mount
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');

    if (codeFromUrl) {
      // If code in URL, auto-fill and submit
      setAccessCode(codeFromUrl);
      handleLogin(codeFromUrl);
    } else if (sessionToken && currentPlayer && !loading) {
      // If already authenticated and no code param, redirect to welcome
      navigate('/welcome');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (code?: string) => {
    const codeToUse = code || accessCode;
    if (!codeToUse.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Normalize access code (trim and uppercase)
      const normalizedCode = codeToUse.trim().toUpperCase();
      await login(normalizedCode);
      // On success, navigate to welcome page
      navigate('/welcome');
    } catch (err) {
      // Error is already set in the store
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccessCode(e.target.value);
    // Clear error when user starts typing
    if (error) {
      clearError();
    }
  };

  return (
    <Container maxW="md" centerContent py={10}>
      <VStack spacing={8} w="100%">
        <Heading size="xl">Price Is Right Game</Heading>

        {error && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Box w="100%" bg="white" p={8} borderRadius="lg" shadow="md">
          <form onSubmit={handleSubmit}>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Access Code</FormLabel>
                <Input
                  type="text"
                  value={accessCode}
                  onChange={handleInputChange}
                  placeholder="Enter your 6-character code"
                  maxLength={6}
                  autoFocus
                  isDisabled={isSubmitting || loading}
                  textTransform="uppercase"
                />
              </FormControl>

              <Button
                type="submit"
                colorScheme="blue"
                width="100%"
                isLoading={isSubmitting || loading}
                loadingText="Logging in..."
                isDisabled={!accessCode.trim() || isSubmitting || loading}
              >
                Log In
              </Button>
            </VStack>
          </form>
        </Box>
      </VStack>
    </Container>
  );
}
