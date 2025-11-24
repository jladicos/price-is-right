import { Box, Text } from "@chakra-ui/react";

interface SampleComponentProps {
  message: string;
}

/**
 * Sample component for testing setup
 * This will be removed once real components are added
 */
function SampleComponent({ message }: SampleComponentProps) {
  return (
    <Box p={4} borderWidth={1} borderRadius="md">
      <Text>{message}</Text>
    </Box>
  );
}

export default SampleComponent;
