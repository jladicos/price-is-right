import Database from 'better-sqlite3';

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 6;

/**
 * Generates a random 6-character uppercase alphanumeric access code
 */
export function generateAccessCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * CHARACTERS.length);
    code += CHARACTERS[randomIndex];
  }
  return code;
}

/**
 * Generates a unique access code that doesn't exist in the database
 */
export function generateUniqueAccessCode(db: Database.Database): string {
  let code: string;
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    code = generateAccessCode();
    attempts++;

    const existing = db
      .prepare('SELECT id FROM players WHERE access_code = ?')
      .get(code.toUpperCase());

    if (!existing) {
      return code;
    }
  }

  throw new Error('Failed to generate unique access code after 100 attempts');
}

/**
 * Validates an access code format (6 alphanumeric characters)
 */
export function isValidAccessCodeFormat(code: unknown): boolean {
  if (typeof code !== 'string') {
    return false;
  }

  if (code.length !== CODE_LENGTH) {
    return false;
  }

  return /^[A-Z0-9]+$/i.test(code);
}

/**
 * Normalizes an access code to uppercase for comparison
 */
export function normalizeAccessCode(code: string): string {
  return code.toUpperCase();
}
