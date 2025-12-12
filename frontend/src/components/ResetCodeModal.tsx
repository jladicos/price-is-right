import { useState } from 'react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from './ui/dialog';
import { Button, Text, VStack, HStack, Code } from '@chakra-ui/react';
import { Alert } from './ui/alert';
import type { Player } from '../../../backend/src/types/player';
import { useAuthStore } from '../store/authStore';
import { showToast } from '../utils/toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ResetCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player;
  onSuccess?: () => void;
}

export function ResetCodeModal({ isOpen, onClose, player, onSuccess }: ResetCodeModalProps) {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [isResetting, setIsResetting] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/players/${player.id}/reset-code`, {
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

      showToast({
        title: 'Access code reset',
        description: 'Player has been logged out and given a new code',
        type: 'success',
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reset code',
        type: 'error',
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
      showToast({
        title: 'New code copied',
        type: 'success',
      });
    }
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
      <DialogContent>
        <DialogHeader>Reset Access Code</DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          {!newCode ? (
            <VStack gap="4" align="stretch">
              <Alert status="warning">
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
            <VStack gap="4" align="stretch">
              <Alert status="success">Access code has been reset successfully</Alert>
              <div>
                <Text fontSize="sm" fontWeight="medium" mb={2}>
                  New Access Code
                </Text>
                <HStack>
                  <Code fontSize="2xl" px={4} py={2} flex={1} textAlign="center">
                    {newCode}
                  </Code>
                  <Button onClick={handleCopyNewCode} colorPalette="blue" size="sm">
                    Copy
                  </Button>
                </HStack>
              </div>
            </VStack>
          )}
        </DialogBody>
        <DialogFooter>
          {!newCode ? (
            <>
              <Button variant="ghost" mr={3} onClick={handleClose}>
                Cancel
              </Button>
              <Button colorPalette="red" onClick={handleReset} loading={isResetting}>
                Reset Code
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
