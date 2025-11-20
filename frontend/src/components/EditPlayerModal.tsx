import { useState } from 'react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from './ui/dialog';
import { Button, Input, VStack, Separator, Text } from '@chakra-ui/react';
import { Field } from './ui/field';
import { NativeSelectRoot, NativeSelectField } from './ui/native-select';
import { Alert } from './ui/alert';
import type { Player, PlayerRole } from '../../../backend/src/types/player';
import { useAuthStore } from '../store/authStore';
import { PhotoUpload } from './PhotoUpload';
import { showToast } from '../utils/toast';

interface EditPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player;
  onSuccess?: () => void;
}

export function EditPlayerModal({ isOpen, onClose, player, onSuccess }: EditPlayerModalProps) {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [isUpdating, setIsUpdating] = useState(false);
  const [firstName, setFirstName] = useState(player.firstName);
  const [lastName, setLastName] = useState(player.lastName);
  const [role, setRole] = useState<PlayerRole>(player.role);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Client-side validation
    if (!firstName.trim() || !lastName.trim()) {
      setValidationError('First name and last name are required');
      return;
    }

    // Validate role change: player -> host is not allowed
    if (player.role === 'player' && role === 'host') {
      setValidationError('Cannot promote a player to host (unfair advantage)');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`http://localhost:3001/api/players/${player.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update player');
      }

      showToast({
        title: 'Player updated',
        type: 'success',
      });

      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update player';
      setValidationError(errorMessage);
      showToast({
        title: 'Error',
        description: errorMessage,
        type: 'error',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent>
        <DialogHeader>
          Edit Player: {player.firstName} {player.lastName}
        </DialogHeader>
        <DialogCloseTrigger />
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <VStack gap="4" align="stretch">
              {/* Photo Upload Section (immediate) */}
              <PhotoUpload
                playerId={player.id}
                currentPhoto={player.photoFilename}
                onUploadSuccess={onSuccess}
              />

              <Separator />

              {/* Player Details Section (saved on submit) */}
              <Text fontSize="sm" fontWeight="medium" color="gray.600">
                Player Details
              </Text>

              {validationError && <Alert status="error">{validationError}</Alert>}

              <Field label="First Name" required>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                />
              </Field>

              <Field label="Last Name" required>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                />
              </Field>

              <Field label="Role" required>
                <NativeSelectRoot>
                  <NativeSelectField
                    value={role}
                    onChange={(e) => setRole(e.target.value as PlayerRole)}
                  >
                    <option value="host">Host</option>
                    <option value="player">Player</option>
                    <option value="audience">Audience</option>
                  </NativeSelectField>
                </NativeSelectRoot>
              </Field>

              {player.role === 'player' && role === 'host' && (
                <Alert status="warning">
                  Players cannot be promoted to host (unfair advantage)
                </Alert>
              )}
            </VStack>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              colorPalette="blue"
              loading={isUpdating}
              disabled={
                !firstName.trim() ||
                !lastName.trim() ||
                (player.role === 'player' && role === 'host')
              }
            >
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
