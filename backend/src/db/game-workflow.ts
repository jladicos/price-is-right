import { getDatabase } from "./connection.js";

export interface GameWorkflow {
  id: number;
  current_segment: string;
  current_segment_index: number;
  phase_type: string;
  phase_metadata: string | null;
  created_at: string;
  updated_at: string;
  // Game start flag
  officially_started: number; // 0 = not started, 1 = started
  // Finale fields (Phase 7)
  finale_player1_id?: number | null;
  finale_player2_id?: number | null;
  finale_player1_product_value?: number | null;
  finale_player2_product_value?: number | null;
  finale_player1_showcase?: number | null;
  finale_player2_showcase?: number | null;
  finale_retry_number?: number | null;
  finale_player1_passed?: number | null;
  finale_winner_id?: number | null;
  finale_bonus_won?: number | null;
}

export interface GameWorkflowUpdate {
  current_segment?: string;
  current_segment_index?: number;
  phase_type?: string;
  phase_metadata?: string | null;
  officially_started?: number;
}

/**
 * Get the current game workflow state
 * Always returns exactly one row (id = 1)
 */
export function getGameWorkflow(): GameWorkflow {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM game_workflow WHERE id = 1").get() as
    | GameWorkflow
    | undefined;

  if (!row) {
    throw new Error("Game workflow not initialized");
  }

  return row;
}

/**
 * Initialize or reset game workflow to default 'not_started' state
 * This is idempotent - safe to call multiple times
 */
export function initializeGame(): GameWorkflow {
  const db = getDatabase();

  // Update the single row to not_started state
  const stmt = db.prepare(`
    UPDATE game_workflow
    SET current_segment = ?,
        current_segment_index = ?,
        phase_type = ?,
        phase_metadata = ?,
        updated_at = datetime('now')
    WHERE id = 1
  `);

  stmt.run("section_1", 0, "not_started", null);

  return getGameWorkflow();
}

/**
 * Update game workflow state
 * Only updates fields that are provided
 */
export function updateGameWorkflow(updates: GameWorkflowUpdate): GameWorkflow {
  const db = getDatabase();

  // Build dynamic update query
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.current_segment !== undefined) {
    fields.push("current_segment = ?");
    values.push(updates.current_segment);
  }

  if (updates.current_segment_index !== undefined) {
    fields.push("current_segment_index = ?");
    values.push(updates.current_segment_index);
  }

  if (updates.phase_type !== undefined) {
    fields.push("phase_type = ?");
    values.push(updates.phase_type);
  }

  if (updates.phase_metadata !== undefined) {
    fields.push("phase_metadata = ?");
    values.push(updates.phase_metadata);
  }

  if (updates.officially_started !== undefined) {
    fields.push("officially_started = ?");
    values.push(updates.officially_started);
  }

  if (fields.length === 0) {
    // No updates, just return current state
    return getGameWorkflow();
  }

  // Always update updated_at
  fields.push("updated_at = datetime('now')");

  const sql = `UPDATE game_workflow SET ${fields.join(", ")} WHERE id = 1`;
  const stmt = db.prepare(sql);
  stmt.run(...values);

  return getGameWorkflow();
}

/**
 * Reset all game state (workflow + all game data)
 * Used when starting a new game
 */
export function resetGame(): void {
  const db = getDatabase();

  // Use transaction to ensure atomic reset
  db.transaction(() => {
    // Clear all game data tables
    db.prepare("DELETE FROM contestants_row").run();
    db.prepare("DELETE FROM bids").run();
    db.prepare("DELETE FROM wheel_spins").run();
    db.prepare("DELETE FROM showcase_bids").run();

    // Reset all players with role='player' back to 'audience'
    // This makes them eligible for selection in the next game
    db.prepare(
      `
      UPDATE players
      SET role = 'audience',
          updated_at = datetime('now')
      WHERE role = 'player'
    `,
    ).run();

    // Reset workflow to initial state (including all finale/showcase fields)
    db.prepare(
      `
      UPDATE game_workflow
      SET current_segment = 'section_1',
          current_segment_index = 0,
          phase_type = 'not_started',
          phase_metadata = NULL,
          officially_started = 0,
          finale_player1_id = NULL,
          finale_player2_id = NULL,
          finale_player1_product_value = NULL,
          finale_player2_product_value = NULL,
          finale_player1_showcase = NULL,
          finale_player2_showcase = NULL,
          finale_retry_number = 0,
          finale_player1_passed = 0,
          finale_winner_id = NULL,
          finale_bonus_won = 0,
          updated_at = datetime('now')
      WHERE id = 1
    `,
    ).run();
  })();
}
