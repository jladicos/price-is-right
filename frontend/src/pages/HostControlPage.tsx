import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Container, Heading, Stack, Text, HStack, VStack } from '@chakra-ui/react';
import { useGameState } from '../hooks/useGameState';
import { useGameStore, type ContestantWithPlayer } from '../store/gameStore';
import { showToast } from '../utils/toast';
import { ManualSelectContestantModal } from '../components/ManualSelectContestantModal';
import { ReplaceContestantModal } from '../components/ReplaceContestantModal';
import { StartGameConfirmModal } from '../components/StartGameConfirmModal';

export default function HostControlPage() {
  const navigate = useNavigate();
  const { gameState, isLoading, error } = useGameState();
  const {
    startNewGame,
    advancePhase,
    revealContestant,
    manualSelectContestant,
    replaceContestantRandom,
    replaceContestantManual,
    refreshContestantsRow,
  } = useGameStore();

  const [isStarting, setIsStarting] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [revealingId, setRevealingId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal state
  const [isStartGameModalOpen, setIsStartGameModalOpen] = useState(false);
  const [isManualSelectOpen, setIsManualSelectOpen] = useState(false);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [contestantToReplace, setContestantToReplace] = useState<ContestantWithPlayer | null>(null);

  const handleStartNewGameClick = () => {
    // Check if there's a game in progress
    const workflow = gameState?.workflow;
    const hasGameInProgress = workflow && workflow.phase_type !== 'not_started';

    if (hasGameInProgress) {
      // Show confirmation modal if game is in progress
      setIsStartGameModalOpen(true);
    } else {
      // Start directly if no game in progress
      confirmStartNewGame();
    }
  };

  const confirmStartNewGame = async () => {
    setIsStartGameModalOpen(false);
    setIsStarting(true);
    try {
      await startNewGame();
    } catch (err) {
      showToast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to start game',
        type: 'error',
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleAdvancePhase = async () => {
    setIsAdvancing(true);
    try {
      await advancePhase();
    } catch (err) {
      showToast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to advance phase',
        type: 'error',
      });
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleRevealContestant = async (contestantRowId: number) => {
    setRevealingId(contestantRowId);
    try {
      await revealContestant(contestantRowId);
    } catch (err) {
      showToast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to reveal contestant',
        type: 'error',
      });
    } finally {
      setRevealingId(null);
    }
  };

  const handleOpenReplaceModal = (contestant: ContestantWithPlayer) => {
    setContestantToReplace(contestant);
    setIsReplaceModalOpen(true);
  };

  const handleManualSelectConfirm = async (playerId: number, position: number, segment: string) => {
    // Use the new manual select endpoint that handles both empty and occupied positions
    await manualSelectContestant(playerId, position, segment);
  };

  const handleReplaceRandomConfirm = async (contestantRowId: number) => {
    await replaceContestantRandom(contestantRowId);
  };

  const handleReplaceManualConfirm = async (contestantRowId: number, newPlayerId: number) => {
    await replaceContestantManual(contestantRowId, newPlayerId);
  };

  const handleRefreshRow = async () => {
    if (!confirm('Refresh all 5 contestants? This will replace everyone in the row.')) {
      return;
    }

    const segment = gameState?.workflow.current_segment === 'section_2' ? 'section_2' : 'section_1';

    setIsRefreshing(true);
    try {
      await refreshContestantsRow(segment);
    } catch (err) {
      showToast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to refresh row',
        type: 'error',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (error) {
    return (
      <Container maxW="7xl" py={8}>
        <VStack gap={6} align="stretch">
          {/* Header */}
          <HStack justify="space-between">
            <Heading size="lg">Host Game Control</Heading>
            <Button variant="outline" onClick={() => navigate('/welcome')}>
              Back to Welcome
            </Button>
          </HStack>

          <Card.Root>
            <Card.Body>
              <Heading size="lg" color="red.500">
                Error Loading Game State
              </Heading>
              <Text mt={4}>{error}</Text>
            </Card.Body>
          </Card.Root>
        </VStack>
      </Container>
    );
  }

  const workflow = gameState?.workflow;
  const contestants = gameState?.contestantsRow || [];
  const eligibleCount = gameState?.eligibleAudienceCount || 0;
  const canStartGame = eligibleCount >= 5;

  return (
    <Container maxW="7xl" py={8}>
      <VStack gap={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between">
          <Heading size="lg">Host Game Control</Heading>
          <Button variant="outline" onClick={() => navigate('/welcome')}>
            Back to Welcome
          </Button>
        </HStack>

        {/* Game Status Info */}
        <Card.Root>
          <Card.Body>
            <VStack align="start" gap={2}>
              <Text>
                <strong>Current Phase:</strong> {workflow?.phase_type || 'not_started'}
              </Text>
              <Text>
                <strong>Segment:</strong> {workflow?.current_segment || 'N/A'}
              </Text>
              <Text>
                <strong>Segment Index:</strong> {workflow?.current_segment_index ?? 'N/A'}
              </Text>
              <Text>
                <strong>Eligible Audience:</strong> {eligibleCount}
                {!canStartGame && (
                  <Text as="span" color="orange.600" ml={2}>
                    (Need at least 5 to start game)
                  </Text>
                )}
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Game Start Controls */}
        <Card.Root>
          <Card.Header>
            <Heading size="lg">Game Controls</Heading>
          </Card.Header>
          <Card.Body>
            <Stack gap={4}>
              <Button
                colorScheme="blue"
                size="lg"
                onClick={handleStartNewGameClick}
                loading={isStarting}
                disabled={isLoading || !canStartGame}
              >
                Start New Game
              </Button>
              {!canStartGame && (
                <Text fontSize="sm" color="orange.600">
                  ⚠️ Cannot start game: Need at least 5 eligible audience members. Currently have{' '}
                  {eligibleCount}. Add more players with the &quot;audience&quot; role from the
                  Admin Tools page.
                </Text>
              )}
              {workflow?.phase_type !== 'not_started' && (
                <Text fontSize="sm" color="gray.500">
                  Game in progress - starting new game will reset everything
                </Text>
              )}
            </Stack>
          </Card.Body>
        </Card.Root>

        {/* Contestants Display */}
        <Card.Root>
          <Card.Header>
            <HStack justify="space-between" flexWrap="wrap" gap={2}>
              <Heading size="lg">Contestants Row ({contestants.length}/5)</Heading>
              <HStack gap={2}>
                <Button
                  colorScheme="blue"
                  onClick={() => setIsManualSelectOpen(true)}
                  disabled={isLoading}
                >
                  Manual Select
                </Button>
                <Button
                  colorScheme="orange"
                  onClick={handleRefreshRow}
                  loading={isRefreshing}
                  disabled={isLoading || contestants.length === 0}
                >
                  Refresh Entire Row
                </Button>
              </HStack>
            </HStack>
          </Card.Header>
          <Card.Body>
            {contestants.length === 0 ? (
              <Text color="gray.500">No contestants selected yet. Start a new game to begin.</Text>
            ) : (
              <VStack gap={4} align="stretch">
                {contestants.map((contestant) => (
                  <Card.Root key={contestant.id} variant="outline">
                    <Card.Body>
                      <HStack justify="space-between">
                        <VStack align="start" gap={1}>
                          <Text fontWeight="bold">
                            Position {contestant.position}: {contestant.first_name}{' '}
                            {contestant.last_name}
                          </Text>
                          <Text fontSize="sm" color="gray.600">
                            Status: {contestant.status} | Role: {contestant.role}
                          </Text>
                          {contestant.revealed_at && (
                            <Text fontSize="sm" color="green.600">
                              Revealed at: {new Date(contestant.revealed_at).toLocaleTimeString()}
                            </Text>
                          )}
                        </VStack>
                        <HStack gap={2}>
                          {contestant.status === 'pending_reveal' && (
                            <Button
                              colorScheme="green"
                              onClick={() => handleRevealContestant(contestant.id)}
                              loading={revealingId === contestant.id}
                              disabled={isLoading}
                            >
                              Reveal
                            </Button>
                          )}
                          <Button
                            colorScheme="orange"
                            variant="outline"
                            onClick={() => handleOpenReplaceModal(contestant)}
                            disabled={isLoading}
                          >
                            Replace
                          </Button>
                        </HStack>
                      </HStack>
                    </Card.Body>
                  </Card.Root>
                ))}
              </VStack>
            )}
          </Card.Body>
        </Card.Root>

        {/* Phase Advancement */}
        {workflow?.phase_type !== 'not_started' && (
          <Card.Root>
            <Card.Header>
              <Heading size="lg">Phase Control</Heading>
            </Card.Header>
            <Card.Body>
              <Button
                colorScheme="purple"
                size="lg"
                onClick={handleAdvancePhase}
                loading={isAdvancing}
                disabled={isLoading || workflow?.current_segment === 'finale'}
              >
                Advance to Next Phase
              </Button>
              <Text fontSize="sm" color="gray.500" mt={2}>
                Current: {workflow?.current_segment} [{workflow?.current_segment_index}]
              </Text>
              {workflow?.current_segment === 'finale' && (
                <Text fontSize="sm" color="green.600" mt={2} fontWeight="bold">
                  ✓ Game Complete - You are at the finale (showcase showdown)
                </Text>
              )}
            </Card.Body>
          </Card.Root>
        )}

        {/* Modals */}
        <StartGameConfirmModal
          isOpen={isStartGameModalOpen}
          onClose={() => setIsStartGameModalOpen(false)}
          onConfirm={confirmStartNewGame}
          isLoading={isStarting}
        />

        <ManualSelectContestantModal
          isOpen={isManualSelectOpen}
          onClose={() => setIsManualSelectOpen(false)}
          onConfirm={handleManualSelectConfirm}
          currentSegment={workflow?.current_segment}
        />

        <ReplaceContestantModal
          isOpen={isReplaceModalOpen}
          onClose={() => {
            setIsReplaceModalOpen(false);
            setContestantToReplace(null);
          }}
          contestant={contestantToReplace}
          onReplaceRandom={handleReplaceRandomConfirm}
          onReplaceManual={handleReplaceManualConfirm}
        />
      </VStack>
    </Container>
  );
}
