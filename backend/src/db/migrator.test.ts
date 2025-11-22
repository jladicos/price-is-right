import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from './migrator';

describe('Migration System', () => {
  it('should create migrations table on first run', () => {
    const db = new Database(':memory:');

    runMigrations(db);

    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'")
      .get();

    expect(table).toBeDefined();

    db.close();
  });

  it('should run initial migration successfully', () => {
    const db = new Database(':memory:');

    runMigrations(db);

    // Check that players table was created
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='players'")
      .get();

    expect(table).toBeDefined();

    db.close();
  });

  it('should record applied migrations in migrations table', () => {
    const db = new Database(':memory:');

    runMigrations(db);

    const migrations = db.prepare('SELECT * FROM migrations ORDER BY id').all();

    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations[0]).toHaveProperty('id');
    expect(migrations[0]).toHaveProperty('name');
    expect(migrations[0]).toHaveProperty('applied_at');

    db.close();
  });

  it('should not re-run migrations that have already been applied', () => {
    const db = new Database(':memory:');

    // Run migrations first time
    runMigrations(db);

    const firstRun = db.prepare('SELECT COUNT(*) as count FROM migrations').get() as {
      count: number;
    };

    // Run migrations second time
    runMigrations(db);

    const secondRun = db.prepare('SELECT COUNT(*) as count FROM migrations').get() as {
      count: number;
    };

    // Should have same number of migrations (no duplicates)
    expect(secondRun.count).toBe(firstRun.count);

    db.close();
  });

  it('should create all expected indexes', () => {
    const db = new Database(':memory:');

    runMigrations(db);

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='players'")
      .all() as Array<{ name: string }>;

    const indexNames = indexes.map((idx) => idx.name);

    // Check for expected indexes
    expect(indexNames).toContain('idx_players_access_code');
    expect(indexNames).toContain('idx_players_session_token');
    expect(indexNames).toContain('idx_players_active');
    expect(indexNames).toContain('idx_players_role');

    db.close();
  });

  it('should create players table with correct schema', () => {
    const db = new Database(':memory:');

    runMigrations(db);

    // Try to insert a valid player
    const stmt = db.prepare(`
      INSERT INTO players (first_name, last_name, access_code, role)
      VALUES (?, ?, ?, ?)
    `);

    expect(() => {
      stmt.run('John', 'Doe', 'ABC123', 'player');
    }).not.toThrow();

    // Verify the player was inserted
    const player = db.prepare('SELECT * FROM players WHERE access_code = ?').get('ABC123');
    expect(player).toBeDefined();

    db.close();
  });

  it('should enforce unique access codes', () => {
    const db = new Database(':memory:');

    runMigrations(db);

    // Insert first player
    db.prepare(
      'INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)',
    ).run('John', 'Doe', 'ABC123', 'player');

    // Try to insert duplicate access code
    expect(() => {
      db.prepare(
        'INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)',
      ).run('Jane', 'Smith', 'ABC123', 'player');
    }).toThrow();

    db.close();
  });

  it('should enforce valid role values', () => {
    const db = new Database(':memory:');

    runMigrations(db);

    // Try to insert invalid role
    expect(() => {
      db.prepare(
        'INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)',
      ).run('John', 'Doe', 'ABC123', 'invalid_role');
    }).toThrow();

    db.close();
  });

  it('should set default values correctly', () => {
    const db = new Database(':memory:');

    runMigrations(db);

    db.prepare(
      'INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)',
    ).run('John', 'Doe', 'ABC123', 'player');

    const player = db.prepare('SELECT * FROM players WHERE access_code = ?').get('ABC123') as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    // Check defaults
    expect(player.photo_filename).toBe('default.jpg');
    expect(player.active).toBe(1); // SQLite uses 1 for true
    expect(player.created_at).toBeDefined();
    expect(player.updated_at).toBeDefined();

    db.close();
  });
});
