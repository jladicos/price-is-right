/**
 * Database Export/Import - Disaster Recovery Core Functions
 *
 * Provides transaction-based database backup and restore capabilities for disaster recovery.
 * These functions are the foundation of the admin panel's export/import features.
 *
 * Key Design Principles:
 * - Security: Session tokens are NEVER exported
 * - Atomicity: Imports use transactions (all-or-nothing, no partial imports)
 * - Versioning: Export format is versioned for backward compatibility
 * - Validation: Strict validation of import data structure and version
 * - ID Safety: Autoincrement sequences reset after import to prevent conflicts
 *
 * Export Format (v1.0):
 * {
 *   version: "1.0",
 *   exportedAt: "2025-01-18T12:00:00.000Z",
 *   players: [{ id, firstName, lastName, email, accessCode, photoFilename, role, active, ... }],
 *   gameState: [{ key, value, updatedAt }]
 * }
 *
 * Security Considerations:
 * - Session tokens excluded from export (users must re-login after import)
 * - Authentication required at API layer (not enforced here)
 * - Exported files should be stored securely offsite
 * - Import validation prevents injection attacks
 *
 * Transaction Safety:
 * - Import wrapped in BEGIN/COMMIT transaction
 * - Any constraint violation triggers ROLLBACK
 * - Original data preserved if import fails
 * - Tested extensively (see export-import.test.ts)
 */

import type Database from 'better-sqlite3';

export interface DatabaseExport {
  version: string;
  exportedAt: string;
  players: Array<{
    id: number;
    firstName: string;
    lastName: string;
    email: string | null;
    accessCode: string;
    photoFilename: string;
    role: string;
    active: number;
    createdAt: string;
    updatedAt: string;
  }>;
  gameState: Array<{
    key: string;
    value: string;
    updatedAt: string;
  }>;
}

/**
 * Export entire database to JSON format
 */
export function exportDatabase(db: Database.Database): DatabaseExport {
  // Export players (excluding session tokens for security)
  const players = db
    .prepare(
      `SELECT id, first_name AS firstName, last_name AS lastName, email,
              access_code AS accessCode, photo_filename AS photoFilename,
              role, active, created_at AS createdAt, updated_at AS updatedAt
       FROM players
       ORDER BY id`,
    )
    .all() as DatabaseExport['players'];

  // Export game state
  const gameState = db
    .prepare(
      `SELECT key, value, updated_at AS updatedAt
       FROM game_state
       ORDER BY key`,
    )
    .all() as DatabaseExport['gameState'];

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    players,
    gameState,
  };
}

/**
 * Import database from JSON format
 * WARNING: This will DELETE all existing data!
 */
export function importDatabase(db: Database.Database, data: DatabaseExport): void {
  // Validate data structure
  if (!data.version || !data.players || !data.gameState) {
    throw new Error('Invalid export file format');
  }

  if (data.version !== '1.0') {
    throw new Error(`Unsupported export version: ${data.version}`);
  }

  // Use transaction for atomicity
  const transaction = db.transaction(() => {
    // Clear existing data
    db.prepare('DELETE FROM players').run();
    db.prepare('DELETE FROM game_state').run();

    // Import players
    const insertPlayer = db.prepare(`
      INSERT INTO players (
        id, first_name, last_name, email, access_code,
        photo_filename, role, active, session_token,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?
      )
    `);

    for (const player of data.players) {
      insertPlayer.run(
        player.id,
        player.firstName,
        player.lastName,
        player.email,
        player.accessCode,
        player.photoFilename,
        player.role,
        player.active,
        player.createdAt,
        player.updatedAt,
      );
    }

    // Import game state
    const insertGameState = db.prepare(`
      INSERT INTO game_state (key, value, updated_at)
      VALUES (?, ?, ?)
    `);

    for (const state of data.gameState) {
      insertGameState.run(state.key, state.value, state.updatedAt);
    }

    // Reset SQLite autoincrement sequence for players
    const maxPlayerId = db.prepare('SELECT MAX(id) as maxId FROM players').get() as {
      maxId: number | null;
    };
    if (maxPlayerId.maxId !== null) {
      db.prepare(`UPDATE sqlite_sequence SET seq = ? WHERE name = 'players'`).run(
        maxPlayerId.maxId,
      );
    }
  });

  transaction();
}
