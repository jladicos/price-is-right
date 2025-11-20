/**
 * Shared authentication constants
 * This file ensures consistency across all auth-related code
 */

/**
 * localStorage key for persisted auth state
 * Used by zustand persist middleware in authStore
 */
export const AUTH_STORAGE_KEY = 'pir_auth_storage';

/**
 * Field names in the persisted auth state
 */
export const AUTH_STORAGE_FIELDS = {
  SESSION_TOKEN: 'sessionToken',
  CURRENT_PLAYER: 'currentPlayer',
} as const;
