import { getDatabase } from "../db/connection.js";
import {
  getGameWorkflow,
  resetGame,
  updateGameWorkflow,
  type GameWorkflow,
} from "../db/game-workflow.js";
import {
  addContestantToRow,
  getContestantsRow,
  getActiveContestants,
  revealContestant as dbRevealContestant,
  replaceContestant as dbReplaceContestant,
  clearContestantsRow,
  findNextEmptyPosition,
  getContestantById,
  updateContestantStatus,
  type ContestantWithPlayer,
} from "../db/contestants.js";
import { searchPlayers, getPlayerById, updatePlayer } from "../db/players.js";

export interface GameState {
  workflow: GameWorkflow;
  contestantsRow: ContestantWithPlayer[];
  eligibleAudienceCount: number;
}

/**
 * Start a new game
 * Clears all game state and resets workflow to 'not_started'
 */
export function startNewGame(): GameWorkflow {
  resetGame();
  return getGameWorkflow();
}

/**
 * Get current complete game state
 * Includes workflow, contestants for current segment, and eligible audience count
 */
export function getCurrentState(): GameState {
  const workflow = getGameWorkflow();
  const segment = workflow.current_segment as "section_1" | "section_2";

  // Only return active contestants (exclude replaced ones)
  const contestantsRow = getActiveContestants(segment);

  // Count eligible audience members
  const db = getDatabase();
  const eligibleResult = searchPlayers(db, {
    role: "audience",
    active: true,
  });

  return {
    workflow,
    contestantsRow,
    eligibleAudienceCount: eligibleResult.total,
  };
}

/**
 * Begin contestant selection phase for a segment
 * Updates phase_type to 'contestant_selection'
 */
export function beginContestantSelection(
  segment: "section_1" | "section_2",
): GameWorkflow {
  const workflow = getGameWorkflow();

  // Validate game is in correct state
  if (
    workflow.phase_type !== "not_started" &&
    workflow.phase_type !== "wheel"
  ) {
    throw new Error(
      `Cannot begin contestant selection from phase '${workflow.phase_type}'`,
    );
  }

  return updateGameWorkflow({
    current_segment: segment,
    phase_type: "contestant_selection",
    phase_metadata: null,
  });
}

/**
 * Select next random contestant from eligible audience members
 * Returns the selected contestant (in pending_reveal state)
 */
export function selectNextContestant(
  segment: "section_1" | "section_2",
): ContestantWithPlayer {
  const db = getDatabase();

  // Find next empty position
  const position = findNextEmptyPosition(segment);
  if (position === null) {
    throw new Error("All contestant positions are filled");
  }

  // Get eligible audience members (role='audience', active=true)
  const eligibleResult = searchPlayers(db, {
    role: "audience",
    active: true,
  });

  if (eligibleResult.total === 0) {
    throw new Error("No eligible audience members available");
  }

  // Filter out players already selected in this segment
  const activeContestants = getActiveContestants(segment);
  const alreadySelectedIds = new Set(activeContestants.map((c) => c.player_id));
  const availablePlayers = eligibleResult.players.filter(
    (p) => !alreadySelectedIds.has(p.id),
  );

  if (availablePlayers.length === 0) {
    throw new Error(
      "No eligible audience members available (all already selected)",
    );
  }

  // Pick a random player from available pool
  const randomIndex = Math.floor(Math.random() * availablePlayers.length);
  const selectedPlayer = availablePlayers[randomIndex];

  // Add to contestants_row with status='pending_reveal'
  const contestant = addContestantToRow(
    selectedPlayer.id,
    position,
    segment,
    "pending_reveal",
  );

  // Return contestant with player info
  const contestants = getContestantsRow(segment);
  const contestantWithPlayer = contestants.find((c) => c.id === contestant.id);

  if (!contestantWithPlayer) {
    throw new Error("Failed to retrieve contestant after creation");
  }

  return contestantWithPlayer;
}

/**
 * Reveal a contestant to the audience
 * Updates status to 'active', sets revealed_at timestamp, and changes player role to 'player'
 * This is a transaction that updates both contestants_row and players tables
 */
export function revealContestant(
  contestantRowId: number,
): ContestantWithPlayer {
  const db = getDatabase();

  // Get contestant to check it exists and get player_id
  const contestant = getContestantById(contestantRowId);
  if (!contestant) {
    throw new Error(`Contestant ${contestantRowId} not found`);
  }

  // Use transaction to update both tables atomically
  db.transaction(() => {
    // Update contestant status and set revealed_at
    dbRevealContestant(contestantRowId);

    // Update player role from 'audience' to 'player'
    updatePlayer(db, contestant.player_id, { role: "player" });
  })();

  // Return updated contestant with player info
  const contestants = getContestantsRow(contestant.game_segment);
  const updatedContestant = contestants.find((c) => c.id === contestantRowId);

  if (!updatedContestant) {
    throw new Error("Failed to retrieve contestant after reveal");
  }

  return updatedContestant;
}

/**
 * Manually select a specific player for a specific position
 * Used by host to override random selection
 * If position is already occupied, replaces the existing contestant
 * Always creates pending_reveal status for dramatic reveals
 */
export function manualSelectContestant(
  playerId: number,
  segment: "section_1" | "section_2",
  position: number,
): ContestantWithPlayer {
  const db = getDatabase();

  // Validate segment
  if (segment !== "section_1" && segment !== "section_2") {
    throw new Error(`Invalid segment: ${segment}`);
  }

  // Validate player exists and is active
  const player = getPlayerById(db, playerId);
  if (!player) {
    throw new Error(`Player ${playerId} not found`);
  }

  if (!player.active) {
    throw new Error(`Player ${playerId} is not active`);
  }

  // Validate position is in valid range
  if (position < 1 || position > 5) {
    throw new Error(`Position must be between 1 and 5`);
  }

  // Check if position is already occupied
  const existingContestants = getContestantsRow(segment);
  const occupiedPosition = existingContestants.find(
    (c) =>
      c.position === position &&
      (c.status === "active" || c.status === "pending_reveal"),
  );

  // If position is occupied, mark the old contestant as replaced first
  if (occupiedPosition) {
    updateContestantStatus(occupiedPosition.id, "replaced");
  }

  // Always set to pending_reveal for manual selections
  // This ensures the host can reveal every contestant with dramatic timing,
  // regardless of whether they were audience or a player from a previous round
  const status = "pending_reveal";

  // Add to contestants_row
  const contestant = addContestantToRow(playerId, position, segment, status);

  // Return contestant with player info
  const contestants = getContestantsRow(segment);
  const contestantWithPlayer = contestants.find((c) => c.id === contestant.id);

  if (!contestantWithPlayer) {
    throw new Error("Failed to retrieve contestant after manual selection");
  }

  return contestantWithPlayer;
}

/**
 * Replace a specific contestant with a new player
 * If newPlayerId is provided, uses that player; otherwise selects randomly from eligible pool
 * Preserves the position of the old contestant
 */
export function replaceContestant(
  contestantRowId: number,
  newPlayerId?: number,
): ContestantWithPlayer {
  const db = getDatabase();

  // Get old contestant to verify it exists
  const oldContestant = getContestantById(contestantRowId);
  if (!oldContestant) {
    throw new Error(`Contestant ${contestantRowId} not found`);
  }

  let selectedPlayerId: number;
  let newStatus: string;

  if (newPlayerId !== undefined) {
    // Manual selection
    const player = getPlayerById(db, newPlayerId);
    if (!player) {
      throw new Error(`Player ${newPlayerId} not found`);
    }

    if (!player.active) {
      throw new Error(`Player ${newPlayerId} is not active`);
    }

    selectedPlayerId = newPlayerId;
    // Same logic as manualSelectContestant: existing players and hosts are immediately active
    newStatus =
      player.role === "player" || player.role === "host"
        ? "active"
        : "pending_reveal";
  } else {
    // Random selection from eligible audience
    const eligibleResult = searchPlayers(db, {
      role: "audience",
      active: true,
    });

    if (eligibleResult.total === 0) {
      throw new Error("No eligible audience members available");
    }

    const randomIndex = Math.floor(
      Math.random() * eligibleResult.players.length,
    );
    selectedPlayerId = eligibleResult.players[randomIndex].id;
    newStatus = "pending_reveal";
  }

  // Replace contestant
  const result = dbReplaceContestant(
    contestantRowId,
    selectedPlayerId,
    newStatus,
  );

  // Return new contestant with player info
  const contestants = getContestantsRow(oldContestant.game_segment);
  const newContestant = contestants.find((c) => c.id === result.new.id);

  if (!newContestant) {
    throw new Error("Failed to retrieve contestant after replacement");
  }

  return newContestant;
}

/**
 * Refresh the entire contestant's row for a segment
 * Replaces all 5 contestants with new random selections from eligible audience
 * All new contestants start with status='pending_reveal'
 */
export function refreshContestantsRow(
  segment: "section_1" | "section_2",
): ContestantWithPlayer[] {
  const db = getDatabase();

  // Get eligible audience members
  const eligibleResult = searchPlayers(db, {
    role: "audience",
    active: true,
  });

  if (eligibleResult.total < 5) {
    throw new Error(
      `Not enough eligible audience members (need 5, have ${eligibleResult.total})`,
    );
  }

  // Use transaction to ensure atomic replacement
  return db.transaction(() => {
    // Clear existing contestants (marks them as 'replaced')
    clearContestantsRow(segment);

    // Select 5 random players (without replacement)
    const shuffled = [...eligibleResult.players].sort(
      () => Math.random() - 0.5,
    );
    const selectedPlayers = shuffled.slice(0, 5);

    // Add new contestants to positions 1-5
    for (let i = 0; i < 5; i++) {
      addContestantToRow(
        selectedPlayers[i].id,
        i + 1,
        segment,
        "pending_reveal",
      );
    }

    // Return only active contestants (excludes the replaced ones)
    return getActiveContestants(segment);
  })();
}

/**
 * Advance to the next phase
 * Updates game workflow to the specified phase
 */
export function advancePhase(nextPhase: string): GameWorkflow {
  // Basic validation - can be enhanced with state machine logic
  const validPhases = [
    "not_started",
    "contestant_selection",
    "bidding",
    "mini_game",
    "wheel",
    "showcase",
  ];

  if (!validPhases.includes(nextPhase)) {
    throw new Error(`Invalid phase: ${nextPhase}`);
  }

  return updateGameWorkflow({
    phase_type: nextPhase,
  });
}
