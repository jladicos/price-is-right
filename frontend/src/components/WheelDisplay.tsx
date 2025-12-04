import { Box, VStack, Text, Button } from "@chakra-ui/react";

export interface WheelDisplayProps {
  currentValue: number; // Current position (in cents: 5-100)
  targetValue?: number; // Target value for animation (in cents)
  isSpinning?: boolean; // Whether wheel is currently spinning
  onSpin?: () => void; // Callback when wheel is clicked/spun
  disabled?: boolean; // Disable interaction
  _startingPosition?: "first" | "second" | "spinoff"; // For future implementation
}

// Display order for slot machine (as specified in requirements)
const DISPLAY_ORDER = [
  15, 80, 35, 60, 20, 40, 75, 55, 95, 50, 85, 30, 65, 10, 45, 70, 25, 90, 5,
  100,
];

// Segment height in pixels
const SEGMENT_HEIGHT = 80;

/**
 * Get visual styling for a segment value
 */
function getSegmentStyle(value: number) {
  if (value === 5 || value === 15) {
    // Green segments (5¢ and 15¢)
    return {
      bg: "green.600",
      color: "green.100",
      borderColor: "yellow.500",
    };
  } else if (value === 100) {
    // $1.00 segment (black background, white text)
    return {
      bg: "gray.900",
      color: "white",
      borderColor: "yellow.500",
    };
  } else {
    // Standard segments
    return {
      bg: "gray.900",
      color: "white",
      borderColor: "yellow.500",
    };
  }
}

/**
 * Format cents as dollar display (5 -> "5¢", 100 -> "$1.00")
 */
function formatValue(cents: number): string {
  if (cents === 100) {
    return "$1.00";
  }
  return `${cents}¢`;
}

/**
 * WheelDisplay - Visual slot machine component for spinning the wheel
 *
 * Features:
 * - 20 segments in vertical slot machine layout
 * - Animated spinning with CSS transform
 * - Fixed pointer at top center
 * - Clickable wheel to trigger spin
 * - Accessibility button below wheel
 * - Starting position based on spin type (first/second/spinoff)
 */
export function WheelDisplay({
  currentValue,
  targetValue,
  isSpinning = false,
  onSpin,
  disabled = false,
}: WheelDisplayProps) {
  // Calculate translateY to align segment center with pointer
  // With 7 visible segments (560px total), pointer at center (280px from top)
  const CONTAINER_HEIGHT = 560; // 7 segments * 80px
  const HALF_SEGMENT = SEGMENT_HEIGHT / 2; // 40px
  const NUM_LOOPS = 15; // Render 15 loops to ensure enough segments at loop boundaries
  // Segments box contains 15 loops of 20 = 300 segments total = 24000px tall
  // When centered with top="50%" and translateY(-50%), the center is at the pointer
  // The center of the segments box is at: 300 * 80 / 2 = 12000px from its top
  const SEGMENTS_BOX_CENTER =
    (NUM_LOOPS * DISPLAY_ORDER.length * SEGMENT_HEIGHT) / 2; // 8000px

  const translateY = (() => {
    // Default: position current value's center at pointer
    // Use the MIDDLE loop of 10 (loop 5, indices 100-119) to ensure room for animation forward
    const currentIndex = DISPLAY_ORDER.indexOf(currentValue);
    const STATIC_LOOP_OFFSET = 5; // Use loop 5 (middle of 10 loops)

    if (isSpinning && targetValue && currentIndex !== -1) {
      // Calculate target position for spinning animation
      const targetIndex = DISPLAY_ORDER.indexOf(targetValue);
      if (targetIndex !== -1) {
        // Current position is at: currentIndex + (STATIC_LOOP_OFFSET * DISPLAY_ORDER.length)
        // This is our starting absolute index (100-119 for loop 5)
        const currentAbsoluteIndex =
          currentIndex + STATIC_LOOP_OFFSET * DISPLAY_ORDER.length;

        // Calculate how many segments forward to reach target
        // If target is "before" current in the wheel order, add a full rotation
        let segmentsForward = targetIndex - currentIndex;
        if (segmentsForward <= 0) {
          segmentsForward += DISPLAY_ORDER.length; // Add one full rotation
        }

        // Add minimum 3 full rotations (60 segments)
        const minRotations = 3;
        const totalSegmentsForward =
          segmentsForward + minRotations * DISPLAY_ORDER.length;

        // Final absolute index is current + total segments forward
        const finalAbsoluteIndex = currentAbsoluteIndex + totalSegmentsForward;

        // Calculate position to align target segment's center with the pointer
        const segmentCenter =
          finalAbsoluteIndex * SEGMENT_HEIGHT + HALF_SEGMENT;
        return SEGMENTS_BOX_CENTER - segmentCenter;
      }
    }

    // Static position: use loop 5 (indices 100-119) - middle of 10 loops
    if (currentIndex !== -1) {
      const absoluteIndex =
        currentIndex + STATIC_LOOP_OFFSET * DISPLAY_ORDER.length;
      const segmentCenter = absoluteIndex * SEGMENT_HEIGHT + HALF_SEGMENT;
      return SEGMENTS_BOX_CENTER - segmentCenter;
    }

    return 0;
  })();

  const handleSpin = () => {
    if (!disabled && !isSpinning && onSpin) {
      onSpin();
    }
  };

  const isClickable = !disabled && !isSpinning;

  return (
    <VStack gap={4} align="center" data-testid="wheel-display">
      {/* Wheel Container */}
      <Box
        position="relative"
        width="200px"
        height={`${CONTAINER_HEIGHT}px`}
        bg="gray.800"
        borderRadius="lg"
        overflow="hidden"
        border="4px solid"
        borderColor="yellow.600"
        boxShadow="0 0 30px rgba(0, 0, 0, 0.8)"
        cursor={isClickable ? "pointer" : "default"}
        onClick={handleSpin}
        data-testid="wheel-container"
        data-clickable={isClickable}
      >
        {/* Pointer/Indicator - Fixed on right side at vertical center */}
        <Box
          position="absolute"
          top="50%"
          right="-15px"
          transform="translateY(-50%)"
          width="0"
          height="0"
          borderTop="15px solid transparent"
          borderBottom="15px solid transparent"
          borderRight="20px solid"
          borderRightColor="yellow.500"
          zIndex={10}
          filter="drop-shadow(-2px 0 4px rgba(0,0,0,0.5))"
          data-testid="wheel-pointer"
        />

        {/* Scrolling Wheel Segments */}
        <Box
          position="absolute"
          top="50%"
          left="0"
          right="0"
          style={{
            transform: `translateY(calc(-50% + ${translateY}px))`,
            transition: isSpinning ? "transform 2.5s ease-out" : "none",
          }}
          data-testid="wheel-segments"
        >
          {/* Render segments multiple times to support animation */}
          {Array.from({ length: NUM_LOOPS }, (_, loop) => loop).map((loop) =>
            DISPLAY_ORDER.map((value, index) => {
              const style = getSegmentStyle(value);
              const absoluteIndex = loop * DISPLAY_ORDER.length + index;

              return (
                <Box
                  key={`${loop}-${value}`}
                  height={`${SEGMENT_HEIGHT}px`}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  bg={style.bg}
                  borderBottom="2px solid"
                  borderColor={style.borderColor}
                  data-testid={`wheel-segment-${absoluteIndex}`}
                  data-value={value}
                >
                  <Text
                    fontSize="3xl"
                    fontWeight="bold"
                    color={style.color}
                    fontFamily="monospace"
                  >
                    {formatValue(value)}
                  </Text>
                </Box>
              );
            }),
          )}
        </Box>
      </Box>

      {/* Accessibility Button */}
      <Button
        onClick={handleSpin}
        disabled={disabled || isSpinning}
        colorPalette="yellow"
        size="lg"
        width="200px"
        data-testid="spin-wheel-button"
      >
        {isSpinning ? "Spinning..." : "Spin Wheel"}
      </Button>
    </VStack>
  );
}
