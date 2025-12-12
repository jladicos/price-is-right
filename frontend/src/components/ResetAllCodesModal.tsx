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
import { Checkbox } from './ui/checkbox';
import { useAuthStore } from '../store/authStore';
import { showToast } from '../utils/toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ResetAllCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ResetAllCodesModal({ isOpen, onClose, onSuccess }: ResetAllCodesModalProps) {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [isResetting, setIsResetting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleReset = async () => {
    if (!confirmed) return;

    setIsResetting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/players/bulk/reset-codes`, {
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

      showToast({
        title: 'Access codes reset',
        description: data.message,
        type: 'success',
      });

      if (onSuccess) {
        onSuccess();
      }

      handleClose();
    } catch (error) {
      showToast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reset codes',
        type: 'error',
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
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && handleClose()} size="lg">
      <DialogContent>
        <DialogHeader>Reset All Access Codes</DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <VStack gap="4" align="stretch">
            <Alert status="error" title="Destructive Action Warning">
              This will reset access codes for ALL players in the system.
            </Alert>

            <Text fontWeight="bold">What will happen:</Text>
            <VStack gap="2" align="stretch" pl={4}>
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
              checked={confirmed}
              onCheckedChange={(e) => setConfirmed(e.checked === true)}
              colorPalette="red"
            >
              <Text fontWeight="bold">
                I understand this will affect ALL players and cannot be undone
              </Text>
            </Checkbox>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            colorPalette="red"
            onClick={handleReset}
            loading={isResetting}
            disabled={!confirmed}
          >
            Reset All Codes
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
