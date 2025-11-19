import crypto from 'crypto';

const ALPHANUMERIC_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure random session token
 * @returns A 32-character alphanumeric string
 */
export function generateSessionToken(): string {
  const bytes = crypto.randomBytes(TOKEN_LENGTH);
  let token = '';

  for (let i = 0; i < TOKEN_LENGTH; i++) {
    const randomIndex = bytes[i] % ALPHANUMERIC_CHARS.length;
    token += ALPHANUMERIC_CHARS[randomIndex];
  }

  return token;
}
