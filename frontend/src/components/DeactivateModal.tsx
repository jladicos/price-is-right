import { useState } from 'react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from './ui/dialog';
import { Button, Text, VStack } from '@chakra-ui/react';
import { Alert } from './ui/alert';
import type { Player } from '../../../backend/src/types/player';
import { useAuthStore } from '../store/authStore';
import { showToast } from '../utils/toast';

interface DeactivateModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player;
  onSuccess?: () => void;
}

export function DeactivateModal({ isOpen, onClose, player, onSuccess }: DeactivateModalProps) {
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

      showToast({
        title: `Player ${isDeactivating ? 'deactivated' : 'activated'}`,
        description: isDeactivating
          ? 'Player has been deactivated and logged out'
          : 'Player has been activated',
        type: 'success',
      });

      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (error) {
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to ${action} player`,
        type: 'error',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent>
        <DialogHeader>{isDeactivating ? 'Deactivate' : 'Activate'} Player</DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <VStack gap="4" align="stretch">
            {isDeactivating && (
              <Alert status="warning">
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
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorPalette={isDeactivating ? 'red' : 'green'}
            onClick={handleConfirm}
            loading={isUpdating}
          >
            {isDeactivating ? 'Deactivate' : 'Activate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
