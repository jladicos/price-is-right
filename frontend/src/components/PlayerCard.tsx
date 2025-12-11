import { Box, VStack, Text, Image } from "@chakra-ui/react";
import { getPlayerPhotoUrl } from "../utils/imageUrls";

export interface PlayerCardProps {
  player: {
    id: number;
    first_name: string;
    last_name: string;
    photo_filename: string;
  };
  size?: "small" | "medium" | "large";
  fillContainer?: boolean; // If true, photo fills parent container instead of using fixed size
  showName?: boolean;
  badge?: string;
  badgeTestId?: string; // Custom test ID for badge (useful for position-specific badges)
  variant?: "default" | "highlighted" | "eliminated" | "winner";
  children?: React.ReactNode;
}

const SIZE_CONFIG = {
  small: {
    photo: "120px",
    fontSize: "md",
  },
  medium: {
    photo: "150px",
    fontSize: "xl",
  },
  large: {
    photo: "240px",
    fontSize: "2xl",
  },
};

const VARIANT_CONFIG = {
  default: {
    borderColor: "gray.300",
    boxShadow: "sm",
    bgColor: "transparent",
  },
  highlighted: {
    borderColor: "blue.500",
    boxShadow: "0 0 20px rgba(59, 130, 246, 0.6)",
    bgColor: "transparent",
  },
  eliminated: {
    borderColor: "red.500",
    boxShadow: "0 0 15px rgba(239, 68, 68, 0.5)",
    bgColor: "red.900",
  },
  winner: {
    borderColor: "green.500",
    boxShadow: "0 0 20px rgba(34, 197, 94, 0.6)",
    bgColor: "transparent",
  },
};

/**
 * PlayerCard - Reusable component for displaying player photo, name, and optional content
 *
 * Used in:
 * - PodiumDisplay (bidding phase)
 * - WheelPlayers (wheel phase)
 * - ShowcasePodiums (showcase phase)
 *
 * Features:
 * - Multiple size variants (small, medium, large)
 * - Visual variants (default, highlighted, eliminated, winner)
 * - Optional name display above photo
 * - Optional badge overlay above photo
 * - Optional children content below photo (buttons, totals, etc.)
 */
export function PlayerCard({
  player,
  size = "medium",
  fillContainer = false,
  showName = false,
  badge,
  badgeTestId,
  variant = "default",
  children,
}: PlayerCardProps) {
  const photoUrl = getPlayerPhotoUrl(player.photo_filename);
  const sizeConfig = SIZE_CONFIG[size];
  const variantConfig = VARIANT_CONFIG[variant];

  // Use 100% if fillContainer, otherwise use fixed size
  const photoSize = fillContainer ? "100%" : sizeConfig.photo;

  return (
    <VStack gap={2} align="center" data-testid="player-card">
      {/* Name - displayed above photo if enabled */}
      {showName && (
        <Box
          bg="white"
          px={3}
          py={1}
          borderRadius="md"
          boxShadow="sm"
          minHeight="32px"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Text
            fontSize={sizeConfig.fontSize}
            fontWeight="bold"
            textAlign="center"
            color="gray.800"
            data-testid="player-card-name"
          >
            {player.first_name}
          </Text>
        </Box>
      )}

      {/* Badge - floats above photo */}
      {badge && (
        <Box
          position="relative"
          width={photoSize}
          height="0"
          mb={badge ? "-40px" : "0"}
          zIndex={10}
        >
          <Box
            position="absolute"
            top={showName ? "-80px" : "-70px"}
            left="50%"
            transform="translateX(-50%)"
            bg={
              badge === "ELIMINATED"
                ? "red.500"
                : badge.includes("WINNER")
                  ? "green.500"
                  : badge === "LEADER"
                    ? "yellow.500"
                    : badge === "TIE"
                      ? "orange.500"
                      : "blue.500"
            }
            color="white"
            px={3}
            py={1}
            borderRadius="full"
            fontWeight="bold"
            fontSize="sm"
            boxShadow="md"
            whiteSpace="nowrap"
            data-testid={badgeTestId || "player-card-badge"}
          >
            {badge}
          </Box>
        </Box>
      )}

      {/* Photo */}
      <Box
        width={photoSize}
        height={photoSize}
        borderRadius="md"
        overflow="hidden"
        border="3px solid"
        borderColor={variantConfig.borderColor}
        boxShadow={variantConfig.boxShadow}
        bg={variantConfig.bgColor}
        position="relative"
        transition="all 0.3s ease"
        data-testid="player-card-photo"
      >
        <Image
          src={photoUrl}
          alt={`${player.first_name} ${player.last_name}`}
          width="100%"
          height="100%"
          objectFit="cover"
        />

        {/* Eliminated overlay */}
        {variant === "eliminated" && (
          <Box
            position="absolute"
            top="0"
            left="0"
            right="0"
            bottom="0"
            bg="rgba(0, 0, 0, 0.6)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            data-testid="player-card-eliminated-overlay"
          >
            <Text
              fontSize="xl"
              fontWeight="bold"
              color="red.500"
              textTransform="uppercase"
              letterSpacing="wider"
            >
              ELIMINATED
            </Text>
          </Box>
        )}
      </Box>

      {/* Children content - displayed below photo */}
      {children && (
        <Box width="100%" data-testid="player-card-children">
          {children}
        </Box>
      )}
    </VStack>
  );
}
