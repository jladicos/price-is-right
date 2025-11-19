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
} from '@chakra-ui/react';
import type { Player } from '../../../backend/src/types/player';
import { useAuthStore } from '../store/authStore';

interface DeactivateModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player;
  onSuccess?: () => void;
}

export function DeactivateModal({ isOpen, onClose, player, onSuccess }: DeactivateModalProps) {
  const toast = useToast();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [isUpdating, setIsUpdating] = useState(false);

  const isDeactivating = player.active;
  const action = isDeactivating ? 'deactivate' : 'activate';
  const endpoint = isDeactivating ? 'deactivate' : 'activate';

  const handleConfirm = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch(`http://localhost:3001/api/players/${player.id}/${endpoint}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${action} player`);
      }

      toast({
        title: `Player ${isDeactivating ? 'deactivated' : 'activated'}`,
        description: isDeactivating
          ? 'Player has been deactivated and logged out'
          : 'Player has been activated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to ${action} player`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{isDeactivating ? 'Deactivate' : 'Activate'} Player</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {isDeactivating && (
              <Alert status="warning">
                <AlertIcon />
                This will log out the player and prevent them from accessing the game
              </Alert>
            )}
            <Text>
              Are you sure you want to {action}{' '}
              <strong>
                {player.firstName} {player.lastName}
              </strong>
              ?
            </Text>
            {isDeactivating && (
              <Text fontSize="sm" color="gray.600">
                You can reactivate them later from the admin panel.
              </Text>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme={isDeactivating ? 'red' : 'green'}
            onClick={handleConfirm}
            isLoading={isUpdating}
          >
            {isDeactivating ? 'Deactivate' : 'Activate'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
