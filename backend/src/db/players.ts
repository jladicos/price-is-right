import type { Database } from 'better-sqlite3';
import type { Player, PlayerRole } from '../types/player.js';

/**
 * Database representation of a player (snake_case)
 */
interface PlayerRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  access_code: string;
  photo_filename: string;
  role: PlayerRole;
  active: number; // SQLite uses 0/1 for boolean
  session_token: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to Player object (camelCase)
 */
function rowToPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    accessCode: row.access_code,
    photoFilename: row.photo_filename,
    role: row.role,
    active: row.active === 1,
    weight: row.weight ?? 1.0,
    sessionToken: row.session_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Find a player by their access code
 */
export function findPlayerByAccessCode(db: Database, accessCode: string): Player | null {
  const row = db
    .prepare(`SELECT * FROM players WHERE UPPER(access_code) = UPPER(?) LIMIT 1`)
    .get(accessCode) as PlayerRow | undefined;

  return row ? rowToPlayer(row) : null;
}

/**
 * Find a player by their session token
 */
export function findPlayerBySessionToken(db: Database, sessionToken: string): Player | null {
  const row = db
    .prepare(`SELECT * FROM players WHERE session_token = ? LIMIT 1`)
    .get(sessionToken) as PlayerRow | undefined;

  return row ? rowToPlayer(row) : null;
}

/**
 * Update a player's session token
 * Returns the updated player
 */
export function updateSessionToken(
  db: Database,
  playerId: number,
  sessionToken: string | null,
): Player {
  const stmt = db.prepare(`
    UPDATE players
    SET session_token = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  stmt.run(sessionToken, playerId);

  // Fetch and return the updated player
  const row = db.prepare(`SELECT * FROM players WHERE id = ?`).get(playerId) as PlayerRow;

  return rowToPlayer(row);
}

/**
 * Clear a player's session token
 */
export function clearSessionToken(db: Database, playerId: number): void {
  updateSessionToken(db, playerId, null);
}

/**
 * Get all players
 */
export function getAllPlayers(db: Database): Player[] {
  const rows = db.prepare(`SELECT * FROM players ORDER BY id`).all() as PlayerRow[];
  return rows.map(rowToPlayer);
}

/**
 * Get a player by ID
 */
export function getPlayerById(db: Database, id: number): Player | null {
  const row = db.prepare(`SELECT * FROM players WHERE id = ?`).get(id) as PlayerRow | undefined;

  return row ? rowToPlayer(row) : null;
}

/**
 * Search players with filters, sorting, and pagination
 */
export interface SearchPlayersOptions {
  search?: string; // Search by name (first or last)
  role?: PlayerRole; // Filter by role
  active?: boolean; // Filter by active status
  sortBy?: 'name' | 'role' | 'created_at'; // Sort field
  sortOrder?: 'asc' | 'desc'; // Sort direction
  limit?: number; // Pagination: items per page
  offset?: number; // Pagination: starting position
}

export interface SearchPlayersResult {
  players: Player[];
  total: number;
}

export function searchPlayers(
  db: Database,
  options: SearchPlayersOptions = {},
): SearchPlayersResult {
  const {
    search,
    role,
    active,
    sortBy = 'created_at',
    sortOrder = 'desc',
    limit,
    offset = 0,
  } = options;

  // Build WHERE clause
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (search) {
    conditions.push(
      `(LOWER(first_name || ' ' || last_name) LIKE LOWER(?) OR LOWER(last_name || ' ' || first_name) LIKE LOWER(?))`,
    );
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern);
  }

  if (role) {
    conditions.push(`role = ?`);
    params.push(role);
  }

  if (active !== undefined) {
    conditions.push(`active = ?`);
    params.push(active ? 1 : 0);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Build ORDER BY clause
  let orderByClause = '';
  if (sortBy === 'name') {
    orderByClause = `ORDER BY first_name ${sortOrder}, last_name ${sortOrder}`;
  } else if (sortBy === 'role') {
    orderByClause = `ORDER BY role ${sortOrder}, first_name ${sortOrder}`;
  } else {
    // created_at
    orderByClause = `ORDER BY created_at ${sortOrder}`;
  }

  // Build LIMIT/OFFSET clause
  const paginationClause = limit !== undefined ? `LIMIT ${limit} OFFSET ${offset}` : '';

  // Get total count
  const countQuery = `SELECT COUNT(*) as count FROM players ${whereClause}`;
  const countResult = db.prepare(countQuery).get(...params) as {
    count: number;
  };
  const total = countResult.count;

  // Get players
  const query = `SELECT * FROM players ${whereClause} ${orderByClause} ${paginationClause}`;
  const rows = db.prepare(query).all(...params) as PlayerRow[];
  const players = rows.map(rowToPlayer);

  return { players, total };
}

/**
 * Update player details (name, role, photo filename)
 */
export interface UpdatePlayerData {
  firstName?: string;
  lastName?: string;
  role?: PlayerRole;
  photoFilename?: string;
  weight?: number;
}

export function updatePlayer(db: Database, playerId: number, data: UpdatePlayerData): Player {
  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (data.firstName !== undefined) {
    updates.push('first_name = ?');
    params.push(data.firstName);
  }

  if (data.lastName !== undefined) {
    updates.push('last_name = ?');
    params.push(data.lastName);
  }

  if (data.role !== undefined) {
    updates.push('role = ?');
    params.push(data.role);
  }

  if (data.photoFilename !== undefined) {
    updates.push('photo_filename = ?');
    params.push(data.photoFilename);
  }

  if (data.weight !== undefined) {
    updates.push('weight = ?');
    params.push(data.weight);
  }

  if (updates.length === 0) {
    // No updates to make, just return current player
    const row = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId) as PlayerRow;
    return rowToPlayer(row);
  }

  updates.push("updated_at = datetime('now')");
  params.push(playerId);

  const stmt = db.prepare(`
    UPDATE players
    SET ${updates.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...params);

  // Fetch and return the updated player
  const row = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId) as PlayerRow;
  return rowToPlayer(row);
}

/**
 * Deactivate a player (set active = false, clear session)
 */
export function deactivatePlayer(db: Database, playerId: number): Player {
  const stmt = db.prepare(`
    UPDATE players
    SET active = 0, session_token = NULL, updated_at = datetime('now')
    WHERE id = ?
  `);

  stmt.run(playerId);

  // Fetch and return the updated player
  const row = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId) as PlayerRow;
  return rowToPlayer(row);
}

/**
 * Activate a player (set active = true)
 */
export function activatePlayer(db: Database, playerId: number): Player {
  const stmt = db.prepare(`
    UPDATE players
    SET active = 1, updated_at = datetime('now')
    WHERE id = ?
  `);

  stmt.run(playerId);

  // Fetch and return the updated player
  const row = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId) as PlayerRow;
  return rowToPlayer(row);
}

/**
 * Reset a player's access code (generate new code, clear session)
 * Returns the updated player with new access code
 */
export function resetPlayerAccessCode(
  db: Database,
  playerId: number,
  newAccessCode: string,
): Player {
  const stmt = db.prepare(`
    UPDATE players
    SET access_code = ?, session_token = NULL, updated_at = datetime('now')
    WHERE id = ?
  `);

  stmt.run(newAccessCode, playerId);

  // Fetch and return the updated player
  const row = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId) as PlayerRow;
  return rowToPlayer(row);
}

/**
 * Count how many hosts are currently in the system
 */
export function countHosts(db: Database): number {
  const result = db.prepare("SELECT COUNT(*) as count FROM players WHERE role = 'host'").get() as {
    count: number;
  };
  return result.count;
}

/**
 * Create a new player
 */
export interface CreatePlayerData {
  firstName: string;
  lastName: string;
  accessCode: string;
  role: PlayerRole;
  photoFilename?: string;
  email?: string | null;
}

export function createPlayer(db: Database, data: CreatePlayerData): Player {
  const stmt = db.prepare(`
    INSERT INTO players (first_name, last_name, access_code, role, photo_filename, email)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    data.firstName,
    data.lastName,
    data.accessCode,
    data.role,
    data.photoFilename || 'default.jpg',
    data.email || null,
  );

  const playerId = result.lastInsertRowid as number;

  // Fetch and return the created player
  const row = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId) as PlayerRow;
  return rowToPlayer(row);
}

/**
 * Reset all player access codes
 * Returns the number of players affected
 */
export function resetAllAccessCodes(db: Database, accessCodeGenerator: () => string): number {
  // Get all players
  const players = getAllPlayers(db);

  // Update each player with a new unique code and clear their session
  const stmt = db.prepare(`
    UPDATE players
    SET access_code = ?, session_token = NULL, updated_at = datetime('now')
    WHERE id = ?
  `);

  let count = 0;
  for (const player of players) {
    const newCode = accessCodeGenerator();
    stmt.run(newCode, player.id);
    count++;
  }

  return count;
}

/**
 * Delete all non-host players
 * Returns the number of players deleted
 */
export function deleteAllNonHostPlayers(db: Database): number {
  return db.transaction(() => {
    // First, delete all related records that reference non-host players
    // This is necessary because foreign key constraints don't have ON DELETE CASCADE

    // Delete contestants for non-host players
    db.prepare(
      `
      DELETE FROM contestants_row
      WHERE player_id IN (SELECT id FROM players WHERE role != 'host')
    `,
    ).run();

    // Delete bids for non-host players
    db.prepare(
      `
      DELETE FROM bids
      WHERE player_id IN (SELECT id FROM players WHERE role != 'host')
    `,
    ).run();

    // Delete wheel spins for non-host players
    db.prepare(
      `
      DELETE FROM wheel_spins
      WHERE player_id IN (SELECT id FROM players WHERE role != 'host')
    `,
    ).run();

    // Delete showcase bids for non-host players
    db.prepare(
      `
      DELETE FROM showcase_bids
      WHERE player_id IN (SELECT id FROM players WHERE role != 'host')
    `,
    ).run();

    // Finally, delete the non-host players themselves
    const result = db
      .prepare(
        `
      DELETE FROM players
      WHERE role != 'host'
    `,
      )
      .run();

    return result.changes;
  })();
}
