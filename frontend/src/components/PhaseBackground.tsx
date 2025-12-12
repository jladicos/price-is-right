import { Box } from '@chakra-ui/react';
import type { ReactNode } from 'react';

type PhaseType = 'bidding' | 'wheel' | 'showcase';

interface PhaseBackgroundProps {
  phase: PhaseType;
  children: ReactNode;
}

const BACKGROUND_IMAGES: Record<PhaseType, string> = {
  bidding: '/images/phases/bidding-background.png',
  wheel: '/images/phases/spin-the-wheel.png',
  showcase: '/images/phases/showcase-showdown.png',
};

// Opacity for background images (1 = full opacity)
const BACKGROUND_OPACITY: Record<PhaseType, number> = {
  bidding: 0.8,
  wheel: 1,
  showcase: 1,
};

// Background position for each phase
const BACKGROUND_POSITION: Record<PhaseType, string> = {
  bidding: 'center',
  wheel: 'top right',
  showcase: 'center',
};

/**
 * PhaseBackground - Wraps content with a phase-specific background image
 * The background fills the entire viewport except for the control strip at the bottom
 */
export function PhaseBackground({ phase, children }: PhaseBackgroundProps) {
  const backgroundImage = BACKGROUND_IMAGES[phase];
  const opacity = BACKGROUND_OPACITY[phase];
  const backgroundPosition = BACKGROUND_POSITION[phase];

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom="80px" // Leave space for control strip
      bg="white" // Fallback background color (shows through when opacity < 1)
      overflow="auto"
      zIndex={1} // Ensure it's above any base layers
    >
      {/* Background image layer with opacity */}
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        backgroundImage={`url(${backgroundImage})`}
        backgroundSize="cover"
        backgroundPosition={backgroundPosition}
        backgroundRepeat="no-repeat"
        opacity={opacity}
        zIndex={0}
      />
      {/* Content layer */}
      <Box position="relative" zIndex={1} height="100%">
        {children}
      </Box>
    </Box>
  );
}
