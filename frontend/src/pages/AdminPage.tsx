/**
 * Admin Panel - Host-Only Administrative Interface
 *
 * Provides comprehensive tools for hosts to manage the game before and during events.
 * This page is protected by ProtectedRoute and requires host role for access.
 *
 * Key Features:
 * - Player Management: Search, filter, sort, and view all players
 * - Individual Actions: View codes, reset codes, edit details, activate/deactivate
 * - Role Management: Promote players to host or demote to player/audience
 * - Bulk Operations: Reset all codes, delete all players (with confirmations)
 * - Manual Player Addition: Add new players with photo upload
 * - Game Control: Toggle game enabled/disabled for maintenance mode
 * - Disaster Recovery: Export/import database for backups and restoration
 *
 * Authentication: Automatically redirected to /welcome if not authenticated as host
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Container,
  Heading,
  VStack,
  HStack,
  Input,
  Table,
  Spinner,
  Center,
  Text,
} from "@chakra-ui/react";
import {
  NativeSelectRoot,
  NativeSelectField,
} from "../components/ui/native-select";
import { Tag } from "../components/ui/tag";
import { Switch } from "../components/ui/switch";
import { Field } from "../components/ui/field";
import { apiRequest } from "../utils/api";
import { showToast } from "../utils/toast";
import type { Player } from "../../../backend/src/types/player";
import { ViewCodeModal } from "../components/ViewCodeModal";
import { ResetCodeModal } from "../components/ResetCodeModal";
import { DeactivateModal } from "../components/DeactivateModal";
import { EditPlayerModal } from "../components/EditPlayerModal";
import { AddPlayerModal } from "../components/AddPlayerModal";
import { ResetAllCodesModal } from "../components/ResetAllCodesModal";
import { DeleteAllPlayersModal } from "../components/DeleteAllPlayersModal";
import { ExportDatabaseModal } from "../components/ExportDatabaseModal";
import { ImportDatabaseModal } from "../components/ImportDatabaseModal";

interface PlayersResponse {
  players: Player[];
  total: number;
}

export default function AdminPage() {
  const navigate = useNavigate();

  // State
  const [players, setPlayers] = useState<Player[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "role" | "created_at">(
    "created_at",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [gameEnabled, setGameEnabled] = useState(true);
  const [isTogglingGame, setIsTogglingGame] = useState(false);

  // Modal state
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [viewCodeModalOpen, setViewCodeModalOpen] = useState(false);
  const [resetCodeModalOpen, setResetCodeModalOpen] = useState(false);
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addPlayerModalOpen, setAddPlayerModalOpen] = useState(false);
  const [resetAllCodesModalOpen, setResetAllCodesModalOpen] = useState(false);
  const [deleteAllPlayersModalOpen, setDeleteAllPlayersModalOpen] =
    useState(false);
  const [exportDatabaseModalOpen, setExportDatabaseModalOpen] = useState(false);
  const [importDatabaseModalOpen, setImportDatabaseModalOpen] = useState(false);

  // Fetch players
  const fetchPlayers = useCallback(async () => {
    try {
      setLoading(true);

      // Build query params
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (roleFilter !== "all") params.append("role", roleFilter);
      if (activeFilter !== "all") params.append("active", activeFilter);
      params.append("sortBy", sortBy);
      params.append("sortOrder", sortOrder);

      const response = await apiRequest<PlayersResponse>(
        `/players?${params.toString()}`,
      );

      setPlayers(response.players);
      setTotal(response.total);
    } catch (err) {
      showToast({
        title: "Failed to load players",
        description: err instanceof Error ? err.message : "An error occurred",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, activeFilter, sortBy, sortOrder]);

  // Load players on mount and when filters change
  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Fetch game status
  const fetchGameStatus = useCallback(async () => {
    try {
      const response = await apiRequest<{ enabled: boolean }>("/game/status");
      setGameEnabled(response.enabled);
    } catch (err) {
      console.error("Failed to fetch game status:", err);
    }
  }, []);

  // Load game status on mount
  useEffect(() => {
    fetchGameStatus();
  }, [fetchGameStatus]);

  // Toggle game enabled/disabled
  const toggleGameEnabled = async () => {
    setIsTogglingGame(true);
    try {
      const response = await apiRequest<{ enabled: boolean; message: string }>(
        "/game/status",
        {
          method: "PUT",
          body: JSON.stringify({ enabled: !gameEnabled }),
        },
      );

      setGameEnabled(response.enabled);
      showToast({
        title: response.message,
        type: response.enabled ? "success" : "warning",
      });
    } catch (err) {
      showToast({
        title: "Failed to update game status",
        description: err instanceof Error ? err.message : "An error occurred",
        type: "error",
      });
    } finally {
      setIsTogglingGame(false);
    }
  };

  // Role badge colors
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "host":
        return "red";
      case "player":
        return "blue";
      case "audience":
        return "gray";
      default:
        return "gray";
    }
  };

  // Toggle sort
  const toggleSort = (field: "name" | "role" | "created_at") => {
    if (sortBy === field) {
      // Toggle order
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // New field, default to ascending
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // Modal handlers
  const openViewCodeModal = (player: Player) => {
    setSelectedPlayer(player);
    setViewCodeModalOpen(true);
  };

  const openResetCodeModal = (player: Player) => {
    setSelectedPlayer(player);
    setResetCodeModalOpen(true);
  };

  const openDeactivateModal = (player: Player) => {
    setSelectedPlayer(player);
    setDeactivateModalOpen(true);
  };

  const openEditModal = (player: Player) => {
    setSelectedPlayer(player);
    setEditModalOpen(true);
  };

  const closeAllModals = () => {
    setViewCodeModalOpen(false);
    setResetCodeModalOpen(false);
    setDeactivateModalOpen(false);
    setEditModalOpen(false);
    setSelectedPlayer(null);
  };

  const handleModalSuccess = () => {
    closeAllModals();
    fetchPlayers();
  };

  if (loading && players.length === 0) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  return (
    <Container maxW="7xl" py={8}>
      <VStack gap="6" align="stretch">
        {/* Header */}
        <HStack justify="space-between">
          <Heading size="lg">Admin Tools</Heading>
          <HStack gap="4">
            <Field
              label={`Game ${gameEnabled ? "Enabled" : "Disabled"}`}
              display="flex"
              alignItems="center"
            >
              <Switch
                id="game-toggle"
                colorPalette={gameEnabled ? "green" : "red"}
                checked={gameEnabled}
                onCheckedChange={() => toggleGameEnabled()}
                disabled={isTogglingGame}
              />
            </Field>
            <Button variant="outline" onClick={() => navigate("/welcome")}>
              Back to Welcome
            </Button>
          </HStack>
        </HStack>

        {/* Filters */}
        <Box bg="white" p={4} borderRadius="lg" shadow="md">
          <VStack gap="4" align="stretch">
            <HStack gap="4">
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                flex={2}
              />
              <NativeSelectRoot flex={1}>
                <NativeSelectField
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  <option value="host">Host</option>
                  <option value="player">Player</option>
                  <option value="audience">Audience</option>
                </NativeSelectField>
              </NativeSelectRoot>
              <NativeSelectRoot flex={1}>
                <NativeSelectField
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </NativeSelectField>
              </NativeSelectRoot>
            </HStack>

            <HStack gap="4" wrap="wrap">
              <Button
                colorPalette="green"
                onClick={() => setAddPlayerModalOpen(true)}
              >
                Add Player
              </Button>
              <Button
                colorPalette="orange"
                variant="outline"
                onClick={() => setResetAllCodesModalOpen(true)}
              >
                Reset All Codes
              </Button>
              <Button
                colorPalette="red"
                variant="outline"
                onClick={() => setDeleteAllPlayersModalOpen(true)}
              >
                Delete All Players
              </Button>
              <Button
                colorPalette="blue"
                variant="outline"
                onClick={() => setExportDatabaseModalOpen(true)}
              >
                Export Database
              </Button>
              <Button
                colorPalette="purple"
                variant="outline"
                onClick={() => setImportDatabaseModalOpen(true)}
              >
                Import Database
              </Button>
            </HStack>
          </VStack>
        </Box>

        {/* Results count */}
        <Text color="gray.600">
          Showing {players.length} of {total} players
        </Text>

        {/* Players table */}
        <Box bg="white" borderRadius="lg" shadow="md" overflow="hidden">
          <Table.Root>
            <Table.Header bg="gray.50">
              <Table.Row>
                <Table.ColumnHeader
                  cursor="pointer"
                  onClick={() => toggleSort("name")}
                >
                  Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </Table.ColumnHeader>
                <Table.ColumnHeader
                  cursor="pointer"
                  onClick={() => toggleSort("role")}
                >
                  Role {sortBy === "role" && (sortOrder === "asc" ? "↑" : "↓")}
                </Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
                <Table.ColumnHeader>Access Code</Table.ColumnHeader>
                <Table.ColumnHeader>Actions</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {players.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={5} textAlign="center" py={8}>
                    <Text color="gray.500">No players found</Text>
                  </Table.Cell>
                </Table.Row>
              ) : (
                players.map((player) => (
                  <Table.Row key={player.id}>
                    <Table.Cell>
                      {player.firstName} {player.lastName}
                    </Table.Cell>
                    <Table.Cell>
                      <Tag colorPalette={getRoleBadgeColor(player.role)}>
                        {player.role}
                      </Tag>
                    </Table.Cell>
                    <Table.Cell>
                      <Tag colorPalette={player.active ? "green" : "red"}>
                        {player.active ? "Active" : "Inactive"}
                      </Tag>
                    </Table.Cell>
                    <Table.Cell fontFamily="mono" fontSize="sm">
                      {player.accessCode}
                    </Table.Cell>
                    <Table.Cell>
                      <HStack gap="2">
                        <Button
                          size="sm"
                          colorPalette="blue"
                          variant="outline"
                          onClick={() => openViewCodeModal(player)}
                        >
                          View Code
                        </Button>
                        <Button
                          size="sm"
                          colorPalette="purple"
                          variant="outline"
                          onClick={() => openEditModal(player)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          colorPalette="orange"
                          variant="outline"
                          onClick={() => openResetCodeModal(player)}
                        >
                          Reset Code
                        </Button>
                        <Button
                          size="sm"
                          colorPalette={player.active ? "red" : "green"}
                          variant="outline"
                          onClick={() => openDeactivateModal(player)}
                        >
                          {player.active ? "Deactivate" : "Activate"}
                        </Button>
                      </HStack>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        </Box>
      </VStack>

      {/* Modals */}
      {selectedPlayer && (
        <>
          <ViewCodeModal
            isOpen={viewCodeModalOpen}
            onClose={closeAllModals}
            player={selectedPlayer}
          />
          <ResetCodeModal
            isOpen={resetCodeModalOpen}
            onClose={closeAllModals}
            player={selectedPlayer}
            onSuccess={handleModalSuccess}
          />
          <DeactivateModal
            isOpen={deactivateModalOpen}
            onClose={closeAllModals}
            player={selectedPlayer}
            onSuccess={handleModalSuccess}
          />
          <EditPlayerModal
            isOpen={editModalOpen}
            onClose={closeAllModals}
            player={selectedPlayer}
            onSuccess={handleModalSuccess}
          />
        </>
      )}

      <AddPlayerModal
        isOpen={addPlayerModalOpen}
        onClose={() => setAddPlayerModalOpen(false)}
        onSuccess={() => {
          setAddPlayerModalOpen(false);
          fetchPlayers();
        }}
      />

      <ResetAllCodesModal
        isOpen={resetAllCodesModalOpen}
        onClose={() => setResetAllCodesModalOpen(false)}
        onSuccess={() => {
          setResetAllCodesModalOpen(false);
          fetchPlayers();
        }}
      />

      <DeleteAllPlayersModal
        isOpen={deleteAllPlayersModalOpen}
        onClose={() => setDeleteAllPlayersModalOpen(false)}
        onSuccess={() => {
          setDeleteAllPlayersModalOpen(false);
          fetchPlayers();
        }}
      />

      <ExportDatabaseModal
        isOpen={exportDatabaseModalOpen}
        onClose={() => setExportDatabaseModalOpen(false)}
      />

      <ImportDatabaseModal
        isOpen={importDatabaseModalOpen}
        onClose={() => setImportDatabaseModalOpen(false)}
        onSuccess={() => {
          setImportDatabaseModalOpen(false);
          fetchPlayers();
          fetchGameStatus();
        }}
      />
    </Container>
  );
}
