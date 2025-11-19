import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  login as apiLogin,
  logout as apiLogout,
  validateSession as apiValidateSession,
  setSessionExpiredHandler,
  setSessionTokenGetter,
  type Player,
} from '../utils/api';

// Auth store state
interface AuthState {
  sessionToken: string | null;
  currentPlayer: Player | null;
  loading: boolean;
  error: string | null;
}

// Auth store actions
interface AuthActions {
  login: (accessCode: string) => Promise<void>;
  logout: () => Promise<void>;
  validateSession: () => Promise<void>;
  handleSessionExpired: () => void;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      sessionToken: null,
      currentPlayer: null,
      loading: false,
      error: null,

      // Actions
      login: async (accessCode: string) => {
        set({ loading: true, error: null });
        try {
          const response = await apiLogin(accessCode);
          set({
            sessionToken: response.sessionToken,
            currentPlayer: response.player,
            loading: false,
            error: null,
          });
        } catch (error) {
          set({
            sessionToken: null,
            currentPlayer: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Login failed',
          });
          throw error;
        }
      },

      logout: async () => {
        set({ loading: true, error: null });
        try {
          // Only call API logout if we have a session token
          if (get().sessionToken) {
            await apiLogout();
          }
          set({
            sessionToken: null,
            currentPlayer: null,
            loading: false,
            error: null,
          });
        } catch (error) {
          // Clear session even if API call fails
          set({
            sessionToken: null,
            currentPlayer: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Logout failed',
          });
        }
      },

      validateSession: async () => {
        const { sessionToken } = get();
        if (!sessionToken) {
          set({ loading: false });
          return;
        }

        set({ loading: true, error: null });
        try {
          const response = await apiValidateSession();
          set({
            currentPlayer: response.player,
            loading: false,
            error: null,
          });
        } catch (error) {
          // Session is invalid, clear it
          set({
            sessionToken: null,
            currentPlayer: null,
            loading: false,
            error: null, // Don't show error for invalid session on validation
          });
        }
      },

      handleSessionExpired: () => {
        // Clear session without making API call
        set({
          sessionToken: null,
          currentPlayer: null,
          loading: false,
          error: 'Your session has expired. Please log in again.',
        });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'pir_auth_storage',
      partialize: (state) => ({
        sessionToken: state.sessionToken,
        currentPlayer: state.currentPlayer,
      }),
    },
  ),
);

// Set up API client integration
setSessionTokenGetter(() => useAuthStore.getState().sessionToken);
setSessionExpiredHandler(() => useAuthStore.getState().handleSessionExpired());

// Auto-validate session on app load if token exists
const initialState = useAuthStore.getState();
if (initialState.sessionToken) {
  initialState.validateSession();
}
