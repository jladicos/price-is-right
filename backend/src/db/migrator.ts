import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Migration {
  id: number;
  name: string;
  appliedAt: string;
}

/**
 * Creates the migrations tracking table if it doesn't exist
 */
function createMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/**
 * Gets list of applied migrations from the database
 */
function getAppliedMigrations(db: Database.Database): Migration[] {
  const rows = db
    .prepare(
      "SELECT id, name, applied_at as appliedAt FROM migrations ORDER BY id",
    )
    .all() as Migration[];
  return rows;
}

/**
 * Gets list of migration files from the migrations directory
 */
function getMigrationFiles(): { id: number; name: string; path: string }[] {
  const migrationsDir = path.join(__dirname, "..", "..", "migrations");

  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const files = fs.readdirSync(migrationsDir);
  const migrations = files
    .filter((file) => file.endsWith(".sql"))
    .map((file) => {
      const match = file.match(/^(\d+)-(.+)\.sql$/);
      if (!match) {
        throw new Error(`Invalid migration filename: ${file}`);
      }
      return {
        id: parseInt(match[1], 10),
        name: match[2],
        path: path.join(migrationsDir, file),
      };
    })
    .sort((a, b) => a.id - b.id);

  return migrations;
}

/**
 * Runs pending migrations
 */
export function runMigrations(db: Database.Database): void {
  createMigrationsTable(db);

  const appliedMigrations = getAppliedMigrations(db);
  const migrationFiles = getMigrationFiles();

  const appliedIds = new Set(appliedMigrations.map((m) => m.id));

  const pendingMigrations = migrationFiles.filter((m) => !appliedIds.has(m.id));

  if (pendingMigrations.length === 0) {
    console.log("No pending migrations");
    return;
  }

  console.log(`Running ${pendingMigrations.length} pending migration(s)...`);

  for (const migration of pendingMigrations) {
    console.log(`Applying migration ${migration.id}: ${migration.name}`);

    const sql = fs.readFileSync(migration.path, "utf-8");

    try {
      db.exec(sql);
      db.prepare("INSERT INTO migrations (id, name) VALUES (?, ?)").run(
        migration.id,
        migration.name,
      );
      console.log(`✓ Migration ${migration.id} applied successfully`);
    } catch (error) {
      console.error(`✗ Migration ${migration.id} failed:`, error);
      throw error;
    }
  }

  console.log("All migrations completed successfully");
}
