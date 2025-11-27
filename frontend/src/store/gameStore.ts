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
}

interface GameStore {
  // State
  gameState: GameState | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number;
  isWheelAnimating: boolean; // UI-only animation state

  // Actions
  fetchGameState: () => Promise<void>;
  startNewGame: () => Promise<void>;
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
      });
      return;
    }

    const result = await apiCall("/game/wheel-spin", {
      method: "POST",
      body: JSON.stringify({
        playerId: playerId,
        gameSegment: state.workflow.current_segment,
      }),
    });

    if (result.success) {
      // Keep animation running for 2.5 seconds
      setTimeout(() => {
        set({ isWheelAnimating: false });
      }, 2500);

      await useGameStore.getState().fetchGameState();
    } else {
      const errorMessage = result.error || "Failed to spin wheel";
      set({
        error: errorMessage,
        isLoading: false,
        isWheelAnimating: false,
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

    const result = await apiCall("/game/start-spinoff", {
      method: "POST",
      body: JSON.stringify({
        game_segment: state.workflow.current_segment,
        spinoff_number: spinoffNumber,
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

  // Clear error message
  clearError: () => set({ error: null }),
}));
