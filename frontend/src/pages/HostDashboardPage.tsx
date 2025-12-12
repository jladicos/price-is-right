import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Spinner,
  Center,
  Table,
  Badge,
} from '@chakra-ui/react';
import { Avatar } from '../components/ui/avatar';
import { apiRequest } from '../utils/api';
import { showToast } from '../utils/toast';

interface OnlinePlayer {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  photoFilename: string;
  active: boolean;
  createdAt: string;
}

interface OnlinePlayersResponse {
  total: number;
  byRole: {
    host: number;
    player: number;
    audience: number;
  };
  players: OnlinePlayer[];
}

export default function HostDashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<OnlinePlayersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOnlinePlayers = useCallback(async () => {
    try {
      const response = await apiRequest<OnlinePlayersResponse>('/players/online');
      setData(response);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch online players';
      setError(errorMessage);
      showToast({
        title: 'Error',
        description: errorMessage,
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and every 5 seconds
  useEffect(() => {
    fetchOnlinePlayers();
    const interval = setInterval(fetchOnlinePlayers, 5000);
    return () => clearInterval(interval);
  }, [fetchOnlinePlayers]);

  if (isLoading && !data) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (error && !data) {
    return (
      <Container maxW="4xl" centerContent py={10}>
        <VStack gap={6}>
          <Heading>Error</Heading>
          <Text>{error}</Text>
          <Button onClick={() => navigate('/welcome')}>Back to Welcome</Button>
        </VStack>
      </Container>
    );
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'host':
        return 'purple';
      case 'player':
        return 'green';
      default:
        return 'gray';
    }
  };

  return (
    <Container maxW="6xl" py={8}>
      <VStack gap={8} align="stretch">
        {/* Header */}
        <HStack justify="space-between" wrap="wrap" gap={4}>
          <VStack align="start" gap={1}>
            <Heading size="xl">Player Dashboard</Heading>
            <Text color="gray.600">
              {data?.total || 0} player{data?.total !== 1 ? 's' : ''} currently online
            </Text>
          </VStack>
          <HStack gap={3}>
            <Button variant="outline" onClick={() => navigate('/welcome')}>
              Back
            </Button>
            <Button colorPalette="green" onClick={() => navigate('/game')}>
              Enter Game
            </Button>
          </HStack>
        </HStack>

        {/* Role Breakdown */}
        <HStack gap={6} wrap="wrap">
          <Box bg="purple.50" p={4} borderRadius="lg" minW="120px">
            <VStack gap={1}>
              <Text fontSize="3xl" fontWeight="bold" color="purple.600">
                {data?.byRole.host || 0}
              </Text>
              <Text color="purple.600" fontWeight="medium">
                Host{data?.byRole.host !== 1 ? 's' : ''}
              </Text>
            </VStack>
          </Box>
          <Box bg="green.50" p={4} borderRadius="lg" minW="120px">
            <VStack gap={1}>
              <Text fontSize="3xl" fontWeight="bold" color="green.600">
                {data?.byRole.player || 0}
              </Text>
              <Text color="green.600" fontWeight="medium">
                Player{data?.byRole.player !== 1 ? 's' : ''}
              </Text>
            </VStack>
          </Box>
          <Box bg="gray.50" p={4} borderRadius="lg" minW="120px">
            <VStack gap={1}>
              <Text fontSize="3xl" fontWeight="bold" color="gray.600">
                {data?.byRole.audience || 0}
              </Text>
              <Text color="gray.600" fontWeight="medium">
                Audience
              </Text>
            </VStack>
          </Box>
        </HStack>

        {/* Players Table */}
        <Box bg="white" borderRadius="lg" shadow="sm" overflow="hidden">
          <Table.Root size="md">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Player</Table.ColumnHeader>
                <Table.ColumnHeader>Role</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data?.players.map((player) => (
                <Table.Row key={player.id}>
                  <Table.Cell>
                    <HStack gap={3}>
                      <Avatar
                        size="sm"
                        name={`${player.firstName} ${player.lastName}`}
                        src={`/images/players/${player.photoFilename}`}
                      />
                      <VStack align="start" gap={0}>
                        <Text fontWeight="medium">
                          {player.firstName} {player.lastName}
                        </Text>
                        {player.email && (
                          <Text fontSize="sm" color="gray.500">
                            {player.email}
                          </Text>
                        )}
                      </VStack>
                    </HStack>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette={getRoleBadgeColor(player.role)}>{player.role}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette={player.active ? 'green' : 'red'}>
                      {player.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              ))}
              {(!data?.players || data.players.length === 0) && (
                <Table.Row>
                  <Table.Cell colSpan={3}>
                    <Text color="gray.500" textAlign="center" py={4}>
                      No players currently online
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Root>
        </Box>

        {/* Auto-refresh indicator */}
        <Text fontSize="sm" color="gray.500" textAlign="center">
          Auto-refreshes every 5 seconds
        </Text>
      </VStack>
    </Container>
  );
}
