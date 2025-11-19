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
  Input,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import { useAuthStore } from '../store/authStore';

interface DeleteAllPlayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DeleteAllPlayersModal({ isOpen, onClose, onSuccess }: DeleteAllPlayersModalProps) {
  const toast = useToast();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const CONFIRM_PHRASE = 'DELETE ALL PLAYERS';

  const handleDelete = async () => {
    if (!confirmed || confirmText !== CONFIRM_PHRASE) return;

    setIsDeleting(true);
    try {
      const response = await fetch('http://localhost:3001/api/players/bulk/delete-all', {
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

      toast({
        title: 'Players deleted',
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
        description: error instanceof Error ? error.message : 'Failed to delete players',
        status: 'error',
        duration: 5000,
        isClosable: true,
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
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Delete All Non-Host Players</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Alert status="error">
              <AlertIcon />
              <Box>
                <AlertTitle>EXTREME DANGER: Permanent Data Loss</AlertTitle>
                <AlertDescription>
                  This will PERMANENTLY DELETE all non-host players from the database.
                </AlertDescription>
              </Box>
            </Alert>

            <Text fontWeight="bold" color="red.600">
              What will happen:
            </Text>
            <VStack spacing={2} align="stretch" pl={4}>
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
              isChecked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              colorScheme="red"
            >
              <Text fontWeight="bold">
                I understand this will permanently delete all non-host players
              </Text>
            </Checkbox>

            <FormControl isRequired>
              <FormLabel fontWeight="bold">Type &quot;{CONFIRM_PHRASE}&quot; to confirm:</FormLabel>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                autoComplete="off"
                bg={confirmText === CONFIRM_PHRASE ? 'green.50' : 'white'}
              />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            colorScheme="red"
            onClick={handleDelete}
            isLoading={isDeleting}
            isDisabled={!confirmed || confirmText !== CONFIRM_PHRASE}
          >
            Delete All Players
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
