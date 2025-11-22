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
import type { ContestantWithPlayer } from '../store/gameStore';
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

interface ReplaceContestantModalProps {
  isOpen: boolean;
  onClose: () => void;
  contestant: ContestantWithPlayer | null;
  onReplaceRandom: (contestantRowId: number) => Promise<void>;
  onReplaceManual: (contestantRowId: number, newPlayerId: number) => Promise<void>;
}

export function ReplaceContestantModal({
  isOpen,
  onClose,
  contestant,
  onReplaceRandom,
  onReplaceManual,
}: ReplaceContestantModalProps) {
  const [replacementType, setReplacementType] = useState<'random' | 'manual'>('random');
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch active players when switching to manual mode
  useEffect(() => {
    if (!isOpen || replacementType !== 'manual') return;

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
  }, [isOpen, replacementType]);

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
    if (!contestant) return;

    if (replacementType === 'random') {
      setIsSubmitting(true);
      try {
        await onReplaceRandom(contestant.id);
        handleClose();
      } catch (err) {
        showToast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to replace contestant',
          type: 'error',
        });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Manual replacement
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
        await onReplaceManual(contestant.id, selectedPlayerId);
        handleClose();
      } catch (err) {
        showToast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to replace contestant',
          type: 'error',
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleClose = () => {
    setReplacementType('random');
    setSearchTerm('');
    setSelectedPlayerId(null);
    setPlayers([]);
    setFilteredPlayers([]);
    onClose();
  };

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);

  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && handleClose()} size="lg">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace Contestant</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>

        <DialogBody>
          {!contestant ? (
            <Text>Loading...</Text>
          ) : (
            <VStack gap={4} align="stretch">
              {/* Current Contestant Info */}
              <Box p={4} bg="gray.50" borderRadius="md">
                <Text fontWeight="semibold" mb={2}>
                  Current Contestant
                </Text>
                <Text fontSize="sm">
                  <strong>Name:</strong> {contestant.first_name} {contestant.last_name}
                </Text>
                <Text fontSize="sm">
                  <strong>Position:</strong> {contestant.position}
                </Text>
                <Text fontSize="sm">
                  <strong>Status:</strong> {contestant.status}
                </Text>
              </Box>

              {/* Replacement Type Selection */}
              <Box>
                <Text fontWeight="semibold" mb={2}>
                  Replacement Method
                </Text>
                <Stack direction={{ base: 'column', md: 'row' }} gap={2}>
                  <Button
                    flex={1}
                    variant={replacementType === 'random' ? 'solid' : 'outline'}
                    colorScheme={replacementType === 'random' ? 'blue' : 'gray'}
                    onClick={() => setReplacementType('random')}
                  >
                    Random Selection
                  </Button>
                  <Button
                    flex={1}
                    variant={replacementType === 'manual' ? 'solid' : 'outline'}
                    colorScheme={replacementType === 'manual' ? 'blue' : 'gray'}
                    onClick={() => setReplacementType('manual')}
                  >
                    Manual Selection
                  </Button>
                </Stack>
              </Box>

              {/* Random Replacement Info */}
              {replacementType === 'random' && (
                <Box p={4} bg="blue.50" borderRadius="md">
                  <Text fontSize="sm">
                    A random player from the eligible audience pool will be selected to replace this
                    contestant.
                  </Text>
                </Box>
              )}

              {/* Manual Replacement Controls */}
              {replacementType === 'manual' && (
                <>
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
                      maxH="250px"
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
                        Replacement Preview
                      </Text>
                      <Text fontSize="sm">
                        <strong>New Player:</strong> {selectedPlayer.firstName}{' '}
                        {selectedPlayer.lastName}
                      </Text>
                      <Text fontSize="sm">
                        <strong>Position:</strong> {contestant.position}
                      </Text>
                    </Box>
                  )}
                </>
              )}
            </VStack>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            colorScheme="orange"
            onClick={handleConfirm}
            loading={isSubmitting}
            disabled={
              !contestant || isLoading || (replacementType === 'manual' && !selectedPlayerId)
            }
          >
            {replacementType === 'random' ? 'Replace Random' : 'Replace with Selected'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
