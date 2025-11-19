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
  FormControl,
  FormLabel,
  Input,
  Select,
  VStack,
  useToast,
  Alert,
  AlertIcon,
  Divider,
  Text,
} from '@chakra-ui/react';
import type { Player, PlayerRole } from '../../../backend/src/types/player';
import { useAuthStore } from '../store/authStore';
import { PhotoUpload } from './PhotoUpload';

interface EditPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player;
  onSuccess?: () => void;
}

export function EditPlayerModal({ isOpen, onClose, player, onSuccess }: EditPlayerModalProps) {
  const toast = useToast();
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

      toast({
        title: 'Player updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update player';
      setValidationError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
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
        <ModalHeader>
          Edit Player: {player.firstName} {player.lastName}
        </ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit}>
          <ModalBody>
            <VStack spacing={4} align="stretch">
              {/* Photo Upload Section (immediate) */}
              <PhotoUpload
                playerId={player.id}
                currentPhoto={player.photoFilename}
                onUploadSuccess={onSuccess}
              />

              <Divider />

              {/* Player Details Section (saved on submit) */}
              <Text fontSize="sm" fontWeight="medium" color="gray.600">
                Player Details
              </Text>

              {validationError && (
                <Alert status="error">
                  <AlertIcon />
                  {validationError}
                </Alert>
              )}

              <FormControl isRequired>
                <FormLabel>First Name</FormLabel>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Last Name</FormLabel>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Role</FormLabel>
                <Select value={role} onChange={(e) => setRole(e.target.value as PlayerRole)}>
                  <option value="host">Host</option>
                  <option value="player">Player</option>
                  <option value="audience">Audience</option>
                </Select>
              </FormControl>

              {player.role === 'player' && role === 'host' && (
                <Alert status="warning">
                  <AlertIcon />
                  Players cannot be promoted to host (unfair advantage)
                </Alert>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              colorScheme="blue"
              isLoading={isUpdating}
              isDisabled={
                !firstName.trim() ||
                !lastName.trim() ||
                (player.role === 'player' && role === 'host')
              }
            >
              Save Changes
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
