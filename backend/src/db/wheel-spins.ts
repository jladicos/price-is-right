import { getDatabase } from "./connection.js";

export interface WheelSpin {
  id: number;
  player_id: number;
  game_segment: string;
  spin_number: number;
  result: number;
  spinoff_number: number;
  created_at: string;
}

export interface WheelSpinWithPlayer extends WheelSpin {
  first_name: string;
  last_name: string;
  photo_filename: string;
}

/**
 * Create a new wheel spin
 */
export function createWheelSpin(
  playerId: number,
  gameSegment: string,
  spinNumber: number,
  result: number,
  spinoffNumber: number = 0,
): WheelSpin {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO wheel_spins (player_id, game_segment, spin_number, result, spinoff_number)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertResult = stmt.run(
    playerId,
    gameSegment,
    spinNumber,
    result,
    spinoffNumber,
  );

  // Fetch and return the created spin
  const spin = db
    .prepare("SELECT * FROM wheel_spins WHERE id = ?")
    .get(insertResult.lastInsertRowid) as WheelSpin;

  return spin;
}

/**
 * Get all spins for a specific player in a segment
 */
export function getWheelSpinsForPlayer(
  playerId: number,
  gameSegment: string,
): WheelSpin[] {
  const db = getDatabase();

  const spins = db
    .prepare(
      `
    SELECT *
    FROM wheel_spins
    WHERE player_id = ?
      AND game_segment = ?
    ORDER BY created_at ASC
  `,
    )
    .all(playerId, gameSegment) as WheelSpin[];

  return spins;
}

/**
 * Get all spins for a specific segment
 * Includes player info
 */
export function getAllWheelSpinsForSegment(
  gameSegment: string,
): WheelSpinWithPlayer[] {
  const db = getDatabase();

  const spins = db
    .prepare(
      `
    SELECT
      w.*,
      p.first_name,
      p.last_name,
      p.photo_filename
    FROM wheel_spins w
    JOIN players p ON w.player_id = p.id
    WHERE w.game_segment = ?
    ORDER BY w.created_at ASC
  `,
    )
    .all(gameSegment) as WheelSpinWithPlayer[];

  return spins;
}

/**
 * Get total spin value for a player in a segment
 * Sums all spins for the player (excluding spinoff spins, which are separate)
 */
export function getPlayerWheelTotal(
  playerId: number,
  gameSegment: string,
  spinoffNumber: number = 0,
): number {
  const db = getDatabase();

  const result = db
    .prepare(
      `
    SELECT COALESCE(SUM(result), 0) as total
    FROM wheel_spins
    WHERE player_id = ?
      AND game_segment = ?
      AND spinoff_number = ?
  `,
    )
    .get(playerId, gameSegment, spinoffNumber) as { total: number };

  return result.total;
}

/**
 * Get spin count for a player in a segment
 * Used to enforce max 2 spins per player in regular rounds
 */
export function getPlayerSpinCount(
  playerId: number,
  gameSegment: string,
  spinoffNumber: number = 0,
): number {
  const db = getDatabase();

  const result = db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM wheel_spins
    WHERE player_id = ?
      AND game_segment = ?
      AND spinoff_number = ?
  `,
    )
    .get(playerId, gameSegment, spinoffNumber) as { count: number };

  return result.count;
}

/**
 * Delete all spins for a specific segment
 * Used when resetting a wheel round
 */
export function deleteWheelSpinsForSegment(gameSegment: string): void {
  const db = getDatabase();

  db.prepare("DELETE FROM wheel_spins WHERE game_segment = ?").run(gameSegment);
}

/**
 * Delete all wheel spins
 * Used when starting a new game
 */
export function deleteAllWheelSpins(): void {
  const db = getDatabase();

  db.prepare("DELETE FROM wheel_spins").run();
}

/**
 * Get all players who have spun in a segment with their totals
 * Returns player info with total spin value
 */
export function getPlayerTotalsForSegment(
  gameSegment: string,
  spinoffNumber: number = 0,
): Array<{
  player_id: number;
  first_name: string;
  last_name: string;
  photo_filename: string;
  total: number;
  spin_count: number;
}> {
  const db = getDatabase();

  const results = db
    .prepare(
      `
    SELECT
      w.player_id,
      p.first_name,
      p.last_name,
      p.photo_filename,
      SUM(w.result) as total,
      COUNT(*) as spin_count
    FROM wheel_spins w
    JOIN players p ON w.player_id = p.id
    WHERE w.game_segment = ?
      AND w.spinoff_number = ?
    GROUP BY w.player_id
    ORDER BY total DESC
  `,
    )
    .all(gameSegment, spinoffNumber) as Array<{
    player_id: number;
    first_name: string;
    last_name: string;
    photo_filename: string;
    total: number;
    spin_count: number;
  }>;

  return results;
}
