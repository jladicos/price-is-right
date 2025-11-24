import type { Database } from "better-sqlite3";
import type { Player } from "../types/player.js";
import { generateSessionToken } from "../utils/session-token.js";
import {
  findPlayerByAccessCode,
  findPlayerBySessionToken,
  updateSessionToken,
} from "../db/players.js";

export interface LoginResult {
  sessionToken: string;
  player: Player;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Authenticate a player with their access code
 * Creates a new session and returns the session token
 *
 * @throws AuthError if access code is invalid or player is inactive
 */
export function login(db: Database, accessCode: string): LoginResult {
  // Normalize access code (trim and uppercase)
  const normalizedCode = accessCode.trim().toUpperCase();

  // Find player by access code
  const player = findPlayerByAccessCode(db, normalizedCode);

  if (!player) {
    throw new AuthError("Invalid access code", 401);
  }

  if (!player.active) {
    throw new AuthError("Your account has been deactivated", 401);
  }

  // Generate new session token
  const sessionToken = generateSessionToken();

  // Update player with new session token (replaces any existing session)
  const updatedPlayer = updateSessionToken(db, player.id, sessionToken);

  return {
    sessionToken,
    player: updatedPlayer,
  };
}

/**
 * Validate a session token and return the associated player
 *
 * @returns Player if token is valid, null otherwise
 */
export function validateSession(
  db: Database,
  sessionToken: string,
): Player | null {
  if (!sessionToken || sessionToken.trim() === "") {
    return null;
  }

  const player = findPlayerBySessionToken(db, sessionToken);

  if (!player) {
    return null;
  }

  // Check if player is still active
  if (!player.active) {
    return null;
  }

  return player;
}

/**
 * Log out a player by clearing their session token
 *
 * @throws AuthError if session token is invalid
 */
export function logout(db: Database, sessionToken: string): void {
  if (!sessionToken || sessionToken.trim() === "") {
    throw new AuthError("Invalid or expired session", 401);
  }

  const player = findPlayerBySessionToken(db, sessionToken);

  if (!player) {
    throw new AuthError("Invalid or expired session", 401);
  }

  // Clear the session token
  updateSessionToken(db, player.id, null);
}
