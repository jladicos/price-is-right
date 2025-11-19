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
  HStack,
  Code,
  useToast,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import type { Player } from '../../../backend/src/types/player';
import { useAuthStore } from '../store/authStore';

interface ResetCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player;
  onSuccess?: () => void;
}

export function ResetCodeModal({ isOpen, onClose, player, onSuccess }: ResetCodeModalProps) {
  const toast = useToast();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [isResetting, setIsResetting] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const response = await fetch(`http://localhost:3001/api/players/${player.id}/reset-code`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset access code');
      }

      const data = await response.json();
      setNewCode(data.player.accessCode);

      toast({
        title: 'Access code reset',
        description: 'Player has been logged out and given a new code',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reset code',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleClose = () => {
    setNewCode(null);
    onClose();
  };

  const handleCopyNewCode = () => {
    if (newCode) {
      navigator.clipboard.writeText(newCode);
      toast({
        title: 'New code copied',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Reset Access Code</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {!newCode ? (
            <VStack spacing={4} align="stretch">
              <Alert status="warning">
                <AlertIcon />
                This will log out the player and generate a new access code
              </Alert>
              <Text>
                Are you sure you want to reset the access code for{' '}
                <strong>
                  {player.firstName} {player.lastName}
                </strong>
                ?
              </Text>
              <Text fontSize="sm" color="gray.600">
                Current code: <Code>{player.accessCode}</Code>
              </Text>
            </VStack>
          ) : (
            <VStack spacing={4} align="stretch">
              <Alert status="success">
                <AlertIcon />
                Access code has been reset successfully
              </Alert>
              <div>
                <Text fontSize="sm" fontWeight="medium" mb={2}>
                  New Access Code
                </Text>
                <HStack>
                  <Code fontSize="2xl" px={4} py={2} flex={1} textAlign="center">
                    {newCode}
                  </Code>
                  <Button onClick={handleCopyNewCode} colorScheme="blue" size="sm">
                    Copy
                  </Button>
                </HStack>
              </div>
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          {!newCode ? (
            <>
              <Button variant="ghost" mr={3} onClick={handleClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleReset} isLoading={isResetting}>
                Reset Code
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Close</Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
