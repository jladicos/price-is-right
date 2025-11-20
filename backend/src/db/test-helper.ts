import Database from "better-sqlite3";
import { runMigrations } from "./migrator.js";
import { initDatabase, closeDatabase } from "./connection.js";

/**
 * Creates an in-memory test database with all migrations applied
 * Use this in tests to get a fresh, isolated database for each test
 */
export function createTestDb(): Database.Database {
  const db = new Database(":memory:");

  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  // Run all migrations
  runMigrations(db);

  return db;
}

/**
 * Set up a test database using the connection singleton
 * Use this for tests that use getDatabase() from connection.ts
 */
export function setupTestDatabase(): void {
  initDatabase(":memory:");
}

/**
 * Clean up the test database
 * Call this in afterEach to ensure clean state between tests
 */
export function cleanupTestDatabase(): void {
  closeDatabase();
}
