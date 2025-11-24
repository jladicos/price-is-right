import type { Database } from "better-sqlite3";

/**
 * Get game enabled status
 */
export function getGameEnabled(db: Database): boolean {
  const row = db
    .prepare("SELECT value FROM game_state WHERE key = 'game_enabled'")
    .get() as { value: string } | undefined;

  if (!row) {
    // Default to enabled if not set
    return true;
  }

  return row.value === "true";
}

/**
 * Set game enabled status
 */
export function setGameEnabled(db: Database, enabled: boolean): void {
  const stmt = db.prepare(`
    INSERT INTO game_state (key, value, updated_at)
    VALUES ('game_enabled', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now')
  `);

  stmt.run(enabled ? "true" : "false");
}
