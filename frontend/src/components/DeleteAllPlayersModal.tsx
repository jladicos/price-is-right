import { useState } from 'react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from './ui/dialog';
import { Button, Text, VStack, Input } from '@chakra-ui/react';
import { Alert } from './ui/alert';
import { Checkbox } from './ui/checkbox';
import { Field } from './ui/field';
import { useAuthStore } from '../store/authStore';
import { showToast } from '../utils/toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface DeleteAllPlayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DeleteAllPlayersModal({ isOpen, onClose, onSuccess }: DeleteAllPlayersModalProps) {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const CONFIRM_PHRASE = 'DELETE ALL PLAYERS';

  const handleDelete = async () => {
    if (!confirmed || confirmText !== CONFIRM_PHRASE) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/players/bulk/delete-all`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete players');
      }

      const data = await response.json();

      showToast({
        title: 'Players deleted',
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
        description: error instanceof Error ? error.message : 'Failed to delete players',
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setConfirmed(false);
    setConfirmText('');
    onClose();
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && handleClose()} size="lg">
      <DialogContent>
        <DialogHeader>Delete All Non-Host Players</DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <VStack gap="4" align="stretch">
            <Alert status="error" title="EXTREME DANGER: Permanent Data Loss">
              This will PERMANENTLY DELETE all non-host players from the database.
            </Alert>

            <Text fontWeight="bold" color="red.600">
              What will happen:
            </Text>
            <VStack gap="2" align="stretch" pl={4}>
              <Text>• ALL players (except hosts) will be PERMANENTLY DELETED</Text>
              <Text>• ALL audience members will be PERMANENTLY DELETED</Text>
              <Text>• This affects EVERY non-host player, ignoring current filters</Text>
              <Text>• Host accounts will be preserved</Text>
              <Text fontWeight="bold" color="red.600">
                • THIS CANNOT BE UNDONE
              </Text>
            </VStack>

            <Text color="gray.600" fontSize="sm">
              This is a dangerous operation typically used only to reset the game state between
              sessions. All deleted player data will be lost permanently.
            </Text>

            <Checkbox
              checked={confirmed}
              onCheckedChange={(e) => setConfirmed(e.checked === true)}
              colorPalette="red"
            >
              <Text fontWeight="bold">
                I understand this will permanently delete all non-host players
              </Text>
            </Checkbox>

            <Field label={`Type "${CONFIRM_PHRASE}" to confirm:`} required>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                autoComplete="off"
                bg={confirmText === CONFIRM_PHRASE ? 'green.50' : 'white'}
              />
            </Field>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            colorPalette="red"
            onClick={handleDelete}
            loading={isDeleting}
            disabled={!confirmed || confirmText !== CONFIRM_PHRASE}
          >
            Delete All Players
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
