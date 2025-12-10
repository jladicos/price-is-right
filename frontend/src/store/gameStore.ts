import { create } from "zustand";

// Type definitions matching backend
export interface GameWorkflow {
  id: number;
  current_segment: string;
  current_segment_index: number;
  phase_type: string;
  phase_metadata: string | null;
  created_at: string;
  updated_at: string;
  officially_started: number; // 0 = not started, 1 = started
}

export interface ContestantWithPlayer {
  // From contestants_row table
  id: number;
  player_id: number;
  position: number;
  game_segment: string;
  status: string;
  added_at: string;
  revealed_at: string | null;
  created_at: string;
  updated_at: string;
  // From players table (joined)
  first_name: string;
  last_name: string;
  photo_filename: string;
  role: string;
}

export interface BidWithPlayer {
  // From bids table
  id: number;
  player_id: number;
  product_id: string;
  round_number: number;
  game_segment: string;
  bid_amount: number;
  is_locked: number;
  is_winner: number;
  retry_number: number;
  created_at: string;
  // From players table (joined)
  first_name: string;
  last_name: string;
  photo_filename: string;
  position: number | null;
}

// Wheel phase types
export interface WheelSpin {
  id: number;
  player_id: number;
  game_segment: string;
  spin_number: number;
  result: number; // Spin value in dollars (0.05 to 1.00)
  spinoff_number: number;
  created_at: string;
}

export interface PlayerTotal {
  player_id: number;
  first_name: string;
  last_name: string;
  photo_filename: string;
  position: number;
  total: number; // Sum of spins in dollars
  eliminated: boolean; // True if total > 1.00
}

// Showcase phase types
export interface Product {
  name: string;
  price: number;
  images: string[];
}

export interface ShowcaseProduct {
  id: string; // Product ID
  product: Product;
}

export interface ShowcaseBid {
  id: number;
  game_id: number;
  player_id: number;
  showcase_number: number; // 1 or 2
  bid_amount: number;
  retry_number: number;
  locked: number; // 1 = locked, 0 = unlocked
  created_at: string;
  updated_at: string;
}

export interface ShowcaseBidWithPlayer extends ShowcaseBid {
  first_name: string;
  last_name: string;
  photo_filename: string;
}

export interface ShowcaseState {
  finale_player1_id: number | null;
  finale_player2_id: number | null;
  finale_player1_product_value: number | null;
  finale_player2_product_value: number | null;
  finale_player1_showcase: number | null; // 1 or 2
  finale_player2_showcase: number | null;
  finale_retry_number: number;
  finale_player1_passed: number; // 0 or 1
  finale_winner_id: number | null;
  finale_bonus_won: number; // 0 or 1
}

export interface ShowcaseStateWithProducts {
  state: ShowcaseState;
  showcase1: ShowcaseProduct[];
  showcase2: ShowcaseProduct[];
  showcase1Value: number;
  showcase2Value: number;
  bonusThreshold: number;
}

export interface GameState {
  workflow: GameWorkflow;
  contestantsRow: ContestantWithPlayer[];
  eligibleAudienceCount: number;
  // Bidding phase state (populated when phase_type === 'bidding')
  currentBids?: BidWithPlayer[];
  currentBidderPosition?: number | null;
  // Wheel phase state (populated when phase_type === 'wheel')
  wheelSpins?: WheelSpin[];
  currentSpinner?: number | null; // player_id of current spinner
  currentWheelPosition?: number; // Current wheel display position in cents (5-100)
  spinoffNumber?: number; // 0 for regular round, 1+ for spin-offs
  playerTotals?: PlayerTotal[];
  wheelWinner?: number | null; // player_id of winner
  needsSpinoff?: boolean;
  // Showcase phase state (populated when phase_type === 'showcase')
  showcaseState?: ShowcaseStateWithProducts;
  showcaseBids?: ShowcaseBidWithPlayer[];
}

interface GameStore {
  // State
  gameState: GameState | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number;
  isWheelAnimating: boolean; // UI-only animation state
  pendingSpinTarget: number | null; // Target value for wheel animation (in cents)

  // Actions
  fetchGameState: () => Promise<void>;
  startNewGame: () => Promise<void>;
  officiallyStartGame: () => Promise<void>;
  advancePhase: () => Promise<void>;
  revealContestant: (contestantRowId: number) => Promise<void>;
  manualSelectContestant: (
    playerId: number,
    position: number,
    segment: string,
  ) => Promise<void>;
  replaceContestantRandom: (contestantRowId: number) => Promise<void>;
  replaceContestantManual: (
    contestantRowId: number,
    newPlayerId: number,
  ) => Promise<void>;
  refreshContestantsRow: (segment: "section_1" | "section_2") => Promise<void>;
  overridePhase: (
    segment: string,
    segmentIndex: number,
    phaseType: string,
    phaseMetadata?: unknown,
  ) => Promise<void>;

  // Bidding actions
  submitBid: (bidAmount: number, playerId?: number) => Promise<void>;
  showProduct: () => Promise<void>;
  hideProductModal: () => Promise<void>;
  revealWinner: () => Promise<{
    winner?: BidWithPlayer;
    allOver?: boolean;
    newRetryNumber?: number;
  }>;
  unlockBid: (bidId: number) => Promise<void>;
  updateBidAmount: (bidId: number, newAmount: number) => Promise<void>;

  // Wheel actions
  startWheelPhase: () => Promise<void>;
  spinWheel: (playerId: number) => Promise<void>;
  stayOnWheelSpin: (playerId: number) => Promise<void>;
  startSpinOff: (spinoffNumber: number) => Promise<void>;
  resetWheelPhase: () => Promise<void>; // Debug: reset to first player

  // Showcase actions
  initializeShowcase: () => Promise<void>;
  submitPass: () => Promise<void>;
  submitBidDecision: () => Promise<void>;
  submitShowcaseBid: (bidAmount: number, playerId?: number) => Promise<void>;
  unlockShowcaseBid: (playerId: number) => Promise<void>;
  updateShowcaseBid: (playerId: number, bidAmount: number) => Promise<void>;
  revealShowcaseWinner: () => Promise<{
    winnerId: number;
    bonusWon: boolean;
    retryNeeded: boolean;
  }>;
  retryShowcase: () => Promise<void>;
  fetchShowcaseState: () => Promise<void>;

  clearError: () => void;
}

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

// Session token getter callback (set by authStore)
let getSessionToken: (() => string | null) | null = null;

/**
 * Set the session token getter callback
 * This should be called by authStore to provide the current session token
 */
export function setGameStoreSessionTokenGetter(getter: () => string | null) {
  getSessionToken = getter;
}

// Helper function to make authenticated API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<{ success: boolean; data?: T; error?: string }> {
  const token = getSessionToken ? getSessionToken() : null;
  if (!token || token.trim() === "") {
    return {
      success: false,
      error: "Not authenticated",
    };
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  // Ensure POST/PUT requests have a body (even if empty)
  const method = options.method?.toUpperCase();
  const needsBody = method === "POST" || method === "PUT";
  const hasBody = options.body !== undefined;

  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  // Add empty JSON body if method needs it but none provided
  if (needsBody && !hasBody) {
    fetchOptions.body = JSON.stringify({});
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export const useGameStore = create<GameStore>((set) => ({
  // Initial state
  gameState: null,
  isLoading: false,
  error: null,
  lastUpdated: 0,
  isWheelAnimating: false,
  pendingSpinTarget: null,

  // Fetch current game state
  fetchGameState: async () => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ state: GameState }>("/game/state");

    if (result.success && result.data) {
      set({
        gameState: result.data.state,
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } else {
      set({
        error: result.error || "Failed to fetch game state",
        isLoading: false,
      });
    }
  },

  // Start a new game
  startNewGame: async () => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ state: GameState }>("/game/start", {
      method: "POST",
    });

    if (result.success && result.data) {
      set({
        gameState: result.data.state,
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } else {
      const errorMessage = result.error || "Failed to start game";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Officially start the game (triggers non-host players to leave waiting screen)
  officiallyStartGame: async () => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ state: GameState }>("/game/officially-start", {
      method: "POST",
    });

    if (result.success && result.data) {
      set({
        gameState: result.data.state,
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } else {
      const errorMessage = result.error || "Failed to officially start game";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Advance to next phase
  advancePhase: async () => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ state: GameState }>("/game/advance", {
      method: "POST",
    });

    if (result.success && result.data) {
      set({
        gameState: result.data.state,
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } else {
      const errorMessage = result.error || "Failed to advance phase";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Reveal a contestant
  revealContestant: async (contestantRowId: number) => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ contestant: ContestantWithPlayer }>(
      "/game/reveal-contestant",
      {
        method: "POST",
        body: JSON.stringify({ contestantRowId }),
      },
    );

    if (result.success) {
      // Fetch updated state after revealing
      await useGameStore.getState().fetchGameState();
    } else {
      const errorMessage = result.error || "Failed to reveal contestant";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Replace contestant with random selection
  replaceContestantRandom: async (contestantRowId: number) => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ contestant: ContestantWithPlayer }>(
      "/game/replace-contestant-random",
      {
        method: "POST",
        body: JSON.stringify({ contestantRowId }),
      },
    );

    if (result.success) {
      // Fetch updated state after replacement
      await useGameStore.getState().fetchGameState();
    } else {
      const errorMessage = result.error || "Failed to replace contestant";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Manually select contestant at specific position
  manualSelectContestant: async (
    playerId: number,
    position: number,
    segment: string,
  ) => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ contestant: ContestantWithPlayer }>(
      "/game/manual-select-contestant",
      {
        method: "POST",
        body: JSON.stringify({ playerId, position, segment }),
      },
    );

    if (result.success) {
      // Fetch updated state after selection
      await useGameStore.getState().fetchGameState();
    } else {
      const errorMessage =
        result.error || "Failed to manually select contestant";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Replace contestant with manual selection
  replaceContestantManual: async (
    contestantRowId: number,
    newPlayerId: number,
  ) => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ contestant: ContestantWithPlayer }>(
      "/game/replace-contestant-manual",
      {
        method: "POST",
        body: JSON.stringify({ contestantRowId, newPlayerId }),
      },
    );

    if (result.success) {
      // Fetch updated state after replacement
      await useGameStore.getState().fetchGameState();
    } else {
      const errorMessage = result.error || "Failed to replace contestant";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Refresh entire contestant's row
  refreshContestantsRow: async (segment: "section_1" | "section_2") => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ contestants: ContestantWithPlayer[] }>(
      "/game/refresh-contestants-row",
      {
        method: "POST",
        body: JSON.stringify({ segment }),
      },
    );

    if (result.success) {
      // Fetch updated state after refresh
      await useGameStore.getState().fetchGameState();
    } else {
      const errorMessage = result.error || "Failed to refresh contestants row";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Override phase (emergency use)
  overridePhase: async (
    segment: string,
    segmentIndex: number,
    phaseType: string,
    phaseMetadata?: unknown,
  ) => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ state: GameState }>("/game/override-phase", {
      method: "POST",
      body: JSON.stringify({
        segment,
        segmentIndex,
        phaseType,
        phaseMetadata,
      }),
    });

    if (result.success && result.data) {
      set({
        gameState: result.data.state,
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } else {
      set({
        error: result.error || "Failed to override phase",
        isLoading: false,
      });
    }
  },

  // Submit a bid (player or host)
  submitBid: async (bidAmount: number, playerId?: number) => {
    set({ isLoading: true, error: null });

    const body: { bid_amount: number; player_id?: number } = {
      bid_amount: bidAmount,
    };
    if (playerId !== undefined) {
      body.player_id = playerId;
    }

    const result = await apiCall<{
      bid: BidWithPlayer;
      allBidsSubmitted: boolean;
    }>("/game/submit-bid", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (result.success) {
      // Fetch updated state after bid submission
      await useGameStore.getState().fetchGameState();
    } else {
      const errorMessage = result.error || "Failed to submit bid";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Show product modal (host only)
  showProduct: async () => {
    set({ isLoading: true, error: null });

    const result = await apiCall("/game/show-product", {
      method: "POST",
    });

    if (result.success) {
      set({ isLoading: false });
    } else {
      const errorMessage = result.error || "Failed to show product";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Hide product modal (host only)
  hideProductModal: async () => {
    set({ isLoading: true, error: null });

    const result = await apiCall("/game/hide-product-modal", {
      method: "POST",
    });

    if (result.success) {
      set({ isLoading: false });
    } else {
      const errorMessage = result.error || "Failed to hide product modal";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Reveal winner (host only)
  revealWinner: async () => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{
      winner?: BidWithPlayer;
      allBids?: BidWithPlayer[];
      allOver?: boolean;
      newRetryNumber?: number;
    }>("/game/reveal-winner", {
      method: "POST",
    });

    if (result.success && result.data) {
      // Fetch updated state after revealing winner
      await useGameStore.getState().fetchGameState();
      set({ isLoading: false });
      return {
        winner: result.data.winner,
        allOver: result.data.allOver,
        newRetryNumber: result.data.newRetryNumber,
      };
    } else {
      const errorMessage = result.error || "Failed to reveal winner";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Unlock a bid (host only)
  unlockBid: async (bidId: number) => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ bid: BidWithPlayer }>("/game/unlock-bid", {
      method: "POST",
      body: JSON.stringify({ bid_id: bidId }),
    });

    if (result.success) {
      // Fetch updated state after unlocking
      await useGameStore.getState().fetchGameState();
    } else {
      const errorMessage = result.error || "Failed to unlock bid";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Update bid amount (host only)
  updateBidAmount: async (bidId: number, newAmount: number) => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ bid: BidWithPlayer }>("/game/update-bid", {
      method: "POST",
      body: JSON.stringify({ bid_id: bidId, bid_amount: newAmount }),
    });

    if (result.success) {
      // Fetch updated state after updating
      await useGameStore.getState().fetchGameState();
    } else {
      const errorMessage = result.error || "Failed to update bid amount";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Start wheel phase (host only)
  startWheelPhase: async () => {
    set({ isLoading: true, error: null });

    const state = useGameStore.getState().gameState;
    if (!state || !state.workflow.current_segment) {
      set({ error: "No current segment", isLoading: false });
      return;
    }

    const result = await apiCall("/game/start-wheel-phase", {
      method: "POST",
      body: JSON.stringify({ game_segment: state.workflow.current_segment }),
    });

    if (result.success) {
      await useGameStore.getState().fetchGameState();
    } else {
      const errorMessage = result.error || "Failed to start wheel phase";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Spin the wheel for a player
  spinWheel: async (playerId: number) => {
    set({ isLoading: true, error: null, isWheelAnimating: true });

    const state = useGameStore.getState().gameState;
    if (!state || !state.workflow.current_segment) {
      set({
        error: "No current segment",
        isLoading: false,
        isWheelAnimating: false,
        pendingSpinTarget: null,
      });
      return;
    }

    const result = await apiCall<{
      spin: { result: number };
      total: number;
      eliminated: boolean;
    }>("/game/wheel-spin", {
      method: "POST",
      body: JSON.stringify({
        playerId: playerId,
        gameSegment: state.workflow.current_segment,
      }),
    });

    if (result.success && result.data) {
      // Store spin result for animation target (convert to cents)
      const spinTargetCents = Math.round(result.data.spin.result * 100);
      set({ pendingSpinTarget: spinTargetCents, isLoading: false });

      // Wait for animation to complete + pause, THEN fetch state
      // This ensures winner/tie/elimination only shows after wheel stops
      // Total: 2.5s animation + 0.5s pause = 3s
      setTimeout(async () => {
        await useGameStore.getState().fetchGameState();
        set({ isWheelAnimating: false, pendingSpinTarget: null });
      }, 3000);
    } else {
      const errorMessage = result.error || "Failed to spin wheel";
      set({
        error: errorMessage,
        isLoading: false,
        isWheelAnimating: false,
        pendingSpinTarget: null,
      });
      throw new Error(errorMessage);
    }
  },

  // Player chooses to stay on current spin result
  stayOnWheelSpin: async (playerId: number) => {
    set({ isLoading: true, error: null });

    const state = useGameStore.getState().gameState;
    if (!state || !state.workflow.current_segment) {
      set({ error: "No current segment", isLoading: false });
      return;
    }

    const result = await apiCall("/game/wheel-stay", {
      method: "POST",
      body: JSON.stringify({
        playerId: playerId,
        gameSegment: state.workflow.current_segment,
      }),
    });

    if (result.success) {
      await useGameStore.getState().fetchGameState();
    } else {
      const errorMessage = result.error || "Failed to stay on spin";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Start a spin-off round (host only)
  startSpinOff: async (spinoffNumber: number) => {
    set({ isLoading: true, error: null });

    const state = useGameStore.getState().gameState;
    if (!state || !state.workflow.current_segment) {
      set({ error: "No current segment", isLoading: false });
      return;
    }

    const result = await apiCall("/game/wheel-start-spinoff", {
      method: "POST",
      body: JSON.stringify({
        gameSegment: state.workflow.current_segment,
        spinoffNumber: spinoffNumber,
      }),
    });

    if (result.success) {
      await useGameStore.getState().fetchGameState();
    } else {
      const errorMessage = result.error || "Failed to start spin-off";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // DEBUG: Reset wheel phase to first player
  resetWheelPhase: async () => {
    set({ isLoading: true, error: null });

    const result = await apiCall("/game/wheel-reset", {
      method: "POST",
    });

    if (result.success) {
      await useGameStore.getState().fetchGameState();
      set({ isLoading: false });
    } else {
      const errorMessage = result.error || "Failed to reset wheel";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Initialize showcase showdown (host only)
  initializeShowcase: async () => {
    set({ isLoading: true, error: null });

    const result = await apiCall<ShowcaseStateWithProducts>(
      "/showcase/initialize",
      {
        method: "POST",
      },
    );

    if (result.success) {
      // Fetch updated state after initialization
      await useGameStore.getState().fetchShowcaseState();
    } else {
      const errorMessage = result.error || "Failed to initialize showcase";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // First player passes (host only)
  submitPass: async () => {
    set({ isLoading: true, error: null });

    const result = await apiCall("/showcase/pass", {
      method: "POST",
    });

    if (result.success) {
      // Fetch updated state after pass
      await useGameStore.getState().fetchShowcaseState();
    } else {
      const errorMessage = result.error || "Failed to submit pass";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // First player chooses to bid (host only)
  submitBidDecision: async () => {
    set({ isLoading: true, error: null });

    const result = await apiCall("/showcase/bid-decision", {
      method: "POST",
    });

    if (result.success) {
      // Fetch updated state after bid decision
      await useGameStore.getState().fetchShowcaseState();
    } else {
      const errorMessage = result.error || "Failed to submit bid decision";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Submit showcase bid (player or host)
  submitShowcaseBid: async (bidAmount: number, playerId?: number) => {
    set({ isLoading: true, error: null });

    const body: { bid_amount: number; player_id?: number } = {
      bid_amount: bidAmount,
    };
    if (playerId !== undefined) {
      body.player_id = playerId;
    }

    const result = await apiCall("/showcase/submit-bid", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (result.success) {
      // Fetch updated state after bid submission
      await useGameStore.getState().fetchShowcaseState();
    } else {
      const errorMessage = result.error || "Failed to submit showcase bid";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Unlock showcase bid (host only)
  unlockShowcaseBid: async (playerId: number) => {
    set({ isLoading: true, error: null });

    const result = await apiCall("/showcase/unlock-bid", {
      method: "POST",
      body: JSON.stringify({ player_id: playerId }),
    });

    if (result.success) {
      // Fetch updated state after unlocking
      await useGameStore.getState().fetchShowcaseState();
    } else {
      const errorMessage = result.error || "Failed to unlock showcase bid";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Update showcase bid amount (host only)
  updateShowcaseBid: async (playerId: number, bidAmount: number) => {
    set({ isLoading: true, error: null });

    const result = await apiCall("/showcase/update-bid", {
      method: "POST",
      body: JSON.stringify({ player_id: playerId, bid_amount: bidAmount }),
    });

    if (result.success) {
      // Fetch updated state after updating
      await useGameStore.getState().fetchShowcaseState();
    } else {
      const errorMessage = result.error || "Failed to update showcase bid";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Reveal showcase winner (host only)
  revealShowcaseWinner: async () => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{
      winnerId: number;
      bonusWon: boolean;
      retryNeeded: boolean;
    }>("/showcase/reveal-winner", {
      method: "POST",
    });

    if (result.success && result.data) {
      // Fetch updated state after revealing winner
      await useGameStore.getState().fetchShowcaseState();
      set({ isLoading: false });
      return {
        winnerId: result.data.winnerId,
        bonusWon: result.data.bonusWon,
        retryNeeded: result.data.retryNeeded,
      };
    } else {
      const errorMessage = result.error || "Failed to reveal showcase winner";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Initiate showcase retry (host only)
  retryShowcase: async () => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ retryNumber: number }>("/showcase/retry", {
      method: "POST",
    });

    if (result.success) {
      // Fetch updated state after retry
      await useGameStore.getState().fetchShowcaseState();
    } else {
      const errorMessage = result.error || "Failed to retry showcase";
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Fetch showcase state with products
  fetchShowcaseState: async () => {
    set({ isLoading: true, error: null });

    const result = await apiCall<
      ShowcaseStateWithProducts & { success?: boolean }
    >("/showcase/state");

    if (result.success && result.data) {
      // Backend includes { success: true, ...state }, so we need to exclude it
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { success: _, ...showcaseData } = result.data;

      // Update game state with showcase data
      set((state) => ({
        gameState: state.gameState
          ? {
              ...state.gameState,
              showcaseState: showcaseData as ShowcaseStateWithProducts,
            }
          : null,
        isLoading: false,
        lastUpdated: Date.now(),
      }));

      // Also fetch showcase bids
      const bidsResult = await apiCall<{
        success?: boolean;
        bids: ShowcaseBidWithPlayer[];
        retryNumber: number;
      }>("/showcase/bids");

      if (bidsResult.success && bidsResult.data) {
        set((state) => ({
          gameState: state.gameState
            ? {
                ...state.gameState,
                showcaseBids: bidsResult.data?.bids,
              }
            : null,
        }));
      }
    } else {
      set({
        error: result.error || "Failed to fetch showcase state",
        isLoading: false,
      });
    }
  },

  // Clear error message
  clearError: () => set({ error: null }),
}));
