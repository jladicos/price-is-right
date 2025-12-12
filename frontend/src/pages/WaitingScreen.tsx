import { Box, Text } from '@chakra-ui/react';

/**
 * WaitingScreen - Displayed to non-host players before the game officially starts
 * Shows "The Cost is Accurate" in Pricedown font
 */
export default function WaitingScreen() {
  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="black"
    >
      <Text
        fontFamily="'Pricedown', sans-serif"
        fontSize={{ base: '4xl', md: '6xl', lg: '8xl' }}
        color="white"
        textAlign="center"
        px={4}
      >
        The Cost is Accurate
      </Text>
    </Box>
  );
}
