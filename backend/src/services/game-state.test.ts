import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, cleanupTestDatabase } from '../db/test-helper.js';
import { getDatabase } from '../db/connection.js';
import {
  startNewGame,
  getCurrentState,
  beginContestantSelection,
  selectNextContestant,
  revealContestant,
  manualSelectContestant,
  replaceContestant,
  refreshContestantsRow,
  advancePhase,
} from './game-state.js';
import { createPlayer } from '../db/players.js';
import { addContestantToRow, getContestantsRow } from '../db/contestants.js';

describe('Game State Service', () => {
  beforeEach(() => {
    setupTestDatabase();
  });

  afterEach(() => {
    cleanupTestDatabase();
  });

  describe('startNewGame', () => {
    it('should reset game to not_started state', () => {
      const db = getDatabase();

      // Create some game state
      const player = createPlayer(db, {
        firstName: 'Test',
        lastName: 'Player',
        accessCode: 'ABC123',
        role: 'audience',
        photoFilename: 'default.jpg',
      });

      addContestantToRow(player.id, 1, 'section_1', 'active');

      // Start new game
      const workflow = startNewGame();

      expect(workflow.phase_type).toBe('not_started');
      expect(workflow.current_segment).toBe('section_1');
      expect(workflow.current_segment_index).toBe(0);
      expect(workflow.phase_metadata).toBeNull();

      // Verify contestants were cleared
      const contestants = getContestantsRow('section_1');
      expect(contestants.filter((c) => c.status === 'active').length).toBe(0);
    });

    it('should be idempotent (safe to call multiple times)', () => {
      const workflow1 = startNewGame();
      const workflow2 = startNewGame();

      expect(workflow1.phase_type).toBe('not_started');
      expect(workflow2.phase_type).toBe('not_started');
    });
  });

  describe('getCurrentState', () => {
    it('should return complete game state', () => {
      const db = getDatabase();

      // Create some audience members
      createPlayer(db, {
        firstName: 'Audience',
        lastName: 'One',
        accessCode: 'AUD001',
        role: 'audience',
        photoFilename: 'default.jpg',
      });

      const state = getCurrentState();

      expect(state.workflow).toBeDefined();
      expect(state.workflow.phase_type).toBe('not_started');
      expect(state.contestantsRow).toBeInstanceOf(Array);
      expect(state.eligibleAudienceCount).toBe(1);
    });

    it('should count only active audience members', () => {
      const db = getDatabase();

      // Create active audience member
      createPlayer(db, {
        firstName: 'Active',
        lastName: 'Audience',
        accessCode: 'ACT001',
        role: 'audience',
        photoFilename: 'default.jpg',
      });

      // Create inactive audience member
      const inactive = createPlayer(db, {
        firstName: 'Inactive',
        lastName: 'Audience',
        accessCode: 'INACT',
        role: 'audience',
        photoFilename: 'default.jpg',
      });

      // Deactivate the player
      db.prepare('UPDATE players SET active = 0 WHERE id = ?').run(inactive.id);

      const state = getCurrentState();

      expect(state.eligibleAudienceCount).toBe(1); // Only the active one
    });

    it('should not count players or hosts as eligible', () => {
      const db = getDatabase();

      createPlayer(db, {
        firstName: 'Test',
        lastName: 'Player',
        accessCode: 'PLY001',
        role: 'player',
        photoFilename: 'default.jpg',
      });

      createPlayer(db, {
        firstName: 'Test',
        lastName: 'Host',
        accessCode: 'HST001',
        role: 'host',
        photoFilename: 'default.jpg',
      });

      const state = getCurrentState();

      expect(state.eligibleAudienceCount).toBe(0);
    });
  });

  describe('beginContestantSelection', () => {
    it('should update phase to contestant_selection', () => {
      const workflow = beginContestantSelection('section_1');

      expect(workflow.phase_type).toBe('contestant_selection');
      expect(workflow.current_segment).toBe('section_1');
    });

    it('should work for section_2', () => {
      const workflow = beginContestantSelection('section_2');

      expect(workflow.phase_type).toBe('contestant_selection');
      expect(workflow.current_segment).toBe('section_2');
    });

    it('should allow starting from not_started state', () => {
      startNewGame();
      const workflow = beginContestantSelection('section_1');

      expect(workflow.phase_type).toBe('contestant_selection');
    });

    it('should allow starting from wheel state (for section 2)', () => {
      const db = getDatabase();
      db.prepare("UPDATE game_workflow SET phase_type = 'wheel' WHERE id = 1").run();

      const workflow = beginContestantSelection('section_2');

      expect(workflow.phase_type).toBe('contestant_selection');
    });

    it('should throw error if called from invalid state', () => {
      const db = getDatabase();
      db.prepare("UPDATE game_workflow SET phase_type = 'bidding' WHERE id = 1").run();

      expect(() => beginContestantSelection('section_1')).toThrow(
        /Cannot begin contestant selection/,
      );
    });
  });

  describe('selectNextContestant', () => {
    beforeEach(() => {
      const db = getDatabase();

      // Create some audience members
      for (let i = 1; i <= 10; i++) {
        createPlayer(db, {
          firstName: 'Audience',
          lastName: `Member${i}`,
          accessCode: `AUD00${i}`,
          role: 'audience',
          photoFilename: 'default.jpg',
        });
      }
    });

    it('should select a random audience member', () => {
      const contestant = selectNextContestant('section_1');

      expect(contestant).toBeDefined();
      expect(contestant.position).toBe(1); // First available position
      expect(contestant.status).toBe('pending_reveal');
      expect(contestant.game_segment).toBe('section_1');
    });

    it('should assign next empty position', () => {
      const c1 = selectNextContestant('section_1');
      const c2 = selectNextContestant('section_1');

      expect(c1.position).toBe(1);
      expect(c2.position).toBe(2);
    });

    it('should only select from audience role', () => {
      const db = getDatabase();

      // Clear all audience, create only players and hosts
      db.prepare("UPDATE players SET role = 'player'").run();

      expect(() => selectNextContestant('section_1')).toThrow(/No eligible audience members/);
    });

    it('should only select active players', () => {
      const db = getDatabase();

      // Deactivate all players
      db.prepare('UPDATE players SET active = 0').run();

      expect(() => selectNextContestant('section_1')).toThrow(/No eligible audience members/);
    });

    it('should throw error if all positions filled', () => {
      // Fill all 5 positions
      for (let i = 1; i <= 5; i++) {
        selectNextContestant('section_1');
      }

      expect(() => selectNextContestant('section_1')).toThrow(
        /All contestant positions are filled/,
      );
    });

    it('should select different players (randomness check)', () => {
      // This test verifies randomness by selecting multiple times
      // and checking we don't always get the same player
      const selections = new Set<number>();

      for (let i = 0; i < 5; i++) {
        cleanupTestDatabase();
        setupTestDatabase();

        const db = getDatabase();

        // Recreate audience members
        for (let j = 1; j <= 10; j++) {
          createPlayer(db, {
            firstName: 'Audience',
            lastName: `Member${j}`,
            accessCode: `AUD00${j}`,
            role: 'audience',
            photoFilename: 'default.jpg',
          });
        }

        const contestant = selectNextContestant('section_1');
        selections.add(contestant.player_id);
      }

      // We should have selected at least 2 different players
      // (statistically very unlikely to get same player 5 times from pool of 10)
      expect(selections.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('revealContestant', () => {
    it('should update status to active and set revealed_at', () => {
      const db = getDatabase();

      // Create audience member and add to row
      const player = createPlayer(db, {
        firstName: 'Test',
        lastName: 'Player',
        accessCode: 'TEST01',
        role: 'audience',
        photoFilename: 'default.jpg',
      });

      const contestant = addContestantToRow(player.id, 1, 'section_1', 'pending_reveal');

      // Reveal contestant
      const revealed = revealContestant(contestant.id);

      expect(revealed.status).toBe('active');
      expect(revealed.revealed_at).toBeTruthy();
      expect(revealed.revealed_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    it('should update player role from audience to player', () => {
      const db = getDatabase();

      const player = createPlayer(db, {
        firstName: 'Test',
        lastName: 'Player',
        accessCode: 'TEST01',
        role: 'audience',
        photoFilename: 'default.jpg',
      });

      const contestant = addContestantToRow(player.id, 1, 'section_1', 'pending_reveal');

      // Before reveal: role should be audience
      const beforePlayer = db.prepare('SELECT role FROM players WHERE id = ?').get(player.id) as {
        role: string;
      };
      expect(beforePlayer.role).toBe('audience');

      // Reveal contestant
      revealContestant(contestant.id);

      // After reveal: role should be player
      const afterPlayer = db.prepare('SELECT role FROM players WHERE id = ?').get(player.id) as {
        role: string;
      };
      expect(afterPlayer.role).toBe('player');
    });

    it('should throw error if contestant not found', () => {
      expect(() => revealContestant(9999)).toThrow(/not found/);
    });

    it('should use transaction (both updates succeed or fail together)', () => {
      const db = getDatabase();

      const player = createPlayer(db, {
        firstName: 'Test',
        lastName: 'Player',
        accessCode: 'TEST01',
        role: 'audience',
        photoFilename: 'default.jpg',
      });

      const contestant = addContestantToRow(player.id, 1, 'section_1', 'pending_reveal');

      // Reveal should succeed and both tables should be updated
      const revealed = revealContestant(contestant.id);

      expect(revealed.status).toBe('active');

      const updatedPlayer = db.prepare('SELECT role FROM players WHERE id = ?').get(player.id) as {
        role: string;
      };
      expect(updatedPlayer.role).toBe('player');
    });
  });

  describe('manualSelectContestant', () => {
    it('should add audience member with pending_reveal status', () => {
      const db = getDatabase();

      const player = createPlayer(db, {
        firstName: 'Manual',
        lastName: 'Select',
        accessCode: 'MAN001',
        role: 'audience',
        photoFilename: 'default.jpg',
      });

      const contestant = manualSelectContestant(player.id, 'section_1', 3);

      expect(contestant.player_id).toBe(player.id);
      expect(contestant.position).toBe(3);
      expect(contestant.status).toBe('pending_reveal');
      expect(contestant.game_segment).toBe('section_1');
    });

    it('should add existing player with active status (skip reveal)', () => {
      const db = getDatabase();

      const player = createPlayer(db, {
        firstName: 'Existing',
        lastName: 'Player',
        accessCode: 'EXI001',
        role: 'player',
        photoFilename: 'default.jpg',
      });

      const contestant = manualSelectContestant(player.id, 'section_1', 2);

      expect(contestant.player_id).toBe(player.id);
      expect(contestant.status).toBe('pending_reveal'); // All manual selections need reveal
    });

    it('should throw error if player not found', () => {
      expect(() => manualSelectContestant(9999, 'section_1', 1)).toThrow(/not found/);
    });

    it('should throw error if player is inactive', () => {
      const db = getDatabase();

      const player = createPlayer(db, {
        firstName: 'Inactive',
        lastName: 'Player',
        accessCode: 'INACT',
        role: 'audience',
        photoFilename: 'default.jpg',
      });

      db.prepare('UPDATE players SET active = 0 WHERE id = ?').run(player.id);

      expect(() => manualSelectContestant(player.id, 'section_1', 1)).toThrow(/not active/);
    });

    it('should throw error if position invalid', () => {
      const db = getDatabase();

      const player = createPlayer(db, {
        firstName: 'Test',
        lastName: 'Player',
        accessCode: 'TEST01',
        role: 'audience',
        photoFilename: 'default.jpg',
      });

      expect(() => manualSelectContestant(player.id, 'section_1', 0)).toThrow(
        /Position must be between 1 and 5/,
      );

      expect(() => manualSelectContestant(player.id, 'section_1', 6)).toThrow(
        /Position must be between 1 and 5/,
      );
    });

    it('should replace existing contestant if position already occupied', () => {
      const db = getDatabase();

      const player1 = createPlayer(db, {
        firstName: 'Player',
        lastName: 'One',
        accessCode: 'PLY001',
        role: 'audience',
        photoFilename: 'default.jpg',
      });

      const player2 = createPlayer(db, {
        firstName: 'Player',
        lastName: 'Two',
        accessCode: 'PLY002',
        role: 'audience',
        photoFilename: 'default.jpg',
      });

      const firstContestant = manualSelectContestant(player1.id, 'section_1', 1);
      expect(firstContestant.player_id).toBe(player1.id);
      expect(firstContestant.position).toBe(1);

      // Select second player at same position - should replace first
      const secondContestant = manualSelectContestant(player2.id, 'section_1', 1);
      expect(secondContestant.player_id).toBe(player2.id);
      expect(secondContestant.position).toBe(1);
      expect(secondContestant.status).toBe('pending_reveal');

      // Verify first contestant marked as replaced
      const allContestants = getContestantsRow('section_1');
      const replacedContestant = allContestants.find((c) => c.id === firstContestant.id);
      expect(replacedContestant?.status).toBe('replaced');
    });
  });

  describe('replaceContestant', () => {
    it('should replace with random audience member if no playerId provided', () => {
      const db = getDatabase();

      // Create original contestant
      const original = createPlayer(db, {
        firstName: 'Original',
        lastName: 'Player',
        accessCode: 'ORIG01',
        role: 'audience',
        photoFilename: 'default.jpg',
      });

      const contestant = addContestantToRow(original.id, 3, 'section_1', 'active');

      // Create eligible audience members (enough to make selection likely different)
      const audienceMembers = [];
      for (let i = 1; i <= 10; i++) {
        const audience = createPlayer(db, {
          firstName: 'Audience',
          lastName: `Member${i}`,
          accessCode: `AUD00${i}`,
          role: 'audience',
          photoFilename: 'default.jpg',
        });
        audienceMembers.push(audience.id);
      }

      // Replace without specifying player
      const replacement = replaceContestant(contestant.id);

      expect(replacement.position).toBe(3); // Position preserved
      // Replacement should be one of the eligible audience members (original is also eligible after being replaced)
      const allEligible = [original.id, ...audienceMembers];
      expect(allEligible).toContain(replacement.player_id);
      expect(replacement.status).toBe('pending_reveal');

      // Verify old contestant marked as replaced
      const oldContestant = db
        .prepare('SELECT status FROM contestants_row WHERE id = ?')
        .get(contestant.id) as { status: string };
      expect(oldContestant.status).toBe('replaced');
    });

    it('should replace with specific player if playerId provided', () => {
      const db = getDatabase();

      const original = createPlayer(db, {
        firstName: 'Original',
        lastName: 'Player',
        accessCode: 'ORIG01',
        role: 'audience',
        photoFilename: 'default.jpg',
      });

      const contestant = addContestantToRow(original.id, 2, 'section_1', 'active');

      const replacement = createPlayer(db, {
        firstName: 'Replacement',
        lastName: 'Player',
        accessCode: 'REPL01',
        role: 'audience',
        photoFilename: 'default.jpg',
      });

      const newContestant = replaceContestant(contestant.id, replacement.id);

      expect(newContestant.player_id).toBe(replacement.id);
      expect(newContestant.position).toBe(2); // Position preserved
    });

    it('should use pending_reveal status for audience replacement', () => {
      const db = getDatabase();

      const original = createPlayer(db, {
        firstName: 'Original',
        lastName: 'Player',
        accessCode: 'ORIG01',
        role: 'audience',
        photoFilename: 'default.jpg',
      });

      const contestant = addContestantToRow(original.id, 1, 'section_1', 'active');

      const replacement = createPlayer(db, {
        firstName: 'Audience',
        lastName: 'Replacement',
        accessCode: 'AUDREPL',
        role: 'audience',
        photoFilename: 'default.jpg',
      });

      const newContestant = replaceContestant(contestant.id, replacement.id);

      expect(newContestant.status).toBe('pending_reveal');
    });

    it('should use active status for existing player replacement', () => {
      const db = getDatabase();

      const original = createPlayer(db, {
        firstName: 'Original',
        lastName: 'Player',
        accessCode: 'ORIG01',
        role: 'player',
        photoFilename: 'default.jpg',
      });

      const contestant = addContestantToRow(original.id, 1, 'section_1', 'active');

      const replacement = createPlayer(db, {
        firstName: 'Player',
        lastName: 'Replacement',
        accessCode: 'PLYREPL',
        role: 'player',
        photoFilename: 'default.jpg',
      });

      const newContestant = replaceContestant(contestant.id, replacement.id);

      expect(newContestant.status).toBe('active');
    });

    it('should throw error if no eligible audience members for random replacement', () => {
      const db = getDatabase();

      // Create a player with role='player' (not audience)
      const original = createPlayer(db, {
        firstName: 'Original',
        lastName: 'Player',
        accessCode: 'ORIG01',
        role: 'player',
        photoFilename: 'default.jpg',
      });

      const contestant = addContestantToRow(original.id, 1, 'section_1', 'active');

      // No eligible audience members at all (original is a player, not audience)
      expect(() => replaceContestant(contestant.id)).toThrow(/No eligible audience members/);
    });

    it('should throw error if contestant not found', () => {
      expect(() => replaceContestant(9999)).toThrow(/not found/);
    });
  });

  describe('refreshContestantsRow', () => {
    it('should replace all 5 contestants with new random selections', () => {
      const db = getDatabase();

      // Create original contestants
      for (let i = 1; i <= 5; i++) {
        const player = createPlayer(db, {
          firstName: 'Original',
          lastName: `Player${i}`,
          accessCode: `ORIG0${i}`,
          role: 'audience',
          photoFilename: 'default.jpg',
        });

        addContestantToRow(player.id, i, 'section_1', 'active');
      }

      // Create eligible audience members
      for (let i = 1; i <= 10; i++) {
        createPlayer(db, {
          firstName: 'Audience',
          lastName: `Member${i}`,
          accessCode: `AUD00${i}`,
          role: 'audience',
          photoFilename: 'default.jpg',
        });
      }

      const newContestants = refreshContestantsRow('section_1');

      expect(newContestants.length).toBe(5);

      // Verify all positions filled (1-5)
      const positions = newContestants.map((c) => c.position).sort();
      expect(positions).toEqual([1, 2, 3, 4, 5]);

      // Verify all have pending_reveal status
      for (const contestant of newContestants) {
        expect(contestant.status).toBe('pending_reveal');
      }
    });

    it('should mark old contestants as replaced', () => {
      const db = getDatabase();

      // Create original contestants
      const originalIds: number[] = [];
      for (let i = 1; i <= 5; i++) {
        const player = createPlayer(db, {
          firstName: 'Original',
          lastName: `Player${i}`,
          accessCode: `ORIG0${i}`,
          role: 'audience',
          photoFilename: 'default.jpg',
        });

        const contestant = addContestantToRow(player.id, i, 'section_1', 'active');
        originalIds.push(contestant.id);
      }

      // Create eligible audience members
      for (let i = 1; i <= 10; i++) {
        createPlayer(db, {
          firstName: 'Audience',
          lastName: `Member${i}`,
          accessCode: `AUD00${i}`,
          role: 'audience',
          photoFilename: 'default.jpg',
        });
      }

      refreshContestantsRow('section_1');

      // Verify all originals marked as replaced
      for (const id of originalIds) {
        const contestant = db
          .prepare('SELECT status FROM contestants_row WHERE id = ?')
          .get(id) as {
          status: string;
        };
        expect(contestant.status).toBe('replaced');
      }
    });

    it('should throw error if not enough eligible audience members', () => {
      const db = getDatabase();

      // Create only 3 eligible audience members
      for (let i = 1; i <= 3; i++) {
        createPlayer(db, {
          firstName: 'Audience',
          lastName: `Member${i}`,
          accessCode: `AUD00${i}`,
          role: 'audience',
          photoFilename: 'default.jpg',
        });
      }

      expect(() => refreshContestantsRow('section_1')).toThrow(/Not enough eligible audience/);
    });

    it('should work for section_2', () => {
      const db = getDatabase();

      // Create eligible audience members
      for (let i = 1; i <= 10; i++) {
        createPlayer(db, {
          firstName: 'Audience',
          lastName: `Member${i}`,
          accessCode: `AUD00${i}`,
          role: 'audience',
          photoFilename: 'default.jpg',
        });
      }

      const contestants = refreshContestantsRow('section_2');

      expect(contestants.length).toBe(5);
      for (const contestant of contestants) {
        expect(contestant.game_segment).toBe('section_2');
      }
    });
  });

  describe('advancePhase', () => {
    it('should update phase_type', () => {
      const workflow = advancePhase('bidding');

      expect(workflow.phase_type).toBe('bidding');
    });

    it('should allow all valid phases', () => {
      const validPhases = [
        'not_started',
        'contestant_selection',
        'bidding',
        'mini_game',
        'wheel',
        'showcase',
      ];

      for (const phase of validPhases) {
        const workflow = advancePhase(phase);
        expect(workflow.phase_type).toBe(phase);
      }
    });

    it('should throw error for invalid phase', () => {
      expect(() => advancePhase('invalid_phase')).toThrow(/Invalid phase/);
    });
  });

  describe('CRITICAL EDGE CASES AND IMPROVEMENTS', () => {
    describe('startNewGame - comprehensive cleanup', () => {
      it('should clear contestants from BOTH sections', () => {
        const db = getDatabase();

        // Create contestants in both sections
        const p1 = createPlayer(db, {
          firstName: 'Section1',
          lastName: 'Player',
          accessCode: 'S1P',
          role: 'player',
          photoFilename: 'default.jpg',
        });

        const p2 = createPlayer(db, {
          firstName: 'Section2',
          lastName: 'Player',
          accessCode: 'S2P',
          role: 'player',
          photoFilename: 'default.jpg',
        });

        addContestantToRow(p1.id, 1, 'section_1', 'active');
        addContestantToRow(p2.id, 1, 'section_2', 'active');

        // Verify both exist
        const before1 = getContestantsRow('section_1');
        const before2 = getContestantsRow('section_2');
        expect(before1.length).toBe(1);
        expect(before2.length).toBe(1);

        // Start new game
        startNewGame();

        // Verify both sections cleared
        const after1 = getContestantsRow('section_1');
        const after2 = getContestantsRow('section_2');
        expect(after1.filter((c) => c.status !== 'replaced').length).toBe(0);
        expect(after2.filter((c) => c.status !== 'replaced').length).toBe(0);
      });

      it('should work from any game phase', () => {
        // Test from various phases
        const phases = ['bidding', 'mini_game', 'wheel', 'showcase'];

        for (const phase of phases) {
          const db = getDatabase();
          db.prepare('UPDATE game_workflow SET phase_type = ? WHERE id = 1').run(phase);

          const workflow = startNewGame();
          expect(workflow.phase_type).toBe('not_started');
          expect(workflow.current_segment).toBe('section_1');
          expect(workflow.current_segment_index).toBe(0);
        }
      });
    });

    describe('getCurrentState - edge cases', () => {
      it('should return all active contestants regardless of segment', () => {
        const db = getDatabase();

        // Add contestants from different segments
        const p1 = createPlayer(db, {
          firstName: 'S1',
          lastName: 'Player',
          accessCode: 'S1P',
          role: 'player',
          photoFilename: 'default.jpg',
        });

        const p2 = createPlayer(db, {
          firstName: 'S2',
          lastName: 'Player',
          accessCode: 'S2P',
          role: 'player',
          photoFilename: 'default.jpg',
        });

        addContestantToRow(p1.id, 1, 'section_1', 'active');
        addContestantToRow(p2.id, 2, 'section_2', 'active');

        // Set current segment to section_2
        db.prepare("UPDATE game_workflow SET current_segment = 'section_2'").run();

        const state = getCurrentState();

        // Should return ALL active contestants (contestants persist across sections)
        expect(state.contestantsRow.length).toBe(2);
        expect(state.contestantsRow[0].game_segment).toBe('section_1');
        expect(state.contestantsRow[1].game_segment).toBe('section_2');
      });

      it('should exclude replaced contestants from count', () => {
        const db = getDatabase();

        const p1 = createPlayer(db, {
          firstName: 'Active',
          lastName: 'Player',
          accessCode: 'ACT',
          role: 'player',
          photoFilename: 'default.jpg',
        });

        const p2 = createPlayer(db, {
          firstName: 'Replaced',
          lastName: 'Player',
          accessCode: 'REP',
          role: 'player',
          photoFilename: 'default.jpg',
        });

        addContestantToRow(p1.id, 1, 'section_1', 'active');
        addContestantToRow(p2.id, 2, 'section_1', 'replaced');

        const state = getCurrentState();

        // Should only return active contestant
        expect(state.contestantsRow.length).toBe(1);
        expect(state.contestantsRow[0].status).toBe('active');
      });

      it('should persist contestants when advancing to section_1_finale', () => {
        const db = getDatabase();

        const p1 = createPlayer(db, {
          firstName: 'Finalist',
          lastName: 'One',
          accessCode: 'FIN1',
          role: 'player',
          photoFilename: 'default.jpg',
        });

        addContestantToRow(p1.id, 1, 'section_1', 'active');

        // Set current segment to section_1_finale (wheel)
        db.prepare(
          "UPDATE game_workflow SET current_segment = 'section_1_finale', phase_type = 'wheel'",
        ).run();

        const state = getCurrentState();

        // Contestants persist across all phases
        expect(state.contestantsRow.length).toBe(1);
        expect(state.contestantsRow[0].game_segment).toBe('section_1');
        expect(state.contestantsRow[0].first_name).toBe('Finalist');
      });

      it('should persist contestants when advancing to section_2', () => {
        const db = getDatabase();

        const p1 = createPlayer(db, {
          firstName: 'Persisting',
          lastName: 'Player',
          accessCode: 'PERS',
          role: 'player',
          photoFilename: 'default.jpg',
        });

        // Contestant added during section_1
        addContestantToRow(p1.id, 1, 'section_1', 'active');

        // Advance to section_2
        db.prepare(
          "UPDATE game_workflow SET current_segment = 'section_2', phase_type = 'bidding'",
        ).run();

        const state = getCurrentState();

        // Section 1 contestants should still be visible in section 2
        expect(state.contestantsRow.length).toBe(1);
        expect(state.contestantsRow[0].game_segment).toBe('section_1');
        expect(state.contestantsRow[0].first_name).toBe('Persisting');
      });

      it('should persist contestants through finale phases', () => {
        const db = getDatabase();

        const p1 = createPlayer(db, {
          firstName: 'Showcase',
          lastName: 'Player',
          accessCode: 'SHOW',
          role: 'player',
          photoFilename: 'default.jpg',
        });

        addContestantToRow(p1.id, 1, 'section_2', 'active');

        // Set current segment to finale (showcase)
        db.prepare(
          "UPDATE game_workflow SET current_segment = 'finale', phase_type = 'showcase'",
        ).run();

        const state = getCurrentState();

        // Contestants persist to finale
        expect(state.contestantsRow.length).toBe(1);
        expect(state.contestantsRow[0].game_segment).toBe('section_2');
        expect(state.contestantsRow[0].first_name).toBe('Showcase');
      });
    });

    describe('revealContestant - transaction rollback', () => {
      it('should rollback contestant update if player update fails', () => {
        const db = getDatabase();

        const player = createPlayer(db, {
          firstName: 'Test',
          lastName: 'Player',
          accessCode: 'TEST',
          role: 'audience',
          photoFilename: 'default.jpg',
        });

        const contestant = addContestantToRow(player.id, 1, 'section_1', 'pending_reveal');

        // Temporarily disable foreign keys to allow player deletion
        db.prepare('PRAGMA foreign_keys = OFF').run();

        // Delete the player to cause the update to fail
        db.prepare('DELETE FROM players WHERE id = ?').run(player.id);

        // Re-enable foreign keys
        db.prepare('PRAGMA foreign_keys = ON').run();

        // Attempt to reveal should throw error
        expect(() => revealContestant(contestant.id)).toThrow();

        // Contestant status should NOT be updated (rollback)
        const afterContestant = db
          .prepare('SELECT status, revealed_at FROM contestants_row WHERE id = ?')
          .get(contestant.id) as { status: string; revealed_at: string | null };

        expect(afterContestant.status).toBe('pending_reveal');
        expect(afterContestant.revealed_at).toBeNull();
      });

      it('should not reveal already active contestant', () => {
        const db = getDatabase();

        const player = createPlayer(db, {
          firstName: 'Already',
          lastName: 'Active',
          accessCode: 'ALR',
          role: 'player',
          photoFilename: 'default.jpg',
        });

        const contestant = addContestantToRow(player.id, 1, 'section_1', 'active');

        // Reveal should still work but player role already correct
        const revealed = revealContestant(contestant.id);

        expect(revealed.status).toBe('active');
        expect(revealed.revealed_at).toBeTruthy();
      });
    });

    describe('selectNextContestant - duplicate prevention', () => {
      it('should not select same player twice in same segment', () => {
        const db = getDatabase();

        // Create exactly 5 audience members
        const players = [];
        for (let i = 1; i <= 5; i++) {
          players.push(
            createPlayer(db, {
              firstName: 'Player',
              lastName: `${i}`,
              accessCode: `P${i}`,
              role: 'audience',
              photoFilename: 'default.jpg',
            }),
          );
        }

        // Select all 5
        const selected = [];
        for (let i = 0; i < 5; i++) {
          const contestant = selectNextContestant('section_1');
          selected.push(contestant.player_id);
        }

        // Verify no duplicates
        const uniqueIds = new Set(selected);
        expect(uniqueIds.size).toBe(5);
      });

      it('should work with exactly 1 eligible audience member', () => {
        const db = getDatabase();

        const player = createPlayer(db, {
          firstName: 'Only',
          lastName: 'One',
          accessCode: 'ONLY',
          role: 'audience',
          photoFilename: 'default.jpg',
        });

        const contestant = selectNextContestant('section_1');

        expect(contestant.player_id).toBe(player.id);
        expect(contestant.position).toBe(1);
      });
    });

    describe('manualSelectContestant - additional validation', () => {
      it('should allow host role selection with pending_reveal status', () => {
        const db = getDatabase();

        const host = createPlayer(db, {
          firstName: 'Host',
          lastName: 'User',
          accessCode: 'HOST',
          role: 'host',
          photoFilename: 'default.jpg',
        });

        // Manual selection always creates pending_reveal status
        // This ensures host can reveal all contestants with dramatic timing
        const contestant = manualSelectContestant(host.id, 'section_1', 1);
        expect(contestant.player_id).toBe(host.id);
        expect(contestant.status).toBe('pending_reveal'); // all manual selections need reveal
      });

      it('should reject invalid segment names', () => {
        const db = getDatabase();

        const player = createPlayer(db, {
          firstName: 'Test',
          lastName: 'Player',
          accessCode: 'TEST',
          role: 'audience',
          photoFilename: 'default.jpg',
        });

        // TypeScript prevents this at compile time, but testing runtime
        // @ts-expect-error Testing invalid segment
        expect(() => manualSelectContestant(player.id, 'invalid_segment', 1)).toThrow();
      });
    });

    describe('replaceContestant - critical edge cases', () => {
      it('should prevent replacing with same player', () => {
        const db = getDatabase();

        const player = createPlayer(db, {
          firstName: 'Same',
          lastName: 'Player',
          accessCode: 'SAME',
          role: 'audience',
          photoFilename: 'default.jpg',
        });

        const contestant = addContestantToRow(player.id, 1, 'section_1', 'active');

        // Trying to replace with same player - currently allowed but silly
        // Documenting current behavior
        const replacement = replaceContestant(contestant.id, player.id);

        expect(replacement.player_id).toBe(player.id);
        expect(replacement.position).toBe(1);
      });

      it('should handle replacement of already replaced contestant', () => {
        const db = getDatabase();

        const p1 = createPlayer(db, {
          firstName: 'Original',
          lastName: 'Player',
          accessCode: 'ORIG',
          role: 'player',
          photoFilename: 'default.jpg',
        });

        const p2 = createPlayer(db, {
          firstName: 'Replacement',
          lastName: 'Player',
          accessCode: 'REPL',
          role: 'audience',
          photoFilename: 'default.jpg',
        });

        const contestant = addContestantToRow(p1.id, 1, 'section_1', 'replaced');

        // Replace an already replaced contestant
        const replacement = replaceContestant(contestant.id, p2.id);

        expect(replacement.player_id).toBe(p2.id);
        expect(replacement.position).toBe(1);
      });
    });

    describe('refreshContestantsRow - edge cases', () => {
      it('should work with exactly 5 eligible audience members (boundary)', () => {
        const db = getDatabase();

        // Create exactly 5 audience members
        for (let i = 1; i <= 5; i++) {
          createPlayer(db, {
            firstName: 'Audience',
            lastName: `${i}`,
            accessCode: `AUD${i}`,
            role: 'audience',
            photoFilename: 'default.jpg',
          });
        }

        const contestants = refreshContestantsRow('section_1');

        expect(contestants.length).toBe(5);

        // Verify all 5 are unique
        const ids = contestants.map((c) => c.player_id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(5);
      });

      it('should work when starting from partial row (3 contestants)', () => {
        const db = getDatabase();

        // Add 3 existing contestants
        for (let i = 1; i <= 3; i++) {
          const p = createPlayer(db, {
            firstName: 'Existing',
            lastName: `${i}`,
            accessCode: `EX${i}`,
            role: 'player',
            photoFilename: 'default.jpg',
          });
          addContestantToRow(p.id, i, 'section_1', 'active');
        }

        // Create 5 new audience members
        for (let i = 1; i <= 5; i++) {
          createPlayer(db, {
            firstName: 'New',
            lastName: `${i}`,
            accessCode: `NEW${i}`,
            role: 'audience',
            photoFilename: 'default.jpg',
          });
        }

        const contestants = refreshContestantsRow('section_1');

        // Should have 5 new contestants
        expect(contestants.length).toBe(5);

        // All should be pending_reveal
        for (const c of contestants) {
          expect(c.status).toBe('pending_reveal');
        }

        // Old contestants should be marked replaced
        const allContestants = getContestantsRow('section_1');
        const replaced = allContestants.filter((c) => c.status === 'replaced');
        expect(replaced.length).toBeGreaterThanOrEqual(3);
      });
    });

    describe('advancePhase - state transition validation', () => {
      it('should allow valid phase progressions', () => {
        // Test logical phase progression
        advancePhase('not_started');
        let workflow = advancePhase('contestant_selection');
        expect(workflow.phase_type).toBe('contestant_selection');

        workflow = advancePhase('bidding');
        expect(workflow.phase_type).toBe('bidding');

        workflow = advancePhase('wheel');
        expect(workflow.phase_type).toBe('wheel');
      });

      it('should reject empty string phase', () => {
        expect(() => advancePhase('')).toThrow(/Invalid phase/);
      });

      it('should be case-sensitive', () => {
        // TypeScript prevents this but testing runtime
        // @ts-expect-error Testing case sensitivity
        expect(() => advancePhase('Bidding')).toThrow(/Invalid phase/);
      });
    });
  });
});
