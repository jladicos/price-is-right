import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getGameWorkflow, initializeGame, updateGameWorkflow, resetGame } from './game-workflow.js';
import { getDatabase } from './connection.js';
import { setupTestDatabase, cleanupTestDatabase } from './test-helper.js';

describe('Game Workflow Database Functions', () => {
  beforeEach(() => {
    setupTestDatabase();
  });

  afterEach(() => {
    cleanupTestDatabase();
  });

  describe('getGameWorkflow', () => {
    it('should return the game workflow state', () => {
      const workflow = getGameWorkflow();

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe(1);
      expect(workflow.current_segment).toBeDefined();
      expect(workflow.phase_type).toBeDefined();
    });

    it('should always return id = 1', () => {
      const workflow = getGameWorkflow();
      expect(workflow.id).toBe(1);
    });

    it('should have default not_started state after migrations', () => {
      const workflow = getGameWorkflow();

      expect(workflow.phase_type).toBe('not_started');
      expect(workflow.current_segment).toBe('section_1');
      expect(workflow.current_segment_index).toBe(0);
      expect(workflow.phase_metadata).toBeNull();
    });

    it('should include created_at and updated_at timestamps', () => {
      const workflow = getGameWorkflow();

      // Verify timestamps are valid SQLite datetime format
      expect(workflow.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(workflow.updated_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('initializeGame', () => {
    it('should set workflow to not_started state', () => {
      // First change it to something else
      updateGameWorkflow({ phase_type: 'bidding' });

      // Then initialize
      const workflow = initializeGame();

      expect(workflow.phase_type).toBe('not_started');
      expect(workflow.current_segment).toBe('section_1');
      expect(workflow.current_segment_index).toBe(0);
      expect(workflow.phase_metadata).toBeNull();
    });

    it('should be idempotent (safe to call multiple times)', () => {
      const first = initializeGame();
      const second = initializeGame();
      const third = initializeGame();

      expect(first.phase_type).toBe('not_started');
      expect(second.phase_type).toBe('not_started');
      expect(third.phase_type).toBe('not_started');
    });

    it('should create valid datetime timestamps', () => {
      const workflow = initializeGame();

      // Should have valid SQLite datetime format
      expect(workflow.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(workflow.updated_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('should maintain single row (id = 1)', () => {
      initializeGame();

      const db = getDatabase();
      const count = db.prepare('SELECT COUNT(*) as count FROM game_workflow').get() as {
        count: number;
      };

      expect(count.count).toBe(1);
    });
  });

  describe('updateGameWorkflow', () => {
    it('should update phase_type', () => {
      updateGameWorkflow({ phase_type: 'contestant_selection' });

      const workflow = getGameWorkflow();
      expect(workflow.phase_type).toBe('contestant_selection');
    });

    it('should update current_segment', () => {
      updateGameWorkflow({ current_segment: 'section_2' });

      const workflow = getGameWorkflow();
      expect(workflow.current_segment).toBe('section_2');
    });

    it('should update current_segment_index', () => {
      updateGameWorkflow({ current_segment_index: 3 });

      const workflow = getGameWorkflow();
      expect(workflow.current_segment_index).toBe(3);
    });

    it('should update phase_metadata', () => {
      const metadata = JSON.stringify({ product_id: 'car-001' });
      updateGameWorkflow({ phase_metadata: metadata });

      const workflow = getGameWorkflow();
      expect(workflow.phase_metadata).toBe(metadata);
    });

    it('should update multiple fields at once', () => {
      updateGameWorkflow({
        phase_type: 'bidding',
        current_segment: 'section_2',
        current_segment_index: 2,
        phase_metadata: JSON.stringify({ round: 2 }),
      });

      const workflow = getGameWorkflow();
      expect(workflow.phase_type).toBe('bidding');
      expect(workflow.current_segment).toBe('section_2');
      expect(workflow.current_segment_index).toBe(2);
      expect(workflow.phase_metadata).toBe(JSON.stringify({ round: 2 }));
    });

    it('should only update provided fields', () => {
      // Set initial state
      updateGameWorkflow({
        phase_type: 'bidding',
        current_segment: 'section_2',
        current_segment_index: 3,
      });

      // Update only phase_type
      updateGameWorkflow({ phase_type: 'wheel' });

      const workflow = getGameWorkflow();
      expect(workflow.phase_type).toBe('wheel');
      expect(workflow.current_segment).toBe('section_2'); // Unchanged
      expect(workflow.current_segment_index).toBe(3); // Unchanged
      expect(workflow.phase_metadata).toBeNull(); // Unchanged
    });

    it('should update updated_at timestamp with valid format', () => {
      const before = getGameWorkflow();
      updateGameWorkflow({ phase_type: 'bidding' });
      const after = getGameWorkflow();

      // Timestamp should be valid SQLite datetime format
      expect(after.updated_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      // Timestamp should have changed (or at least be >= before)
      expect(after.updated_at >= before.updated_at).toBe(true);
    });

    it('should return updated workflow', () => {
      const workflow = updateGameWorkflow({ phase_type: 'showcase' });

      expect(workflow.phase_type).toBe('showcase');
      expect(workflow).toMatchObject({
        id: 1,
        phase_type: 'showcase',
      });
    });

    it('should handle empty updates gracefully', () => {
      const before = getGameWorkflow();
      const workflow = updateGameWorkflow({});

      // Should return current state unchanged (except possibly updated_at)
      expect(workflow.id).toBe(before.id);
      expect(workflow.phase_type).toBe(before.phase_type);
    });

    it('should handle null phase_metadata', () => {
      // First set metadata
      updateGameWorkflow({ phase_metadata: JSON.stringify({ test: true }) });

      // Then clear it
      updateGameWorkflow({ phase_metadata: null });

      const workflow = getGameWorkflow();
      expect(workflow.phase_metadata).toBeNull();
    });
  });

  describe('resetGame', () => {
    beforeEach(() => {
      const db = getDatabase();

      // First create a test player (required for foreign key constraints)
      db.prepare(
        `
        INSERT INTO players (first_name, last_name, access_code, role)
        VALUES ('Test', 'Player', 'TEST123', 'player')
      `,
      ).run();

      // Set up some game state to be cleared
      updateGameWorkflow({
        phase_type: 'bidding',
        current_segment: 'section_2',
        current_segment_index: 5,
      });

      // Add some test data to game tables
      db.prepare(
        `
        INSERT INTO contestants_row (player_id, position, game_segment, status)
        VALUES (1, 1, 'section_1', 'active')
      `,
      ).run();

      db.prepare(
        `
        INSERT INTO bids (player_id, product_id, round_number, game_segment, bid_amount)
        VALUES (1, 'test-product', 1, 'section_1', 1000)
      `,
      ).run();
    });

    it('should reset workflow to not_started', () => {
      resetGame();

      const workflow = getGameWorkflow();
      expect(workflow.phase_type).toBe('not_started');
      expect(workflow.current_segment).toBe('section_1');
      expect(workflow.current_segment_index).toBe(0);
      expect(workflow.phase_metadata).toBeNull();
    });

    it('should clear contestants_row table', () => {
      resetGame();

      const db = getDatabase();
      const count = db.prepare('SELECT COUNT(*) as count FROM contestants_row').get() as {
        count: number;
      };

      expect(count.count).toBe(0);
    });

    it('should clear bids table', () => {
      resetGame();

      const db = getDatabase();
      const count = db.prepare('SELECT COUNT(*) as count FROM bids').get() as {
        count: number;
      };

      expect(count.count).toBe(0);
    });

    it('should clear wheel_spins table', () => {
      resetGame();

      const db = getDatabase();
      const count = db.prepare('SELECT COUNT(*) as count FROM wheel_spins').get() as {
        count: number;
      };

      expect(count.count).toBe(0);
    });

    it('should clear showcase_bids table', () => {
      resetGame();

      const db = getDatabase();
      const count = db.prepare('SELECT COUNT(*) as count FROM showcase_bids').get() as {
        count: number;
      };

      expect(count.count).toBe(0);
    });

    it('should be atomic (all-or-nothing)', () => {
      // This test verifies the transaction works
      // If any part fails, nothing should be committed
      resetGame();

      const db = getDatabase();
      const workflowCount = db.prepare('SELECT COUNT(*) as count FROM game_workflow').get() as {
        count: number;
      };
      const contestantsCount = db
        .prepare('SELECT COUNT(*) as count FROM contestants_row')
        .get() as { count: number };
      const bidsCount = db.prepare('SELECT COUNT(*) as count FROM bids').get() as {
        count: number;
      };

      // Workflow should still have exactly 1 row
      expect(workflowCount.count).toBe(1);
      // All game tables should be empty
      expect(contestantsCount.count).toBe(0);
      expect(bidsCount.count).toBe(0);
    });

    it('should not delete players table', () => {
      const db = getDatabase();

      // beforeEach already created a player, so we don't need to add another
      resetGame();

      const count = db.prepare('SELECT COUNT(*) as count FROM players').get() as {
        count: number;
      };

      // Players should still exist (exactly 1 from beforeEach)
      expect(count.count).toBe(1);
    });

    it('should not delete game_state table', () => {
      resetGame();

      const db = getDatabase();
      const count = db.prepare('SELECT COUNT(*) as count FROM game_state').get() as {
        count: number;
      };

      // game_state should still exist (exactly 1 row from migration)
      expect(count.count).toBe(1);
    });
  });

  describe('single-row enforcement', () => {
    it('should maintain exactly one row in game_workflow', () => {
      const db = getDatabase();

      // Try various operations
      initializeGame();
      updateGameWorkflow({ phase_type: 'bidding' });
      updateGameWorkflow({ current_segment: 'section_2' });
      resetGame();

      const count = db.prepare('SELECT COUNT(*) as count FROM game_workflow').get() as {
        count: number;
      };

      expect(count.count).toBe(1);
    });

    it('should prevent direct insert of second row (database constraint)', () => {
      const db = getDatabase();

      expect(() => {
        db.prepare(
          `
          INSERT INTO game_workflow (id, current_segment, current_segment_index, phase_type)
          VALUES (2, 'section_1', 0, 'not_started')
        `,
        ).run();
      }).toThrow();
    });
  });

  describe('edge cases and validation', () => {
    it('should handle very long phase_metadata JSON strings', () => {
      const largeMetadata = JSON.stringify({
        data: 'x'.repeat(10000),
        nested: {
          deeply: {
            nested: {
              object: 'value',
            },
          },
        },
      });

      const workflow = updateGameWorkflow({ phase_metadata: largeMetadata });
      expect(workflow.phase_metadata).toBe(largeMetadata);
    });

    it('should handle special characters in phase_metadata', () => {
      const metadata = JSON.stringify({
        special: 'quotes"and\'stuff',
        unicode: '🎮🎯',
        newlines: 'line1\nline2',
      });

      const workflow = updateGameWorkflow({ phase_metadata: metadata });
      expect(workflow.phase_metadata).toBe(metadata);

      // Verify we can parse it back
      const parsed = JSON.parse(workflow.phase_metadata!);
      expect(parsed.special).toBe('quotes"and\'stuff');
      expect(parsed.unicode).toBe('🎮🎯');
    });

    it('should handle empty string phase_metadata', () => {
      const workflow = updateGameWorkflow({ phase_metadata: '' });
      expect(workflow.phase_metadata).toBe('');
    });

    it('should handle segment_index of 0', () => {
      const workflow = updateGameWorkflow({ current_segment_index: 0 });
      expect(workflow.current_segment_index).toBe(0);
    });

    it('should handle large segment_index values', () => {
      const workflow = updateGameWorkflow({ current_segment_index: 9999 });
      expect(workflow.current_segment_index).toBe(9999);
    });

    it('should allow negative segment_index (for potential reverse iteration)', () => {
      // Even though we may not use it, database shouldn't prevent it
      const workflow = updateGameWorkflow({ current_segment_index: -1 });
      expect(workflow.current_segment_index).toBe(-1);
    });
  });

  describe('state transitions and behavioral tests', () => {
    it('should allow full game lifecycle: start → play → reset → start again', () => {
      // Start fresh
      initializeGame();
      let workflow = getGameWorkflow();
      expect(workflow.phase_type).toBe('not_started');

      // Begin contestant selection
      workflow = updateGameWorkflow({
        phase_type: 'contestant_selection',
        current_segment: 'section_1',
      });
      expect(workflow.phase_type).toBe('contestant_selection');

      // Move to bidding
      workflow = updateGameWorkflow({
        phase_type: 'bidding',
        current_segment_index: 0,
      });
      expect(workflow.phase_type).toBe('bidding');

      // Reset
      resetGame();
      workflow = getGameWorkflow();
      expect(workflow.phase_type).toBe('not_started');
      expect(workflow.current_segment).toBe('section_1');
      expect(workflow.current_segment_index).toBe(0);

      // Should be able to start again
      workflow = updateGameWorkflow({ phase_type: 'contestant_selection' });
      expect(workflow.phase_type).toBe('contestant_selection');
    });

    it('should preserve workflow state when only game data is modified', () => {
      const db = getDatabase();

      // Set workflow to a specific state
      updateGameWorkflow({
        phase_type: 'bidding',
        current_segment: 'section_2',
        current_segment_index: 3,
      });

      // Create a player
      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, role)
         VALUES ('Test', 'Player', 'PRESERVE123', 'player')`,
      ).run();

      // Add some game data
      db.prepare(
        `INSERT INTO contestants_row (player_id, position, game_segment, status)
         VALUES (1, 1, 'section_2', 'active')`,
      ).run();

      // Workflow should be unchanged
      const workflow = getGameWorkflow();
      expect(workflow.phase_type).toBe('bidding');
      expect(workflow.current_segment).toBe('section_2');
      expect(workflow.current_segment_index).toBe(3);
    });
  });

  describe('migration initialization validation', () => {
    it('should have exactly one row after migration', () => {
      const db = getDatabase();
      const count = db.prepare('SELECT COUNT(*) as count FROM game_workflow').get() as {
        count: number;
      };

      expect(count.count).toBe(1);
    });

    it('should have correct default values from migration', () => {
      const workflow = getGameWorkflow();

      expect(workflow.id).toBe(1);
      expect(workflow.phase_type).toBe('not_started');
      expect(workflow.current_segment).toBe('section_1');
      expect(workflow.current_segment_index).toBe(0);
      expect(workflow.phase_metadata).toBeNull();
      expect(workflow.created_at).toBeDefined();
      expect(workflow.updated_at).toBeDefined();
    });
  });

  describe('resetGame comprehensive validation', () => {
    beforeEach(() => {
      const db = getDatabase();

      // Create test player
      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, role)
         VALUES ('Test', 'Player', 'RESETTEST', 'player')`,
      ).run();

      // Set up game state in all tables
      updateGameWorkflow({
        phase_type: 'showcase',
        current_segment: 'finale',
        current_segment_index: 5,
        phase_metadata: JSON.stringify({ final: true }),
      });

      // Add data to all game tables
      db.prepare(
        `INSERT INTO contestants_row (player_id, position, game_segment, status)
         VALUES (1, 2, 'section_1', 'won')`,
      ).run();

      db.prepare(
        `INSERT INTO bids (player_id, product_id, round_number, game_segment, bid_amount)
         VALUES (1, 'prod-1', 1, 'section_1', 500)`,
      ).run();

      db.prepare(
        `INSERT INTO wheel_spins (player_id, game_segment, spin_number, result)
         VALUES (1, 'wheel_1', 1, 0.85)`,
      ).run();

      db.prepare(
        `INSERT INTO showcase_bids (player_id, product_id, bid_amount)
         VALUES (1, 'showcase-1', 10000)`,
      ).run();
    });

    it('should verify all game tables have data before reset', () => {
      const db = getDatabase();

      // This verifies our beforeEach setup is working
      const contestants = db.prepare('SELECT COUNT(*) as count FROM contestants_row').get() as {
        count: number;
      };
      const bids = db.prepare('SELECT COUNT(*) as count FROM bids').get() as {
        count: number;
      };
      const spins = db.prepare('SELECT COUNT(*) as count FROM wheel_spins').get() as {
        count: number;
      };
      const showcase = db.prepare('SELECT COUNT(*) as count FROM showcase_bids').get() as {
        count: number;
      };

      expect(contestants.count).toBe(1);
      expect(bids.count).toBe(1);
      expect(spins.count).toBe(1);
      expect(showcase.count).toBe(1);
    });

    it('should clear ALL game tables atomically', () => {
      const db = getDatabase();

      resetGame();

      // All game tables should be empty
      expect(
        (
          db.prepare('SELECT COUNT(*) as count FROM contestants_row').get() as {
            count: number;
          }
        ).count,
      ).toBe(0);
      expect(
        (
          db.prepare('SELECT COUNT(*) as count FROM bids').get() as {
            count: number;
          }
        ).count,
      ).toBe(0);
      expect(
        (
          db.prepare('SELECT COUNT(*) as count FROM wheel_spins').get() as {
            count: number;
          }
        ).count,
      ).toBe(0);
      expect(
        (
          db.prepare('SELECT COUNT(*) as count FROM showcase_bids').get() as {
            count: number;
          }
        ).count,
      ).toBe(0);

      // Workflow should be reset
      const workflow = getGameWorkflow();
      expect(workflow.phase_type).toBe('not_started');
      expect(workflow.current_segment).toBe('section_1');
      expect(workflow.current_segment_index).toBe(0);
      expect(workflow.phase_metadata).toBeNull();
    });

    it('should preserve players table count but reset contestant roles', () => {
      const db = getDatabase();

      // Change a player's role to 'player' (simulating they were promoted during game)
      db.prepare('UPDATE players SET role = ? WHERE access_code = ?').run('player', 'RESETTEST');

      const playersBefore = db.prepare('SELECT * FROM players').all() as Array<{
        id: number;
        first_name: string;
        last_name: string;
        access_code: string;
        role: string;
      }>;
      expect(playersBefore.length).toBe(1);
      expect(playersBefore[0].role).toBe('player'); // Verify it's a contestant

      resetGame();

      const playersAfter = db.prepare('SELECT * FROM players').all() as Array<{
        id: number;
        first_name: string;
        last_name: string;
        access_code: string;
        role: string;
      }>;
      expect(playersAfter.length).toBe(1); // Player count preserved
      expect(playersAfter[0].access_code).toBe('RESETTEST'); // Same player
      expect(playersAfter[0].role).toBe('audience'); // Role reset to audience
    });
  });

  describe('field independence verification', () => {
    it('should not affect other fields when updating phase_type only', () => {
      // Set initial complex state
      updateGameWorkflow({
        current_segment: 'section_2',
        current_segment_index: 5,
        phase_metadata: JSON.stringify({ test: true }),
      });

      const before = getGameWorkflow();

      // Update only phase_type
      updateGameWorkflow({ phase_type: 'wheel' });

      const after = getGameWorkflow();
      expect(after.phase_type).toBe('wheel');
      expect(after.current_segment).toBe(before.current_segment);
      expect(after.current_segment_index).toBe(before.current_segment_index);
      expect(after.phase_metadata).toBe(before.phase_metadata);
    });

    it('should not affect other fields when updating current_segment only', () => {
      updateGameWorkflow({
        phase_type: 'bidding',
        current_segment_index: 3,
        phase_metadata: JSON.stringify({ round: 2 }),
      });

      const before = getGameWorkflow();

      updateGameWorkflow({ current_segment: 'finale' });

      const after = getGameWorkflow();
      expect(after.current_segment).toBe('finale');
      expect(after.phase_type).toBe(before.phase_type);
      expect(after.current_segment_index).toBe(before.current_segment_index);
      expect(after.phase_metadata).toBe(before.phase_metadata);
    });

    it('should allow clearing phase_metadata while keeping other fields', () => {
      updateGameWorkflow({
        phase_type: 'bidding',
        current_segment: 'section_2',
        phase_metadata: JSON.stringify({ data: 'value' }),
      });

      const before = getGameWorkflow();
      expect(before.phase_metadata).toBeTruthy();

      updateGameWorkflow({ phase_metadata: null });

      const after = getGameWorkflow();
      expect(after.phase_metadata).toBeNull();
      expect(after.phase_type).toBe(before.phase_type);
      expect(after.current_segment).toBe(before.current_segment);
    });

    it('should not affect other fields when updating segment_index only', () => {
      updateGameWorkflow({
        phase_type: 'bidding',
        current_segment: 'section_1',
        phase_metadata: JSON.stringify({ round: 1 }),
      });

      const before = getGameWorkflow();

      updateGameWorkflow({ current_segment_index: 10 });

      const after = getGameWorkflow();
      expect(after.current_segment_index).toBe(10);
      expect(after.phase_type).toBe(before.phase_type);
      expect(after.current_segment).toBe(before.current_segment);
      expect(after.phase_metadata).toBe(before.phase_metadata);
    });
  });

  describe('error conditions and recovery', () => {
    it('should throw error if game_workflow row is deleted', () => {
      const db = getDatabase();

      // Manually delete the row (simulating corruption)
      db.prepare('DELETE FROM game_workflow WHERE id = 1').run();

      // getGameWorkflow should throw
      expect(() => getGameWorkflow()).toThrow('Game workflow not initialized');
    });

    it('should be recoverable after row deletion by manual re-insert', () => {
      const db = getDatabase();

      // Delete the row
      db.prepare('DELETE FROM game_workflow WHERE id = 1').run();

      // Verify it's gone
      expect(() => getGameWorkflow()).toThrow();

      // Recover by re-inserting
      db.prepare(
        `INSERT INTO game_workflow (id, current_segment, current_segment_index, phase_type)
         VALUES (1, 'section_1', 0, 'not_started')`,
      ).run();

      // Now it should work
      const workflow = getGameWorkflow();
      expect(workflow.phase_type).toBe('not_started');
    });
  });

  describe('timestamp ordering and validation', () => {
    it('should have updated_at >= created_at after creation', () => {
      const workflow = getGameWorkflow();
      expect(workflow.updated_at >= workflow.created_at).toBe(true);
    });

    it('should have updated_at >= created_at after updates', () => {
      updateGameWorkflow({ phase_type: 'bidding' });
      updateGameWorkflow({ current_segment: 'section_2' });
      updateGameWorkflow({ current_segment_index: 5 });

      const workflow = getGameWorkflow();
      expect(workflow.updated_at >= workflow.created_at).toBe(true);
    });

    it('should update updated_at to be >= previous value', () => {
      const before = getGameWorkflow();
      updateGameWorkflow({ phase_type: 'wheel' });
      const after = getGameWorkflow();

      expect(after.updated_at >= before.updated_at).toBe(true);
    });

    it('should keep created_at unchanged across updates', () => {
      const initial = getGameWorkflow();
      updateGameWorkflow({ phase_type: 'bidding' });
      updateGameWorkflow({ current_segment: 'section_2' });

      const final = getGameWorkflow();
      expect(final.created_at).toBe(initial.created_at);
    });
  });

  describe('resetGame atomicity verification', () => {
    beforeEach(() => {
      const db = getDatabase();

      // Create test player for foreign key
      db.prepare(
        `INSERT INTO players (first_name, last_name, access_code, role)
         VALUES ('Atom', 'Test', 'ATOM123', 'player')`,
      ).run();

      // Add data that resetGame should clear
      db.prepare(
        `INSERT INTO contestants_row (player_id, position, game_segment, status)
         VALUES (1, 1, 'section_1', 'active')`,
      ).run();
    });

    it('should complete all deletions in resetGame together', () => {
      const db = getDatabase();

      // Add data to multiple tables
      db.prepare(
        `INSERT INTO bids (player_id, product_id, round_number, game_segment, bid_amount)
         VALUES (1, 'test', 1, 'section_1', 100)`,
      ).run();

      // resetGame should clear both tables
      resetGame();

      const contestants = db.prepare('SELECT COUNT(*) as count FROM contestants_row').get() as {
        count: number;
      };
      const bids = db.prepare('SELECT COUNT(*) as count FROM bids').get() as {
        count: number;
      };

      // Both should be cleared
      expect(contestants.count).toBe(0);
      expect(bids.count).toBe(0);

      // Player should still exist (not cleared)
      const players = db.prepare('SELECT COUNT(*) as count FROM players').get() as {
        count: number;
      };
      expect(players.count).toBe(1);
    });

    it('should enforce foreign key constraints on contestants_row', () => {
      const db = getDatabase();

      // Attempting to add a contestant with non-existent player should fail
      expect(() => {
        db.prepare(
          `INSERT INTO contestants_row (player_id, position, game_segment, status)
           VALUES (9999, 2, 'section_1', 'active')`,
        ).run();
      }).toThrow(/FOREIGN KEY constraint failed/i);

      // Verify no contestant was added
      const count = db.prepare('SELECT COUNT(*) as count FROM contestants_row').get() as {
        count: number;
      };
      expect(count.count).toBe(1); // Only the one from beforeEach
    });
  });
});
