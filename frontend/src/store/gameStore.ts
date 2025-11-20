import { create } from 'zustand';

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

export interface GameState {
  workflow: GameWorkflow;
  contestantsRow: ContestantWithPlayer[];
  eligibleAudienceCount: number;
}

interface GameStore {
  // State
  gameState: GameState | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number;

  // Actions
  fetchGameState: () => Promise<void>;
  startNewGame: () => Promise<void>;
  advancePhase: () => Promise<void>;
  revealContestant: (contestantRowId: number) => Promise<void>;
  manualSelectContestant: (playerId: number, position: number, segment: string) => Promise<void>;
  replaceContestantRandom: (contestantRowId: number) => Promise<void>;
  replaceContestantManual: (contestantRowId: number, newPlayerId: number) => Promise<void>;
  refreshContestantsRow: (segment: 'section_1' | 'section_2') => Promise<void>;
  overridePhase: (
    segment: string,
    segmentIndex: number,
    phaseType: string,
    phaseMetadata?: unknown,
  ) => Promise<void>;
  clearError: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
  if (!token || token.trim() === '') {
    return {
      success: false,
      error: 'Not authenticated',
    };
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  // Ensure POST/PUT requests have a body (even if empty)
  const method = options.method?.toUpperCase();
  const needsBody = method === 'POST' || method === 'PUT';
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
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export const useGameStore = create<GameStore>((set) => ({
  // Initial state
  gameState: null,
  isLoading: false,
  error: null,
  lastUpdated: 0,

  // Fetch current game state
  fetchGameState: async () => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ state: GameState }>('/game/state');

    if (result.success && result.data) {
      set({
        gameState: result.data.state,
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } else {
      set({
        error: result.error || 'Failed to fetch game state',
        isLoading: false,
      });
    }
  },

  // Start a new game
  startNewGame: async () => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ state: GameState }>('/game/start', {
      method: 'POST',
    });

    if (result.success && result.data) {
      set({
        gameState: result.data.state,
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } else {
      const errorMessage = result.error || 'Failed to start game';
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

    const result = await apiCall<{ state: GameState }>('/game/advance', {
      method: 'POST',
    });

    if (result.success && result.data) {
      set({
        gameState: result.data.state,
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } else {
      const errorMessage = result.error || 'Failed to advance phase';
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

    const result = await apiCall<{ contestant: ContestantWithPlayer }>('/game/reveal-contestant', {
      method: 'POST',
      body: JSON.stringify({ contestantRowId }),
    });

    if (result.success) {
      // Fetch updated state after revealing
      await useGameStore.getState().fetchGameState();
    } else {
      const errorMessage = result.error || 'Failed to reveal contestant';
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
      '/game/replace-contestant-random',
      {
        method: 'POST',
        body: JSON.stringify({ contestantRowId }),
      },
    );

    if (result.success) {
      // Fetch updated state after replacement
      await useGameStore.getState().fetchGameState();
    } else {
      const errorMessage = result.error || 'Failed to replace contestant';
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Manually select contestant at specific position
  manualSelectContestant: async (playerId: number, position: number, segment: string) => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ contestant: ContestantWithPlayer }>(
      '/game/manual-select-contestant',
      {
        method: 'POST',
        body: JSON.stringify({ playerId, position, segment }),
      },
    );

    if (result.success) {
      // Fetch updated state after selection
      await useGameStore.getState().fetchGameState();
    } else {
      const errorMessage = result.error || 'Failed to manually select contestant';
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Replace contestant with manual selection
  replaceContestantManual: async (contestantRowId: number, newPlayerId: number) => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ contestant: ContestantWithPlayer }>(
      '/game/replace-contestant-manual',
      {
        method: 'POST',
        body: JSON.stringify({ contestantRowId, newPlayerId }),
      },
    );

    if (result.success) {
      // Fetch updated state after replacement
      await useGameStore.getState().fetchGameState();
    } else {
      const errorMessage = result.error || 'Failed to replace contestant';
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Refresh entire contestant's row
  refreshContestantsRow: async (segment: 'section_1' | 'section_2') => {
    set({ isLoading: true, error: null });

    const result = await apiCall<{ contestants: ContestantWithPlayer[] }>(
      '/game/refresh-contestants-row',
      {
        method: 'POST',
        body: JSON.stringify({ segment }),
      },
    );

    if (result.success) {
      // Fetch updated state after refresh
      await useGameStore.getState().fetchGameState();
    } else {
      const errorMessage = result.error || 'Failed to refresh contestants row';
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

    const result = await apiCall<{ state: GameState }>('/game/override-phase', {
      method: 'POST',
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
        error: result.error || 'Failed to override phase',
        isLoading: false,
      });
    }
  },

  // Clear error message
  clearError: () => set({ error: null }),
}));
