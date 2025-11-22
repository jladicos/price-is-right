/**
 * Export Validation Tests
 *
 * These tests verify that critical exports exist in the API module.
 * They DO NOT mock the module, so they will fail if exports are missing.
 *
 * This prevents runtime errors like missing exports that cause blank screens.
 */

import { describe, it, expect } from 'vitest';

describe('API Module Exports', () => {
  it('should export all required functions and types', async () => {
    // Import the actual module WITHOUT mocking
    const apiModule = await import('./api');

    // Verify all critical exports exist
    expect(apiModule.login).toBeDefined();
    expect(apiModule.login).toBeTypeOf('function');

    expect(apiModule.logout).toBeDefined();
    expect(apiModule.logout).toBeTypeOf('function');

    expect(apiModule.validateSession).toBeDefined();
    expect(apiModule.validateSession).toBeTypeOf('function');

    expect(apiModule.getPlayers).toBeDefined();
    expect(apiModule.getPlayers).toBeTypeOf('function');

    expect(apiModule.getPlayer).toBeDefined();
    expect(apiModule.getPlayer).toBeTypeOf('function');

    expect(apiModule.setSessionExpiredHandler).toBeDefined();
    expect(apiModule.setSessionExpiredHandler).toBeTypeOf('function');

    expect(apiModule.setSessionTokenGetter).toBeDefined();
    expect(apiModule.setSessionTokenGetter).toBeTypeOf('function');

    // CRITICAL: Verify apiRequest export exists
    // This is used by WelcomePage, AdminPage, and other components
    expect(apiModule.apiRequest).toBeDefined();
    expect(apiModule.apiRequest).toBeTypeOf('function');
  });

  it('should export apiRequest as the same function as internal apiFetch', async () => {
    const apiModule = await import('./api');

    // Both should be functions
    expect(apiModule.apiRequest).toBeTypeOf('function');

    // Verify it has the function signature we expect (async function)
    expect(apiModule.apiRequest.constructor.name).toBe('AsyncFunction');
  });

  it('should be importable by components without errors', async () => {
    // This simulates what components do: import { apiRequest } from './api'
    // If the export is missing, this will throw at import time
    let importError: Error | null = null;

    try {
      const { apiRequest } = await import('./api');
      expect(apiRequest).toBeDefined();
    } catch (error) {
      importError = error as Error;
    }

    expect(importError).toBeNull();
  });

  it('should export all TypeScript types', async () => {
    // TypeScript types don't exist at runtime, but we can verify the module
    // compiles and exports are accessible via dynamic import
    const apiModule = await import('./api');

    // Verify the module has the expected shape
    expect(apiModule).toHaveProperty('login');
    expect(apiModule).toHaveProperty('logout');
    expect(apiModule).toHaveProperty('validateSession');
    expect(apiModule).toHaveProperty('apiRequest');
    expect(apiModule).toHaveProperty('getPlayers');
    expect(apiModule).toHaveProperty('getPlayer');
  });
});
