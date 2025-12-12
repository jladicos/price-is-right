import { useState } from "react";
import { Box, VStack, HStack, Text, Input, Button } from "@chakra-ui/react";
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "./ui/menu";
import { PlayerCard } from "./PlayerCard";
import type { ContestantWithPlayer } from "../store/gameStore";
import type { BidWithPlayer } from "../store/gameStore";

interface PodiumDisplayProps {
  position: number; // 1-5
  contestant: ContestantWithPlayer | null;
  bid: BidWithPlayer | null;
  isCurrentBidder: boolean;
  isWinner: boolean;
  role: string; // 'host', 'player', or 'audience'
  currentPlayerId?: number; // ID of logged-in player (if applicable)
  shouldShowRevealButton?: boolean; // Only show reveal button on this podium
  allContestantsRevealed?: boolean; // All contestants have been revealed
  productHasBeenShown?: boolean; // Product has been shown at least once
  canReplaceContestants?: boolean; // Whether replacement is allowed (disabled after winner revealed)
  bidDifference?: number; // Difference between bid and actual value (shown after reveal)
  showBidDifference?: boolean; // Whether to show the bid difference
  onBidSubmit?: (position: number, amount: number) => void;
  onUpdateBid?: (bidId: number, newAmount: number) => void;
  onUnlockBid?: (bidId: number) => void;
  onRevealContestant?: (contestantRowId: number) => void;
  onReplaceContestantRandom?: (contestantRowId: number) => void;
  onReplaceContestantManual?: (
    contestantRowId: number,
    position: number,
  ) => void;
}

// Position-specific colors
const PODIUM_COLORS = {
  1: { primary: "#C80000", light: "#FF4444" }, // Red
  2: { primary: "#FFD700", light: "#FFEB99" }, // Yellow
  3: { primary: "#0064C8", light: "#4D9FFF" }, // Blue
  4: { primary: "#00B400", light: "#66FF66" }, // Green
  5: { primary: "#9600C8", light: "#C966FF" }, // Purple
};

export function PodiumDisplay({
  position,
  contestant,
  bid,
  isCurrentBidder,
  isWinner,
  role,
  currentPlayerId,
  shouldShowRevealButton = false,
  allContestantsRevealed = false,
  productHasBeenShown = false,
  canReplaceContestants = true,
  bidDifference,
  showBidDifference = false,
  onBidSubmit,
  onUpdateBid,
  onUnlockBid: _onUnlockBid,
  onRevealContestant,
  onReplaceContestantRandom,
  onReplaceContestantManual,
}: PodiumDisplayProps) {
  const [bidInput, setBidInput] = useState("");
  const [isEditingBid, setIsEditingBid] = useState(false);

  // Get colors for this position
  const colors = PODIUM_COLORS[position as keyof typeof PODIUM_COLORS];

  // Helper to create color-based glow shadow
  const getGlowShadow = (color: string) => {
    // Convert hex to rgba for the shadow
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `0 0 25px rgba(${r}, ${g}, ${b}, 0.8), 0 0 50px rgba(${r}, ${g}, ${b}, 0.4)`;
  };

  // Responsive sizes (width only - height stays the same)
  const podiumWidth = { base: "120px", lg: "180px" };
  const photoSize = { base: "80px", lg: "150px" };
  const podiumBodyWidth = { base: "110px", lg: "160px" };

  // Empty podium case
  if (!contestant) {
    return (
      <VStack
        gap={4}
        width={podiumWidth}
        align="stretch"
        opacity={0.4}
        data-testid={`podium-${position}-empty`}
      >
        {/* Empty name space */}
        <Box minHeight="32px" />

        <Box
          width={photoSize}
          height={photoSize}
          bg="gray.200"
          borderRadius="md"
          alignSelf="center"
        />

        {/* Podium with overlapping display */}
        <Box position="relative" alignSelf="center" width={podiumBodyWidth}>
          {/* Podium Body */}
          <Box
            bg="gray.300"
            borderRadius="lg"
            height="280px"
            border="2px solid"
            borderColor="gray.400"
          />

          {/* Digital Display - overlaps podium */}
          <Box
            position="absolute"
            top="-5px"
            left="-5px"
            right="-5px"
            bg="gray.800"
            borderRadius="md"
            py={3}
            px={4}
            textAlign="center"
            border="3px solid"
            borderColor="gray.600"
            minHeight="60px"
            boxShadow="inset 0 2px 8px rgba(0,0,0,0.5)"
          />
        </Box>

        {/* Button space - always reserve space */}
        <Box minHeight="44px" />
      </VStack>
    );
  }

  // Pending reveal case
  if (contestant.status === "pending_reveal") {
    return (
      <VStack
        gap={4}
        width={podiumWidth}
        align="stretch"
        data-testid={`podium-${position}-pending`}
      >
        {/* Blank name space */}
        <Box minHeight="32px" />

        {/* Blank photo space */}
        <Box width={photoSize} height={photoSize} alignSelf="center" />

        {/* Podium with overlapping display */}
        <Box
          position="relative"
          alignSelf="center"
          width={podiumBodyWidth}
          boxShadow={
            shouldShowRevealButton ? getGlowShadow(colors.primary) : "none"
          }
          borderRadius="lg"
          transition="all 0.3s ease"
        >
          {/* Podium Body */}
          <Box
            bg={colors.primary}
            borderRadius="lg"
            height="280px"
            border="3px solid"
            borderColor={colors.primary}
            boxShadow="lg"
          />

          {/* Digital Display - overlaps podium */}
          <Box
            position="absolute"
            top="-5px"
            left="-5px"
            right="-5px"
            bg="gray.900"
            borderRadius="md"
            py={3}
            px={4}
            textAlign="center"
            border="3px solid"
            borderColor={colors.light}
            minHeight="60px"
            boxShadow="inset 0 2px 8px rgba(0,0,0,0.5)"
          />
        </Box>

        {/* Button space - always reserve space */}
        <Box minHeight="44px" position="relative" zIndex={3}>
          {role === "host" && onRevealContestant && shouldShowRevealButton && (
            <Button
              onClick={() => onRevealContestant(contestant.id)}
              colorPalette="green"
              size="lg"
              width="100%"
              data-testid={`reveal-contestant-${position}`}
            >
              Come on down!
            </Button>
          )}
        </Box>
      </VStack>
    );
  }

  // Revealed contestant
  const isCurrentPlayer = currentPlayerId === contestant.player_id;
  const canInputBid =
    isCurrentBidder &&
    (isCurrentPlayer || role === "host") &&
    !bid &&
    allContestantsRevealed &&
    productHasBeenShown;

  const handleBidSubmit = () => {
    const amount = parseInt(bidInput, 10);
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    if (isEditingBid && bid && onUpdateBid) {
      // Editing existing bid
      onUpdateBid(bid.id, amount);
      setBidInput("");
      setIsEditingBid(false);
    } else if (onBidSubmit) {
      // Submitting new bid
      onBidSubmit(position, amount);
      setBidInput("");
      setIsEditingBid(false);
    }
  };

  /**
   * Host Edit Mode:
   * When host clicks an existing bid, enters edit mode to change the bid amount
   * - Click bid → Enter edit mode with current value pre-filled
   * - Press Enter → Submit updated bid
   * - Press Escape → Cancel edit mode
   */
  const handleBidClick = () => {
    if (bid && role === "host") {
      // Enter edit mode
      setIsEditingBid(true);
      setBidInput(bid.bid_amount.toString());
    }
  };

  const handleCancelEdit = () => {
    setIsEditingBid(false);
    setBidInput("");
  };

  return (
    <VStack
      gap={4}
      width={podiumWidth}
      align="stretch"
      position="relative"
      data-testid={`podium-${position}`}
      data-winner={isWinner}
      data-current={isCurrentBidder}
    >
      {/* First Name - maintains layout space */}
      {!isWinner && (
        <Box
          bg="white"
          px={3}
          py={1}
          borderRadius="md"
          boxShadow="sm"
          border="5px solid black"
          minHeight="32px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          alignSelf="center"
        >
          <Text
            fontSize={{ base: "sm", lg: "xl" }}
            fontWeight="bold"
            textAlign="center"
            color="gray.800"
          >
            {contestant.first_name}
          </Text>
        </Box>
      )}
      {/* Empty space for winner to maintain layout */}
      {isWinner && <Box minHeight="32px" />}

      {/* Profile Photo - maintains space but winner image floats above */}
      <Box width={photoSize} height={photoSize} alignSelf="center" position="relative">
        {/* Winner Badge - floats completely above photo */}
        {isWinner && (
          <Box
            position="absolute"
            bottom={{ base: "calc(100% + 50px)", lg: "calc(100% + 100px)" }}
            left="50%"
            transform="translateX(-50%)"
            bg="green.500"
            color="white"
            px={{ base: 3, lg: 6 }}
            py={{ base: 1, lg: 3 }}
            borderRadius="full"
            fontWeight="bold"
            fontSize={{ base: "sm", lg: "xl" }}
            boxShadow="lg"
            animation="pulse 2s ease-in-out infinite"
            data-testid={`winner-label-${position}`}
            zIndex={20}
            whiteSpace="nowrap"
          >
            WINNER!
          </Box>
        )}

        {/* Actual photo - absolute positioned for winner to float, bottom-aligned */}
        <Box
          position={isWinner ? "absolute" : "relative"}
          bottom={isWinner ? 0 : "auto"}
          left={isWinner ? "50%" : "auto"}
          transform={isWinner ? "translateX(-50%)" : "none"}
          width={isWinner ? { base: "120px", lg: "240px" } : photoSize}
          height={isWinner ? { base: "120px", lg: "240px" } : photoSize}
          zIndex={isWinner ? 15 : 1}
        >
          <PlayerCard
            player={{
              id: contestant.player_id,
              first_name: contestant.first_name,
              last_name: contestant.last_name,
              photo_filename: contestant.photo_filename,
            }}
            size={isWinner ? "large" : "medium"}
            fillContainer={true}
            showName={false} // Name handled separately above
            badge={undefined} // Badge handled separately for winners
            variant={
              isWinner
                ? "winner"
                : isCurrentBidder &&
                    allContestantsRevealed &&
                    productHasBeenShown
                  ? "highlighted"
                  : "default"
            }
          />
        </Box>
      </Box>

      {/* Podium with overlapping display */}
      <Box
        position="relative"
        alignSelf="center"
        width={podiumBodyWidth}
        boxShadow={
          isWinner
            ? getGlowShadow(colors.primary)
            : isCurrentBidder && allContestantsRevealed && productHasBeenShown
              ? getGlowShadow(colors.primary)
              : "none"
        }
        borderRadius="lg"
        transition="all 0.3s ease"
      >
        {/* Podium Body */}
        <Box
          bg={colors.primary}
          borderRadius="lg"
          height="280px"
          border="3px solid"
          borderColor={colors.primary}
          boxShadow="lg"
          display="flex"
          alignItems="flex-end"
          justifyContent="center"
          pb={4}
          position="relative"
          overflow="hidden"
        >
          {/* Podium shine effect */}
          <Box
            position="absolute"
            top="0"
            left="0"
            right="0"
            height="40%"
            bg="linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)"
          />
        </Box>

        {/* Digital Display - overlaps podium */}
        <Box
          position="absolute"
          top="-5px"
          left="-5px"
          right="-5px"
          bg="gray.900"
          borderRadius="md"
          py={3}
          px={4}
          textAlign="center"
          border="3px solid"
          borderColor={colors.light}
          minHeight="60px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          overflow="hidden"
          boxShadow="inset 0 2px 8px rgba(0,0,0,0.5)"
          cursor={
            role === "host" && bid && !isEditingBid ? "pointer" : "default"
          }
          onClick={
            role === "host" && bid && !isEditingBid ? handleBidClick : undefined
          }
          _hover={
            role === "host" && bid && !isEditingBid
              ? {
                  borderColor: "blue.400",
                  boxShadow: "0 0 10px rgba(59, 130, 246, 0.4)",
                }
              : {}
          }
          data-testid={`digital-display-${position}`}
        >
          {canInputBid || isEditingBid ? (
            <HStack gap={2} width="100%">
              <Input
                value={bidInput}
                onChange={(e) => setBidInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleBidSubmit();
                  } else if (e.key === "Escape") {
                    handleCancelEdit();
                  }
                }}
                type="number"
                placeholder="0"
                size="sm"
                textAlign="center"
                bg="gray.800"
                border="none"
                color="green.400"
                fontSize="2xl"
                fontWeight="bold"
                fontFamily="monospace"
                _placeholder={{ color: "gray.600" }}
                autoFocus={isCurrentPlayer || isEditingBid}
                data-testid={`bid-input-${position}`}
              />
              {/* Show submit button only for players (not host) */}
              {role !== "host" && (
                <Button
                  onClick={handleBidSubmit}
                  size="xs"
                  colorPalette="green"
                  disabled={!bidInput || parseInt(bidInput, 10) <= 0}
                  data-testid={`bid-submit-${position}`}
                >
                  ✓
                </Button>
              )}
            </HStack>
          ) : bid ? (
            <VStack gap={0}>
              <Text
                fontSize="3xl"
                fontWeight="bold"
                color={isWinner ? "green.400" : colors.light}
                fontFamily="monospace"
                animation={isWinner ? "flash 1.5s ease-in-out infinite" : "none"}
                data-testid={`bid-amount-${position}`}
              >
                {bid.bid_amount}
              </Text>
              {showBidDifference && bidDifference !== undefined && (
                <Text
                  fontSize="lg"
                  fontWeight="bold"
                  color={bidDifference > 0 ? "red.400" : "cyan.400"}
                  fontFamily="monospace"
                  data-testid={`bid-difference-${position}`}
                >
                  {bidDifference > 0 ? "+" : ""}{bidDifference}
                </Text>
              )}
            </VStack>
          ) : (
            <Text fontSize="2xl" color="gray.700" fontFamily="monospace">
              ---
            </Text>
          )}
        </Box>
      </Box>

      {/* Button space - always reserve space */}
      <Box minHeight="44px" position="relative" zIndex={3}>
        {role === "host" &&
          (onReplaceContestantRandom || onReplaceContestantManual) &&
          canReplaceContestants && (
            <MenuRoot>
              <MenuTrigger asChild>
                <Button
                  colorPalette="orange"
                  size="sm"
                  variant="outline"
                  width="100%"
                  data-testid={`manage-contestant-${position}`}
                >
                  Manage ⋮
                </Button>
              </MenuTrigger>
              <MenuContent>
                {onReplaceContestantRandom && (
                  <MenuItem
                    value="replace-random"
                    onClick={() => onReplaceContestantRandom(contestant.id)}
                  >
                    Replace with Random
                  </MenuItem>
                )}
                {onReplaceContestantManual && (
                  <MenuItem
                    value="replace-manual"
                    onClick={() =>
                      onReplaceContestantManual(contestant.id, position)
                    }
                  >
                    Replace with Manual
                  </MenuItem>
                )}
              </MenuContent>
            </MenuRoot>
          )}
      </Box>
    </VStack>
  );
}
