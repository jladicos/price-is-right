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

import type Database from "better-sqlite3";

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
  gameWorkflow: Array<{
    id: number;
    currentSegment: string;
    currentSegmentIndex: number;
    phaseType: string;
    phaseMetadata: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  contestantsRow: Array<{
    id: number;
    playerId: number;
    position: number;
    gameSegment: string;
    status: string;
    addedAt: string;
    revealedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  bids: Array<{
    id: number;
    playerId: number;
    productId: string;
    roundNumber: number;
    gameSegment: string;
    bidAmount: number;
    isLocked: number;
    isWinner: number;
    retryNumber: number;
    createdAt: string;
  }>;
  wheelSpins: Array<{
    id: number;
    playerId: number;
    gameSegment: string;
    spinNumber: number;
    result: number;
    spinoffNumber: number;
    createdAt: string;
  }>;
  showcaseBids: Array<{
    id: number;
    playerId: number;
    productId: string;
    bidAmount: number;
    passed: number;
    isWinner: number;
    retryNumber: number;
    createdAt: string;
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
    .all() as DatabaseExport["players"];

  // Export game state
  const gameState = db
    .prepare(
      `SELECT key, value, updated_at AS updatedAt
       FROM game_state
       ORDER BY key`,
    )
    .all() as DatabaseExport["gameState"];

  // Export game workflow
  const gameWorkflow = db
    .prepare(
      `SELECT id, current_segment AS currentSegment, current_segment_index AS currentSegmentIndex,
              phase_type AS phaseType, phase_metadata AS phaseMetadata,
              created_at AS createdAt, updated_at AS updatedAt
       FROM game_workflow`,
    )
    .all() as DatabaseExport["gameWorkflow"];

  // Export contestants row
  const contestantsRow = db
    .prepare(
      `SELECT id, player_id AS playerId, position, game_segment AS gameSegment,
              status, added_at AS addedAt, revealed_at AS revealedAt,
              created_at AS createdAt, updated_at AS updatedAt
       FROM contestants_row
       ORDER BY id`,
    )
    .all() as DatabaseExport["contestantsRow"];

  // Export bids
  const bids = db
    .prepare(
      `SELECT id, player_id AS playerId, product_id AS productId, round_number AS roundNumber,
              game_segment AS gameSegment, bid_amount AS bidAmount, is_locked AS isLocked,
              is_winner AS isWinner, retry_number AS retryNumber, created_at AS createdAt
       FROM bids
       ORDER BY id`,
    )
    .all() as DatabaseExport["bids"];

  // Export wheel spins
  const wheelSpins = db
    .prepare(
      `SELECT id, player_id AS playerId, game_segment AS gameSegment, spin_number AS spinNumber,
              result, spinoff_number AS spinoffNumber, created_at AS createdAt
       FROM wheel_spins
       ORDER BY id`,
    )
    .all() as DatabaseExport["wheelSpins"];

  // Export showcase bids
  const showcaseBids = db
    .prepare(
      `SELECT id, player_id AS playerId, product_id AS productId, bid_amount AS bidAmount,
              passed, is_winner AS isWinner, retry_number AS retryNumber, created_at AS createdAt
       FROM showcase_bids
       ORDER BY id`,
    )
    .all() as DatabaseExport["showcaseBids"];

  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    players,
    gameState,
    gameWorkflow,
    contestantsRow,
    bids,
    wheelSpins,
    showcaseBids,
  };
}

/**
 * Import database from JSON format
 * WARNING: This will DELETE all existing data!
 */
export function importDatabase(
  db: Database.Database,
  data: DatabaseExport,
): void {
  // Validate data structure
  if (
    !data.version ||
    !data.players ||
    !data.gameState ||
    !data.gameWorkflow ||
    !data.contestantsRow ||
    !data.bids ||
    !data.wheelSpins ||
    !data.showcaseBids
  ) {
    throw new Error("Invalid export file format");
  }

  if (data.version !== "1.0") {
    throw new Error(`Unsupported export version: ${data.version}`);
  }

  // Use transaction for atomicity
  const transaction = db.transaction(() => {
    // Clear existing data (order matters due to foreign keys)
    // Delete child tables first
    db.prepare("DELETE FROM showcase_bids").run();
    db.prepare("DELETE FROM wheel_spins").run();
    db.prepare("DELETE FROM bids").run();
    db.prepare("DELETE FROM contestants_row").run();
    db.prepare("DELETE FROM game_workflow").run();
    // Then parent tables
    db.prepare("DELETE FROM players").run();
    db.prepare("DELETE FROM game_state").run();

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

    // Import game workflow
    const insertGameWorkflow = db.prepare(`
      INSERT INTO game_workflow (
        id, current_segment, current_segment_index, phase_type,
        phase_metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const workflow of data.gameWorkflow) {
      insertGameWorkflow.run(
        workflow.id,
        workflow.currentSegment,
        workflow.currentSegmentIndex,
        workflow.phaseType,
        workflow.phaseMetadata,
        workflow.createdAt,
        workflow.updatedAt,
      );
    }

    // Import contestants row
    const insertContestant = db.prepare(`
      INSERT INTO contestants_row (
        id, player_id, position, game_segment, status,
        added_at, revealed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const contestant of data.contestantsRow) {
      insertContestant.run(
        contestant.id,
        contestant.playerId,
        contestant.position,
        contestant.gameSegment,
        contestant.status,
        contestant.addedAt,
        contestant.revealedAt,
        contestant.createdAt,
        contestant.updatedAt,
      );
    }

    // Import bids
    const insertBid = db.prepare(`
      INSERT INTO bids (
        id, player_id, product_id, round_number, game_segment,
        bid_amount, is_locked, is_winner, retry_number, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const bid of data.bids) {
      insertBid.run(
        bid.id,
        bid.playerId,
        bid.productId,
        bid.roundNumber,
        bid.gameSegment,
        bid.bidAmount,
        bid.isLocked,
        bid.isWinner,
        bid.retryNumber,
        bid.createdAt,
      );
    }

    // Import wheel spins
    const insertWheelSpin = db.prepare(`
      INSERT INTO wheel_spins (
        id, player_id, game_segment, spin_number,
        result, spinoff_number, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const spin of data.wheelSpins) {
      insertWheelSpin.run(
        spin.id,
        spin.playerId,
        spin.gameSegment,
        spin.spinNumber,
        spin.result,
        spin.spinoffNumber,
        spin.createdAt,
      );
    }

    // Import showcase bids
    const insertShowcaseBid = db.prepare(`
      INSERT INTO showcase_bids (
        id, player_id, product_id, bid_amount,
        passed, is_winner, retry_number, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const showcaseBid of data.showcaseBids) {
      insertShowcaseBid.run(
        showcaseBid.id,
        showcaseBid.playerId,
        showcaseBid.productId,
        showcaseBid.bidAmount,
        showcaseBid.passed,
        showcaseBid.isWinner,
        showcaseBid.retryNumber,
        showcaseBid.createdAt,
      );
    }

    // Reset SQLite autoincrement sequences
    const maxPlayerId = db
      .prepare("SELECT MAX(id) as maxId FROM players")
      .get() as {
      maxId: number | null;
    };
    if (maxPlayerId.maxId !== null) {
      db.prepare(
        `UPDATE sqlite_sequence SET seq = ? WHERE name = 'players'`,
      ).run(maxPlayerId.maxId);
    }

    const maxContestantId = db
      .prepare("SELECT MAX(id) as maxId FROM contestants_row")
      .get() as {
      maxId: number | null;
    };
    if (maxContestantId.maxId !== null) {
      db.prepare(
        `UPDATE sqlite_sequence SET seq = ? WHERE name = 'contestants_row'`,
      ).run(maxContestantId.maxId);
    }

    const maxBidId = db.prepare("SELECT MAX(id) as maxId FROM bids").get() as {
      maxId: number | null;
    };
    if (maxBidId.maxId !== null) {
      db.prepare(`UPDATE sqlite_sequence SET seq = ? WHERE name = 'bids'`).run(
        maxBidId.maxId,
      );
    }

    const maxWheelSpinId = db
      .prepare("SELECT MAX(id) as maxId FROM wheel_spins")
      .get() as {
      maxId: number | null;
    };
    if (maxWheelSpinId.maxId !== null) {
      db.prepare(
        `UPDATE sqlite_sequence SET seq = ? WHERE name = 'wheel_spins'`,
      ).run(maxWheelSpinId.maxId);
    }

    const maxShowcaseBidId = db
      .prepare("SELECT MAX(id) as maxId FROM showcase_bids")
      .get() as {
      maxId: number | null;
    };
    if (maxShowcaseBidId.maxId !== null) {
      db.prepare(
        `UPDATE sqlite_sequence SET seq = ? WHERE name = 'showcase_bids'`,
      ).run(maxShowcaseBidId.maxId);
    }
  });

  transaction();
}
