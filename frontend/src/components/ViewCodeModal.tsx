import { Button, Text, VStack, HStack, Input, Code } from '@chakra-ui/react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from './ui/dialog';
import type { Player } from '../../../backend/src/types/player';
import { showToast } from '../utils/toast';

interface ViewCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player;
}

export function ViewCodeModal({ isOpen, onClose, player }: ViewCodeModalProps) {
  const gameUrl = `${window.location.origin}/?code=${player.accessCode}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(player.accessCode);
    showToast({
      title: 'Access code copied',
      type: 'success',
    });
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(gameUrl);
    showToast({
      title: 'URL copied',
      type: 'success',
    });
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent>
        <DialogHeader>
          Access Code for {player.firstName} {player.lastName}
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <VStack gap="4" align="stretch">
            <div>
              <Text fontSize="sm" fontWeight="medium" mb={2}>
                Access Code
              </Text>
              <HStack>
                <Code fontSize="2xl" px={4} py={2} flex={1} textAlign="center">
                  {player.accessCode}
                </Code>
                <Button onClick={handleCopyCode} colorPalette="blue" size="sm">
                  Copy
                </Button>
              </HStack>
            </div>

            <div>
              <Text fontSize="sm" fontWeight="medium" mb={2}>
                Direct Link
              </Text>
              <HStack>
                <Input value={gameUrl} readOnly size="sm" flex={1} />
                <Button onClick={handleCopyUrl} size="sm">
                  Copy
                </Button>
              </HStack>
            </div>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
