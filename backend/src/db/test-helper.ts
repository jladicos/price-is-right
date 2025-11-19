import Database from 'better-sqlite3';
import { runMigrations } from './migrator.js';

/**
 * Creates an in-memory test database with all migrations applied
 * Use this in tests to get a fresh, isolated database for each test
 */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Run all migrations
  runMigrations(db);

  return db;
}
