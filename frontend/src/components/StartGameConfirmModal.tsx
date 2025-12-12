import { Button, Text } from '@chakra-ui/react';
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from './ui/dialog';

interface StartGameConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function StartGameConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: StartGameConfirmModalProps) {
  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="md">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start New Game?</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        <DialogBody>
          <Text>
            This will reset all current game state and start a new game with 5 randomly selected
            contestants.
          </Text>
          <Text mt={3} fontWeight="semibold" color="orange.600">
            This action cannot be undone.
          </Text>
        </DialogBody>
        <DialogFooter>
          <DialogActionTrigger asChild>
            <Button variant="outline" disabled={isLoading}>
              Cancel
            </Button>
          </DialogActionTrigger>
          <Button colorScheme="red" onClick={onConfirm} loading={isLoading}>
            Start New Game
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
