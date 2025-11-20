import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDatabase, cleanupTestDatabase } from "../db/test-helper.js";
import { getDatabase } from "../db/connection.js";
import { checkForInProgressGame, resumeGame } from "./game-resume.js";
import { updateGameWorkflow } from "../db/game-workflow.js";
import { addContestantToRow } from "../db/contestants.js";
import { createPlayer } from "../db/players.js";
import { startNewGame } from "./game-state.js";

describe("Game Resume Service", () => {
  beforeEach(() => {
    setupTestDatabase();
  });

  afterEach(() => {
    cleanupTestDatabase();
  });

  describe("checkForInProgressGame", () => {
    it("should return false for not_started state", () => {
      startNewGame();
      const inProgress = checkForInProgressGame();

      expect(inProgress).toBe(false);
    });

    it("should return true for contestant_selection state", () => {
      updateGameWorkflow({ phase_type: "contestant_selection" });
      const inProgress = checkForInProgressGame();

      expect(inProgress).toBe(true);
    });

    it("should return true for bidding state", () => {
      updateGameWorkflow({ phase_type: "bidding" });
      const inProgress = checkForInProgressGame();

      expect(inProgress).toBe(true);
    });

    it("should return true for mini_game state", () => {
      updateGameWorkflow({ phase_type: "mini_game" });
      const inProgress = checkForInProgressGame();

      expect(inProgress).toBe(true);
    });

    it("should return true for wheel state", () => {
      updateGameWorkflow({ phase_type: "wheel" });
      const inProgress = checkForInProgressGame();

      expect(inProgress).toBe(true);
    });

    it("should return true for showcase state", () => {
      updateGameWorkflow({ phase_type: "showcase" });
      const inProgress = checkForInProgressGame();

      expect(inProgress).toBe(true);
    });
  });

  describe("resumeGame", () => {
    it("should return complete game state", () => {
      const state = resumeGame();

      expect(state.workflow).toBeDefined();
      expect(state.section1Contestants).toBeInstanceOf(Array);
      expect(state.section2Contestants).toBeInstanceOf(Array);
    });

    it("should return workflow with current phase", () => {
      updateGameWorkflow({
        phase_type: "bidding",
        current_segment: "section_1",
        current_segment_index: 2,
      });

      const state = resumeGame();

      expect(state.workflow.phase_type).toBe("bidding");
      expect(state.workflow.current_segment).toBe("section_1");
      expect(state.workflow.current_segment_index).toBe(2);
    });

    it("should return contestants for section_1", () => {
      const db = getDatabase();

      // Create contestants in section 1
      for (let i = 1; i <= 3; i++) {
        const player = createPlayer(db, {
          firstName: "Section1",
          lastName: `Player${i}`,
          accessCode: `S1P0${i}`,
          role: "player",
          photoFilename: "default.jpg",
        });

        addContestantToRow(player.id, i, "section_1", "active");
      }

      const state = resumeGame();

      expect(state.section1Contestants.length).toBe(3);
      expect(state.section1Contestants[0].game_segment).toBe("section_1");
    });

    it("should return contestants for section_2", () => {
      const db = getDatabase();

      // Create contestants in section 2
      for (let i = 1; i <= 2; i++) {
        const player = createPlayer(db, {
          firstName: "Section2",
          lastName: `Player${i}`,
          accessCode: `S2P0${i}`,
          role: "player",
          photoFilename: "default.jpg",
        });

        addContestantToRow(player.id, i, "section_2", "active");
      }

      const state = resumeGame();

      expect(state.section2Contestants.length).toBe(2);
      expect(state.section2Contestants[0].game_segment).toBe("section_2");
    });

    it("should return only active contestants (not replaced ones)", () => {
      const db = getDatabase();

      // Create active contestant
      const activePlayer = createPlayer(db, {
        firstName: "Active",
        lastName: "Player",
        accessCode: "ACTIVE",
        role: "player",
        photoFilename: "default.jpg",
      });

      addContestantToRow(activePlayer.id, 1, "section_1", "active");

      // Create replaced contestant
      const replacedPlayer = createPlayer(db, {
        firstName: "Replaced",
        lastName: "Player",
        accessCode: "REPLACED",
        role: "audience",
        photoFilename: "default.jpg",
      });

      addContestantToRow(replacedPlayer.id, 2, "section_1", "replaced");

      const state = resumeGame();

      expect(state.section1Contestants.length).toBe(1);
      expect(state.section1Contestants[0].status).toBe("active");
    });

    it("should return pending_reveal contestants", () => {
      const db = getDatabase();

      const player = createPlayer(db, {
        firstName: "Pending",
        lastName: "Reveal",
        accessCode: "PEND01",
        role: "audience",
        photoFilename: "default.jpg",
      });

      addContestantToRow(player.id, 1, "section_1", "pending_reveal");

      const state = resumeGame();

      expect(state.section1Contestants.length).toBe(1);
      expect(state.section1Contestants[0].status).toBe("pending_reveal");
    });

    it("should handle mid-game state with contestants in both sections", () => {
      const db = getDatabase();

      // Section 1 contestants (completed)
      for (let i = 1; i <= 5; i++) {
        const player = createPlayer(db, {
          firstName: "S1",
          lastName: `Player${i}`,
          accessCode: `S1${i}`,
          role: "player",
          photoFilename: "default.jpg",
        });

        addContestantToRow(player.id, i, "section_1", "active");
      }

      // Section 2 contestants (in progress)
      for (let i = 1; i <= 3; i++) {
        const player = createPlayer(db, {
          firstName: "S2",
          lastName: `Player${i}`,
          accessCode: `S2${i}`,
          role: "player",
          photoFilename: "default.jpg",
        });

        addContestantToRow(player.id, i, "section_2", "active");
      }

      updateGameWorkflow({
        current_segment: "section_2",
        phase_type: "contestant_selection",
      });

      const state = resumeGame();

      expect(state.section1Contestants.length).toBe(5);
      expect(state.section2Contestants.length).toBe(3);
      expect(state.workflow.current_segment).toBe("section_2");
      expect(state.workflow.phase_type).toBe("contestant_selection");
    });

    it("should verify complete workflow structure on resume", () => {
      updateGameWorkflow({
        current_segment: "section_1",
        current_segment_index: 2,
        phase_type: "bidding",
        phase_metadata: '{"product_id": "test123"}',
      });

      const state = resumeGame();

      // Verify ALL workflow fields, not just existence
      expect(state.workflow.id).toBe(1);
      expect(state.workflow.current_segment).toBe("section_1");
      expect(state.workflow.current_segment_index).toBe(2);
      expect(state.workflow.phase_type).toBe("bidding");
      expect(state.workflow.phase_metadata).toBe('{"product_id": "test123"}');
      expect(state.workflow.created_at).toMatch(
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      );
      expect(state.workflow.updated_at).toMatch(
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      );
    });

    it("should return contestants in position order", () => {
      const db = getDatabase();

      // Create contestants out of order
      const p3 = createPlayer(db, {
        firstName: "Position",
        lastName: "3",
        accessCode: "P3",
        role: "player",
        photoFilename: "default.jpg",
      });

      const p1 = createPlayer(db, {
        firstName: "Position",
        lastName: "1",
        accessCode: "P1",
        role: "player",
        photoFilename: "default.jpg",
      });

      const p2 = createPlayer(db, {
        firstName: "Position",
        lastName: "2",
        accessCode: "P2",
        role: "player",
        photoFilename: "default.jpg",
      });

      addContestantToRow(p3.id, 3, "section_1", "active");
      addContestantToRow(p1.id, 1, "section_1", "active");
      addContestantToRow(p2.id, 2, "section_1", "active");

      const state = resumeGame();

      // Verify returned in position order (1, 2, 3)
      expect(state.section1Contestants[0].position).toBe(1);
      expect(state.section1Contestants[1].position).toBe(2);
      expect(state.section1Contestants[2].position).toBe(3);
    });

    it("should handle empty sections gracefully", () => {
      const state = resumeGame();

      expect(state.section1Contestants).toEqual([]);
      expect(state.section2Contestants).toEqual([]);
      expect(state.workflow).toBeDefined();
    });

    it("should exclude won status contestants", () => {
      const db = getDatabase();

      const p1 = createPlayer(db, {
        firstName: "Active",
        lastName: "Player",
        accessCode: "ACT",
        role: "player",
        photoFilename: "default.jpg",
      });

      const p2 = createPlayer(db, {
        firstName: "Won",
        lastName: "Player",
        accessCode: "WON",
        role: "player",
        photoFilename: "default.jpg",
      });

      addContestantToRow(p1.id, 1, "section_1", "active");
      addContestantToRow(p2.id, 2, "section_1", "won");

      const state = resumeGame();

      // Should only return active, not won - WAIT this is wrong!
      // getActiveContestants filters for 'active' OR 'pending_reveal'
      // So 'won' should already be excluded. Let me verify...
      // Actually looking at contestants.ts line 90, it uses IN ('active', 'pending_reveal')
      // So 'won' is excluded, this test will pass
      expect(state.section1Contestants.length).toBe(1);
      expect(state.section1Contestants[0].status).toBe("active");
    });

    it("should verify complete contestant structure", () => {
      const db = getDatabase();

      const player = createPlayer(db, {
        firstName: "Complete",
        lastName: "Test",
        accessCode: "COMPLETE",
        role: "player",
        photoFilename: "test.jpg",
      });

      addContestantToRow(player.id, 1, "section_1", "active");

      const state = resumeGame();
      const contestant = state.section1Contestants[0];

      // Verify ALL contestant fields
      expect(contestant.id).toBeDefined();
      expect(contestant.player_id).toBe(player.id);
      expect(contestant.position).toBe(1);
      expect(contestant.game_segment).toBe("section_1");
      expect(contestant.status).toBe("active");
      expect(contestant.added_at).toMatch(
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      );
      expect(contestant.revealed_at).toBeNull(); // Not revealed yet
      expect(contestant.created_at).toMatch(
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      );
      expect(contestant.updated_at).toMatch(
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
      );

      // Verify joined player fields
      expect(contestant.first_name).toBe("Complete");
      expect(contestant.last_name).toBe("Test");
      expect(contestant.photo_filename).toBe("test.jpg");
    });

    it("should handle non-sequential positions correctly", () => {
      const db = getDatabase();

      // Create contestants at positions 1, 3, 5 (skipping 2, 4)
      const p1 = createPlayer(db, {
        firstName: "P",
        lastName: "1",
        accessCode: "P1",
        role: "player",
        photoFilename: "default.jpg",
      });

      const p3 = createPlayer(db, {
        firstName: "P",
        lastName: "3",
        accessCode: "P3",
        role: "player",
        photoFilename: "default.jpg",
      });

      const p5 = createPlayer(db, {
        firstName: "P",
        lastName: "5",
        accessCode: "P5",
        role: "player",
        photoFilename: "default.jpg",
      });

      addContestantToRow(p1.id, 1, "section_1", "active");
      addContestantToRow(p3.id, 3, "section_1", "active");
      addContestantToRow(p5.id, 5, "section_1", "active");

      const state = resumeGame();

      expect(state.section1Contestants.length).toBe(3);
      expect(state.section1Contestants[0].position).toBe(1);
      expect(state.section1Contestants[1].position).toBe(3);
      expect(state.section1Contestants[2].position).toBe(5);
    });

    it("should resume from showcase phase with metadata", () => {
      updateGameWorkflow({
        phase_type: "showcase",
        current_segment: "finale",
        phase_metadata: '{"showcase_products": ["prod1", "prod2"]}',
      });

      const state = resumeGame();

      expect(state.workflow.phase_type).toBe("showcase");
      expect(state.workflow.current_segment).toBe("finale");
      expect(state.workflow.phase_metadata).toBe(
        '{"showcase_products": ["prod1", "prod2"]}',
      );
    });
  });
});
