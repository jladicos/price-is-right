import { useState, useEffect } from 'react';
import { Button, Input, VStack, Text, Box, HStack, Stack } from '@chakra-ui/react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from './ui/dialog';
import { NativeSelectRoot, NativeSelectField } from './ui/native-select';
import { apiRequest } from '../utils/api';
import { showToast } from '../utils/toast';

interface Player {
  id: number;
  firstName: string;
  lastName: string;
  photoFilename: string;
  role: string;
  active: boolean;
}

interface ManualSelectContestantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (playerId: number, position: number, segment: string) => Promise<void>;
  currentSegment?: string;
  initialPosition?: number;
}

export function ManualSelectContestantModal({
  isOpen,
  onClose,
  onConfirm,
  currentSegment = 'section_1',
  initialPosition = 1,
}: ManualSelectContestantModalProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [position, setPosition] = useState<number>(1);
  const [segment, setSegment] = useState<string>(currentSegment);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch active players
  useEffect(() => {
    if (!isOpen) return;

    const fetchPlayers = async () => {
      setIsLoading(true);
      try {
        const response = await apiRequest<{ players: Player[]; total: number }>(
          '/players?active=true',
        );
        setPlayers(response.players);
        setFilteredPlayers(response.players);
      } catch (err) {
        showToast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to load players',
          type: 'error',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayers();
  }, [isOpen]);

  // Update segment when currentSegment changes
  useEffect(() => {
    setSegment(currentSegment);
  }, [currentSegment]);

  // Update position when initialPosition changes
  useEffect(() => {
    if (isOpen && initialPosition) {
      setPosition(initialPosition);
    }
  }, [isOpen, initialPosition]);

  // Filter players based on search
  useEffect(() => {
    if (!searchTerm) {
      setFilteredPlayers(players);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = players.filter(
      (player) =>
        player.firstName.toLowerCase().includes(term) ||
        player.lastName.toLowerCase().includes(term),
    );
    setFilteredPlayers(filtered);
  }, [searchTerm, players]);

  const handleConfirm = async () => {
    if (!selectedPlayerId) {
      showToast({
        title: 'No Player Selected',
        description: 'Please select a player from the list',
        type: 'warning',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(selectedPlayerId, position, segment);
      handleClose();
    } catch (err) {
      showToast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to select contestant',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setSelectedPlayerId(null);
    setPosition(1);
    setSegment(currentSegment);
    onClose();
  };

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && handleClose()} size="lg">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manually Select Contestant</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>

        <DialogBody>
          <VStack gap={4} align="stretch">
            {/* Position and Segment Selectors */}
            <Stack direction={{ base: 'column', md: 'row' }} gap={4}>
              <Box flex={1}>
                <Text fontWeight="semibold" mb={2}>
                  Position
                </Text>
                <NativeSelectRoot>
                  <NativeSelectField
                    value={position}
                    onChange={(e) => setPosition(Number(e.target.value))}
                  >
                    <option value={1}>Position 1</option>
                    <option value={2}>Position 2</option>
                    <option value={3}>Position 3</option>
                    <option value={4}>Position 4</option>
                    <option value={5}>Position 5</option>
                  </NativeSelectField>
                </NativeSelectRoot>
              </Box>

              <Box flex={1}>
                <Text fontWeight="semibold" mb={2}>
                  Segment
                </Text>
                <NativeSelectRoot>
                  <NativeSelectField value={segment} onChange={(e) => setSegment(e.target.value)}>
                    <option value="section_1">Section 1</option>
                    <option value="section_2">Section 2</option>
                  </NativeSelectField>
                </NativeSelectRoot>
              </Box>
            </Stack>

            {/* Search Box */}
            <Box>
              <Text fontWeight="semibold" mb={2}>
                Search Players
              </Text>
              <Input
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Box>

            {/* Player List */}
            <Box>
              <Text fontWeight="semibold" mb={2}>
                Select Player ({filteredPlayers.length} found)
              </Text>
              <Box
                maxH="300px"
                overflowY="auto"
                border="1px solid"
                borderColor="gray.200"
                borderRadius="md"
                p={2}
              >
                {isLoading ? (
                  <Text color="gray.500" textAlign="center" py={4}>
                    Loading players...
                  </Text>
                ) : filteredPlayers.length === 0 ? (
                  <Text color="gray.500" textAlign="center" py={4}>
                    No players found
                  </Text>
                ) : (
                  <VStack gap={2} align="stretch">
                    {filteredPlayers.map((player) => (
                      <Box
                        key={player.id}
                        p={3}
                        border="2px solid"
                        borderColor={selectedPlayerId === player.id ? 'blue.500' : 'gray.200'}
                        borderRadius="md"
                        cursor="pointer"
                        bg={selectedPlayerId === player.id ? 'blue.50' : 'white'}
                        _hover={{ bg: 'gray.50' }}
                        onClick={() => setSelectedPlayerId(player.id)}
                      >
                        <HStack justify="space-between">
                          <VStack align="start" gap={0}>
                            <Text fontWeight="bold">
                              {player.firstName} {player.lastName}
                            </Text>
                            <Text fontSize="sm" color="gray.600" textTransform="capitalize">
                              Role: {player.role}
                            </Text>
                          </VStack>
                        </HStack>
                      </Box>
                    ))}
                  </VStack>
                )}
              </Box>
            </Box>

            {/* Preview */}
            {selectedPlayer && (
              <Box p={4} bg="blue.50" borderRadius="md">
                <Text fontWeight="semibold" mb={2}>
                  Selection Preview
                </Text>
                <Text fontSize="sm">
                  <strong>Player:</strong> {selectedPlayer.firstName} {selectedPlayer.lastName}
                </Text>
                <Text fontSize="sm">
                  <strong>Position:</strong> {position}
                </Text>
                <Text fontSize="sm">
                  <strong>Segment:</strong> {segment}
                </Text>
              </Box>
            )}
          </VStack>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleConfirm}
            loading={isSubmitting}
            disabled={!selectedPlayerId || isLoading}
          >
            Confirm Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
