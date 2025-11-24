import { getDatabase } from "./connection.js";

export interface Contestant {
  id: number;
  player_id: number;
  position: number;
  game_segment: string;
  status: string;
  added_at: string;
  revealed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContestantWithPlayer extends Contestant {
  first_name: string;
  last_name: string;
  photo_filename: string;
  role: string;
}

/**
 * Add a contestant to the contestant's row
 */
export function addContestantToRow(
  playerId: number,
  position: number,
  segment: string,
  status: string,
): Contestant {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO contestants_row (player_id, position, game_segment, status)
    VALUES (?, ?, ?, ?)
  `);

  const result = stmt.run(playerId, position, segment, status);

  // Fetch and return the created contestant
  const contestant = db
    .prepare("SELECT * FROM contestants_row WHERE id = ?")
    .get(result.lastInsertRowid) as Contestant;

  return contestant;
}

/**
 * Get all contestants for a specific game segment
 * Returns contestants with player info joined
 */
export function getContestantsRow(segment: string): ContestantWithPlayer[] {
  const db = getDatabase();

  const contestants = db
    .prepare(
      `
    SELECT
      c.*,
      p.first_name,
      p.last_name,
      p.photo_filename,
      p.role
    FROM contestants_row c
    JOIN players p ON c.player_id = p.id
    WHERE c.game_segment = ?
    ORDER BY c.position ASC
  `,
    )
    .all(segment) as ContestantWithPlayer[];

  return contestants;
}

/**
 * Get active contestants (status = 'active' or 'pending_reveal') for a segment
 */
export function getActiveContestants(segment: string): ContestantWithPlayer[] {
  const db = getDatabase();

  const contestants = db
    .prepare(
      `
    SELECT
      c.*,
      p.first_name,
      p.last_name,
      p.photo_filename,
      p.role
    FROM contestants_row c
    JOIN players p ON c.player_id = p.id
    WHERE c.game_segment = ?
      AND c.status IN ('active', 'pending_reveal')
    ORDER BY c.position ASC
  `,
    )
    .all(segment) as ContestantWithPlayer[];

  return contestants;
}

/**
 * Get ALL active contestants regardless of segment
 * Used for displaying the current contestant's row during gameplay
 * Contestants persist across sections unless explicitly replaced
 * Includes winners (status='won') so they remain visible after winning
 */
export function getAllActiveContestants(): ContestantWithPlayer[] {
  const db = getDatabase();

  const contestants = db
    .prepare(
      `
    SELECT
      c.*,
      p.first_name,
      p.last_name,
      p.photo_filename,
      p.role
    FROM contestants_row c
    JOIN players p ON c.player_id = p.id
    WHERE c.status IN ('active', 'pending_reveal', 'won')
    ORDER BY c.position ASC
  `,
    )
    .all() as ContestantWithPlayer[];

  return contestants;
}

/**
 * Reveal a contestant to the audience
 * Updates status to 'active' and sets revealed_at timestamp
 * NOTE: This does NOT update the player's role - that's done in the service layer
 */
export function revealContestant(contestantId: number): Contestant {
  const db = getDatabase();

  const stmt = db.prepare(`
    UPDATE contestants_row
    SET status = 'active',
        revealed_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ?
  `);

  stmt.run(contestantId);

  const contestant = db
    .prepare("SELECT * FROM contestants_row WHERE id = ?")
    .get(contestantId) as Contestant;

  return contestant;
}

/**
 * Update a contestant's status
 */
export function updateContestantStatus(
  contestantId: number,
  status: string,
): Contestant {
  const db = getDatabase();

  const stmt = db.prepare(`
    UPDATE contestants_row
    SET status = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);

  stmt.run(status, contestantId);

  const contestant = db
    .prepare("SELECT * FROM contestants_row WHERE id = ?")
    .get(contestantId) as Contestant;

  return contestant;
}

/**
 * Replace a contestant in a specific position
 * Marks the old contestant as 'replaced' and adds the new contestant
 * Preserves the position number
 */
export function replaceContestant(
  oldContestantId: number,
  newPlayerId: number,
  newStatus: string,
): { old: Contestant; new: Contestant } {
  const db = getDatabase();

  // Get the old contestant to preserve position and segment
  const oldContestant = db
    .prepare("SELECT * FROM contestants_row WHERE id = ?")
    .get(oldContestantId) as Contestant;

  if (!oldContestant) {
    throw new Error(`Contestant ${oldContestantId} not found`);
  }

  // Use transaction to ensure atomic replacement
  const result = db.transaction(() => {
    // Mark old contestant as replaced
    db.prepare(
      `
      UPDATE contestants_row
      SET status = 'replaced',
          updated_at = datetime('now')
      WHERE id = ?
    `,
    ).run(oldContestantId);

    // Add new contestant in same position
    const insertResult = db
      .prepare(
        `
      INSERT INTO contestants_row (player_id, position, game_segment, status)
      VALUES (?, ?, ?, ?)
    `,
      )
      .run(
        newPlayerId,
        oldContestant.position,
        oldContestant.game_segment,
        newStatus,
      );

    // Get updated records
    const updatedOld = db
      .prepare("SELECT * FROM contestants_row WHERE id = ?")
      .get(oldContestantId) as Contestant;

    const newContestant = db
      .prepare("SELECT * FROM contestants_row WHERE id = ?")
      .get(insertResult.lastInsertRowid) as Contestant;

    return { old: updatedOld, new: newContestant };
  })();

  return result;
}

/**
 * Clear all contestants from a specific segment
 * Used when refreshing the entire contestant's row
 */
export function clearContestantsRow(segment: string): void {
  const db = getDatabase();

  // Mark all contestants as 'replaced' rather than deleting
  // This preserves history
  db.prepare(
    `
    UPDATE contestants_row
    SET status = 'replaced',
        updated_at = datetime('now')
    WHERE game_segment = ?
      AND status IN ('active', 'pending_reveal')
  `,
  ).run(segment);
}

/**
 * Calculate bidding order for current active contestants
 * Returns positions in order: most recently added goes first
 * Then continues in circular order (position numbers ascending, wrapping around)
 */
export function getBiddingOrder(segment: string): number[] {
  const db = getDatabase();

  // Get the most recently added active contestant
  const mostRecent = db
    .prepare(
      `
    SELECT position
    FROM contestants_row
    WHERE game_segment = ?
      AND status = 'active'
    ORDER BY added_at DESC, id DESC
    LIMIT 1
  `,
    )
    .get(segment) as { position: number } | undefined;

  if (!mostRecent) {
    return []; // No active contestants
  }

  // Get all active positions
  const allActive = db
    .prepare(
      `
    SELECT position
    FROM contestants_row
    WHERE game_segment = ?
      AND status = 'active'
    ORDER BY position ASC
  `,
    )
    .all(segment) as Array<{ position: number }>;

  const activePositions = allActive.map((c) => c.position);

  // Build circular order starting from most recent
  const result: number[] = [mostRecent.position];

  // Add positions after most recent (in ascending order)
  for (const pos of activePositions) {
    if (pos > mostRecent.position) {
      result.push(pos);
    }
  }

  // Wrap around: add positions before most recent
  for (const pos of activePositions) {
    if (pos < mostRecent.position) {
      result.push(pos);
    }
  }

  return result;
}

/**
 * Get a specific contestant by ID
 */
export function getContestantById(
  contestantId: number,
): Contestant | undefined {
  const db = getDatabase();

  const contestant = db
    .prepare("SELECT * FROM contestants_row WHERE id = ?")
    .get(contestantId) as Contestant | undefined;

  return contestant;
}

/**
 * Find next empty position in contestant's row (1-5)
 * Returns the lowest available position, or null if all filled
 * Note: The _segment parameter is kept for API compatibility but not used in the query
 * since contestants persist across all segments
 */
export function findNextEmptyPosition(_segment: string): number | null {
  const db = getDatabase();

  // Check ALL active contestants regardless of segment
  // Since contestants persist across sections, we need to check globally
  // Include 'won' status since winners still occupy their position until replaced
  const occupiedPositions = db
    .prepare(
      `
    SELECT position
    FROM contestants_row
    WHERE status IN ('active', 'pending_reveal', 'won')
    ORDER BY position ASC
  `,
    )
    .all() as Array<{ position: number }>;

  const occupied = new Set(occupiedPositions.map((c) => c.position));

  // Find first empty position (1-5)
  for (let pos = 1; pos <= 5; pos++) {
    if (!occupied.has(pos)) {
      return pos;
    }
  }

  return null; // All positions filled
}
