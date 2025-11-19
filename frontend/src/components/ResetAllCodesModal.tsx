import { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  Text,
  VStack,
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Checkbox,
  Box,
} from '@chakra-ui/react';
import { useAuthStore } from '../store/authStore';

interface ResetAllCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ResetAllCodesModal({ isOpen, onClose, onSuccess }: ResetAllCodesModalProps) {
  const toast = useToast();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [isResetting, setIsResetting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleReset = async () => {
    if (!confirmed) return;

    setIsResetting(true);
    try {
      const response = await fetch('http://localhost:3001/api/players/bulk/reset-codes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset access codes');
      }

      const data = await response.json();

      toast({
        title: 'Access codes reset',
        description: data.message,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      if (onSuccess) {
        onSuccess();
      }

      handleClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reset codes',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleClose = () => {
    setConfirmed(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Reset All Access Codes</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Alert status="error">
              <AlertIcon />
              <Box>
                <AlertTitle>Destructive Action Warning</AlertTitle>
                <AlertDescription>
                  This will reset access codes for ALL players in the system.
                </AlertDescription>
              </Box>
            </Alert>

            <Text fontWeight="bold">What will happen:</Text>
            <VStack spacing={2} align="stretch" pl={4}>
              <Text>• ALL players will receive new access codes</Text>
              <Text>• ALL players will be immediately logged out</Text>
              <Text>• This affects EVERY player, ignoring current filters</Text>
              <Text>• This action cannot be undone</Text>
            </VStack>

            <Text color="gray.600" fontSize="sm">
              You will need to share the new access codes with all players before they can log in
              again.
            </Text>

            <Checkbox
              isChecked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              colorScheme="red"
            >
              <Text fontWeight="bold">
                I understand this will affect ALL players and cannot be undone
              </Text>
            </Checkbox>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            colorScheme="red"
            onClick={handleReset}
            isLoading={isResetting}
            isDisabled={!confirmed}
          >
            Reset All Codes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
