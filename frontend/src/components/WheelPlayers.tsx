import { HStack, VStack, Text, Box } from "@chakra-ui/react";
import { PlayerCard } from "./PlayerCard";

interface Contestant {
  player_id: number;
  first_name: string;
  last_name: string;
  photo_filename: string;
}

interface WheelPlayersProps {
  leader?: Contestant | null;
  leaderTotal?: number;
  currentSpinner?: Contestant | null;
  currentTotal?: number;
  waitingSpinners?: Contestant[];
  hideSpinValue?: boolean;
}

/**
 * WheelPlayers Component
 *
 * Displays contestants in three sections during wheel spinning phase:
 * - Leader: Contestant with highest total (medium size)
 * - Current Spinner: Actively spinning contestant (large size)
 * - Waiting Spinners: Contestants yet to spin (small size, horizontal row)
 *
 * Only sections with contestants are rendered (dynamic layout).
 *
 * Features:
 * - Leader shows LEADER badge and total
 * - Current spinner shows CURRENT badge and total
 * - Waiting spinners show photos only (no badges/totals)
 * - Responsive grid layout
 */
export function WheelPlayers({
  leader,
  leaderTotal,
  currentSpinner,
  currentTotal,
  waitingSpinners = [],
  hideSpinValue = false,
}: WheelPlayersProps) {
  // Filter out empty sections
  const hasLeader = leader != null;
  const hasCurrent = currentSpinner != null;
  const hasWaiting = waitingSpinners.length > 0;

  // If nothing to show, return null
  if (!hasLeader && !hasCurrent && !hasWaiting) {
    return null;
  }

  return (
    <VStack
      gap={8}
      alignItems="flex-start"
      justifyContent="flex-start"
      width="100%"
      data-testid="wheel-players"
    >
      {/* Row 1: Current Spinner and Waiting Spinners (horizontal) */}
      {(hasCurrent || hasWaiting) && (
        <HStack gap={4} alignItems="flex-start" wrap="wrap">
          {/* Current Spinner Section */}
          {hasCurrent && (
            <VStack gap={2} data-testid="current-section">
              <PlayerCard
                player={{ ...currentSpinner, id: currentSpinner.player_id }}
                size="large"
                badge="CURRENT"
                variant="highlighted"
                showName
              >
                {!hideSpinValue && (
                  <Text
                    fontSize="2xl"
                    fontWeight="bold"
                    color="blue.500"
                    data-testid="current-total"
                  >
                    ${(currentTotal || 0).toFixed(2)}
                  </Text>
                )}
              </PlayerCard>
            </VStack>
          )}

          {/* Waiting Spinners Section */}
          {hasWaiting && (
            <HStack gap={4} wrap="wrap" data-testid="waiting-section">
              {waitingSpinners.map((spinner) => (
                <Box key={spinner.player_id}>
                  <PlayerCard
                    player={{ ...spinner, id: spinner.player_id }}
                    size="small"
                    showName
                  />
                </Box>
              ))}
            </HStack>
          )}
        </HStack>
      )}

      {/* Row 2: Leader Section */}
      {hasLeader && (
        <VStack gap={2} data-testid="leader-section">
          <PlayerCard
            player={{ ...leader, id: leader.player_id }}
            size="medium"
            badge="LEADER"
            showName
          >
            {!hideSpinValue && (
              <Text
                fontSize="2xl"
                fontWeight="bold"
                color="green.500"
                data-testid="leader-total"
              >
                ${(leaderTotal || 0).toFixed(2)}
              </Text>
            )}
          </PlayerCard>
        </VStack>
      )}
    </VStack>
  );
}
