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
  HStack,
  Input,
  InputGroup,
  InputRightElement,
  useToast,
  Code,
} from '@chakra-ui/react';
import type { Player } from '../../../backend/src/types/player';

interface ViewCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player;
}

export function ViewCodeModal({ isOpen, onClose, player }: ViewCodeModalProps) {
  const toast = useToast();

  const gameUrl = `${window.location.origin}/?code=${player.accessCode}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(player.accessCode);
    toast({
      title: 'Access code copied',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(gameUrl);
    toast({
      title: 'URL copied',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          Access Code for {player.firstName} {player.lastName}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <div>
              <Text fontSize="sm" fontWeight="medium" mb={2}>
                Access Code
              </Text>
              <HStack>
                <Code fontSize="2xl" px={4} py={2} flex={1} textAlign="center">
                  {player.accessCode}
                </Code>
                <Button onClick={handleCopyCode} colorScheme="blue" size="sm">
                  Copy
                </Button>
              </HStack>
            </div>

            <div>
              <Text fontSize="sm" fontWeight="medium" mb={2}>
                Direct Link
              </Text>
              <InputGroup>
                <Input value={gameUrl} readOnly size="sm" />
                <InputRightElement width="4.5rem">
                  <Button onClick={handleCopyUrl} size="xs" h="1.75rem">
                    Copy
                  </Button>
                </InputRightElement>
              </InputGroup>
            </div>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
