import { Box, Heading, Text, Container, VStack } from '@chakra-ui/react';

function HomePage() {
  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="center">
        <Box textAlign="center">
          <Heading as="h1" size="2xl" mb={4}>
            Welcome to The Price is Right!
          </Heading>
          <Text fontSize="xl" color="gray.600">
            A real-time multiplayer game experience
          </Text>
        </Box>
      </VStack>
    </Container>
  );
}

export default HomePage;
