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
  getAllActiveContestants,
  revealContestant as dbRevealContestant,
  replaceContestant as dbReplaceContestant,
  clearContestantsRow,
  findNextEmptyPosition,
  getContestantById,
  updateContestantStatus,
  type ContestantWithPlayer,
} from "../db/contestants.js";
import { searchPlayers, getPlayerById, updatePlayer } from "../db/players.js";
import { getCurrentBids, getCurrentBidderPosition } from "./bidding.js";
import { type BidWithPlayer } from "../db/bids.js";
import {
  selectWeightedRandom,
  selectWeightedRandomMultiple,
} from "../utils/weighted-selection.js";
import {
  recordSpin,
  getPlayerTotal,
  isPlayerEliminated,
  canPlayerSpinAgain,
  getSpinOffPlayers,
  determineWheelWinner as wheelDetermineWinner,
  getEligibleSpinners,
} from "./wheel.js";
import {
  deleteWheelSpinsForSegment,
  getAllWheelSpinsForSegment,
  getPlayerSpinCount,
  type WheelSpin,
} from "../db/wheel-spins.js";

export interface GameState {
  workflow: GameWorkflow;
  contestantsRow: ContestantWithPlayer[];
  eligibleAudienceCount: number;
  // Bidding phase state (populated when phase_type === 'bidding')
  currentBids?: BidWithPlayer[];
  currentBidderPosition?: number | null;
  // Wheel phase state (populated when phase_type === 'wheel')
  wheelSpins?: WheelSpin[];
  currentSpinner?: number | null;
  currentWheelPosition?: number; // Current wheel display position in cents (5-100)
  playerTotals?: Array<{
    player_id: number;
    first_name: string;
    last_name: string;
    photo_filename: string;
    position: number;
    total: number;
    eliminated: boolean;
  }>;
  wheelWinner?: number | null;
  needsSpinoff?: boolean;
  spinoffNumber?: number;
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
 * If in bidding phase, also includes current bids and bidder position
 */
export function getCurrentState(): GameState {
  const workflow = getGameWorkflow();

  // Get contestants for the current segment
  // Special handling for wheel/finale phases where contestants come from different segments
  const allContestants = getAllActiveContestants();
  let contestantSegment = workflow.current_segment;

  // Map finale segments to their source segments
  if (workflow.current_segment === "section_1_finale") {
    contestantSegment = "section_1"; // Wheel uses section_1 contestants
  } else if (workflow.current_segment === "section_2_finale") {
    contestantSegment = "section_2"; // Wheel uses section_2 contestants
  } else if (workflow.current_segment === "finale") {
    contestantSegment = "section_2_finale"; // Showcase uses wheel winners from section_2
  }

  const contestantsRow = allContestants.filter(
    (c) => c.game_segment === contestantSegment,
  );

  // Count eligible audience members
  const db = getDatabase();
  const eligibleResult = searchPlayers(db, {
    role: "audience",
    active: true,
  });

  const state: GameState = {
    workflow,
    contestantsRow,
    eligibleAudienceCount: eligibleResult.total,
  };

  // If in bidding phase, include bidding-specific state
  if (workflow.phase_type === "bidding") {
    const segment = workflow.current_segment;
    const roundNumber = workflow.current_segment_index + 1;

    // Get current bids for this round
    state.currentBids = getCurrentBids(segment, roundNumber);

    // Get current bidder position
    state.currentBidderPosition = getCurrentBidderPosition(segment);
  }

  // If in wheel phase, include wheel-specific state
  if (workflow.phase_type === "wheel") {
    const segment = workflow.current_segment;
    const metadata = workflow.phase_metadata
      ? JSON.parse(workflow.phase_metadata)
      : {};

    // Get all wheel spins for this segment
    state.wheelSpins = getAllWheelSpinsForSegment(segment);

    // Get current spinner from metadata
    state.currentSpinner = metadata.currentSpinner || null;

    // Get spinoff number
    state.spinoffNumber = metadata.spinoffNumber || 0;

    // Calculate player totals
    const eligibleSpinners = getEligibleSpinners(segment);
    state.playerTotals = eligibleSpinners.map((spinner) => ({
      ...spinner, // Include all player details (first_name, last_name, photo_filename, position)
      player_id: spinner.player_id,
      total: getPlayerTotal(spinner.player_id, segment, state.spinoffNumber),
      eliminated: isPlayerEliminated(
        spinner.player_id,
        segment,
        state.spinoffNumber,
      ),
    }));

    // Get winner/tie info from metadata
    state.wheelWinner = metadata.winnerId || null;
    state.needsSpinoff = metadata.needsSpinoff || false;

    // Determine current wheel position for display
    // This is the last spin result, or 100 ($1.00) if no spins yet for current spinner
    if (state.currentSpinner && state.wheelSpins) {
      const currentSpinnerSpins = state.wheelSpins.filter(
        (s) => s.player_id === state.currentSpinner,
      );
      if (currentSpinnerSpins.length > 0) {
        // Use last spin result (in cents: 5-100)
        const lastSpinResult =
          currentSpinnerSpins[currentSpinnerSpins.length - 1].result;
        state.currentWheelPosition = lastSpinResult * 100;
      } else {
        // No spins yet for current spinner - start at $1.00
        state.currentWheelPosition = 100;
      }
    } else {
      // No current spinner - default to $1.00
      state.currentWheelPosition = 100;
    }
  }

  return state;
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

  // Filter out players already in contestant's row (any segment, any status)
  // This ensures no player appears twice in contestant's row
  const allContestants = getAllActiveContestants();
  const alreadySelectedIds = new Set(allContestants.map((c) => c.player_id));
  const availablePlayers = eligibleResult.players.filter(
    (p) => !alreadySelectedIds.has(p.id),
  );

  if (availablePlayers.length === 0) {
    throw new Error(
      "No eligible audience members available (all already selected)",
    );
  }

  // Use weighted random selection
  const selectedPlayer = selectWeightedRandom(availablePlayers);

  if (!selectedPlayer) {
    throw new Error(
      "Failed to select a contestant (weighted selection returned null)",
    );
  }

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

  // Check if this player is already in contestant's row (at any position)
  const allContestants = getAllActiveContestants();
  const alreadyInRow = allContestants.find((c) => c.player_id === playerId);

  // If player is already in the row at a different position, prevent duplicate
  if (alreadyInRow && alreadyInRow.position !== position) {
    throw new Error(
      `Player ${player.firstName} ${player.lastName} is already in contestant's row at position ${alreadyInRow.position}`,
    );
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

  // Get all current contestants to prevent duplicates
  const allContestants = getAllActiveContestants();
  const alreadySelectedIds = new Set(
    allContestants
      .filter((c) => c.id !== contestantRowId)
      .map((c) => c.player_id),
  );

  if (newPlayerId !== undefined) {
    // Manual selection
    const player = getPlayerById(db, newPlayerId);
    if (!player) {
      throw new Error(`Player ${newPlayerId} not found`);
    }

    if (!player.active) {
      throw new Error(`Player ${newPlayerId} is not active`);
    }

    // Check if player is already in contestant's row at a different position
    if (alreadySelectedIds.has(newPlayerId)) {
      throw new Error(
        `Player ${player.firstName} ${player.lastName} is already in contestant's row at another position`,
      );
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

    // Filter out players already in contestant's row
    const availablePlayers = eligibleResult.players.filter(
      (p) => !alreadySelectedIds.has(p.id),
    );

    if (availablePlayers.length === 0) {
      throw new Error(
        "No eligible audience members available (all already selected)",
      );
    }

    // Use weighted random selection
    const selectedPlayer = selectWeightedRandom(availablePlayers);

    if (!selectedPlayer) {
      throw new Error(
        "Failed to select a contestant (weighted selection returned null)",
      );
    }

    selectedPlayerId = selectedPlayer.id;
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
    // Clear existing contestants for this segment (marks them as 'replaced')
    clearContestantsRow(segment);

    // Get ALL contestants still in the row (other segments, winners, etc.)
    // to ensure we don't select anyone who's already there
    const allContestants = getAllActiveContestants();
    const alreadySelectedIds = new Set(allContestants.map((c) => c.player_id));

    // Filter out players already in contestant's row
    const availablePlayers = eligibleResult.players.filter(
      (p) => !alreadySelectedIds.has(p.id),
    );

    if (availablePlayers.length < 5) {
      throw new Error(
        `Not enough available audience members (need 5, have ${availablePlayers.length} after excluding current contestants)`,
      );
    }

    // Select 5 random players using weighted selection (without replacement)
    const selectedPlayers = selectWeightedRandomMultiple(availablePlayers, 5);

    if (selectedPlayers.length < 5) {
      throw new Error(
        `Failed to select 5 contestants (only selected ${selectedPlayers.length})`,
      );
    }

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
 * Start wheel phase for a game segment
 * Validates eligible players exist, sets phase to 'wheel', initializes metadata
 */
export function startWheelPhase(gameSegment: string): GameWorkflow {
  const workflow = getGameWorkflow();

  // Validate game is in progress
  if (workflow.phase_type === "not_started") {
    throw new Error("Cannot start wheel phase - game not started");
  }

  // Get eligible spinners (bidding winners from this segment)
  const eligibleSpinners = getEligibleSpinners(gameSegment);

  if (eligibleSpinners.length === 0) {
    throw new Error(
      `No eligible spinners for segment ${gameSegment} - no bidding winners found`,
    );
  }

  // Clear any previous wheel spins for this segment
  deleteWheelSpinsForSegment(gameSegment);

  // Initialize phase_metadata for wheel
  const wheelMetadata = {
    currentSpinner: eligibleSpinners[0].player_id,
    spinnerIndex: 0,
    totalSpinners: eligibleSpinners.length,
    spinoffNumber: 0,
    needsSpinoff: false,
    winnerId: null,
  };

  // Update workflow
  return updateGameWorkflow({
    phase_type: "wheel",
    phase_metadata: JSON.stringify(wheelMetadata),
  });
}

/**
 * Process a wheel spin for a player
 * Validates player eligibility, generates spin, updates metadata
 */
export function processWheelSpin(
  playerId: number,
  gameSegment: string,
): {
  spin: WheelSpin;
  total: number;
  eliminated: boolean;
  canSpinAgain: boolean;
} {
  const workflow = getGameWorkflow();

  // Validate phase
  if (workflow.phase_type !== "wheel") {
    throw new Error(`Cannot spin - current phase is ${workflow.phase_type}`);
  }

  // Parse metadata
  const metadata = workflow.phase_metadata
    ? JSON.parse(workflow.phase_metadata)
    : {};
  const spinoffNumber = metadata.spinoffNumber || 0;

  // Validate player is eligible spinner
  const eligibleSpinners = getEligibleSpinners(gameSegment);
  const isEligible = eligibleSpinners.some((s) => s.player_id === playerId);

  if (!isEligible) {
    throw new Error(
      `Player ${playerId} is not eligible to spin in ${gameSegment}`,
    );
  }

  // Check if player is already eliminated
  if (isPlayerEliminated(playerId, gameSegment, spinoffNumber)) {
    throw new Error(`Player ${playerId} is eliminated and cannot spin`);
  }

  // Check spin limit
  if (!canPlayerSpinAgain(playerId, gameSegment, spinoffNumber)) {
    throw new Error(
      `Player ${playerId} has reached maximum spins for this round`,
    );
  }

  // Calculate the correct spin number (1-based: first spin = 1, second spin = 2)
  const currentSpinCount = getPlayerSpinCount(
    playerId,
    gameSegment,
    spinoffNumber,
  );
  const spinNumber = currentSpinCount + 1;

  // Record the spin
  const spin = recordSpin(playerId, gameSegment, spinNumber, spinoffNumber);

  // Get updated total and status
  const total = getPlayerTotal(playerId, gameSegment, spinoffNumber);
  const eliminated = isPlayerEliminated(playerId, gameSegment, spinoffNumber);
  const canSpinAgainResult = canPlayerSpinAgain(
    playerId,
    gameSegment,
    spinoffNumber,
  );

  // Update metadata with spin result
  metadata.lastSpin = {
    playerId,
    value: spin.result,
    total,
    eliminated,
  };

  updateGameWorkflow({
    phase_metadata: JSON.stringify(metadata),
  });

  return {
    spin,
    total,
    eliminated,
    canSpinAgain: canSpinAgainResult,
  };
}

/**
 * Complete a player's wheel turn
 * Marks turn complete, checks if all players finished, determines winner/tie
 */
export function completePlayerWheelTurn(
  playerId: number,
  gameSegment: string,
): {
  allPlayersFinished: boolean;
  needsSpinoff: boolean;
  winnerId: number | null;
  tiedPlayerIds: number[];
} {
  const workflow = getGameWorkflow();

  if (workflow.phase_type !== "wheel") {
    throw new Error(
      `Cannot complete turn - current phase is ${workflow.phase_type}`,
    );
  }

  const metadata = workflow.phase_metadata
    ? JSON.parse(workflow.phase_metadata)
    : {};
  const spinoffNumber = metadata.spinoffNumber || 0;

  // Validate that player has at least one spin
  const spinCount = getPlayerSpinCount(playerId, gameSegment, spinoffNumber);
  if (spinCount === 0) {
    throw new Error("Cannot complete turn - player has no spins recorded");
  }

  // Get all eligible spinners
  const eligibleSpinners = getEligibleSpinners(gameSegment);

  // Check if all players have completed their spins
  // In regular round: check if all have spun at least once and either stayed or hit 2 spins
  // In spinoff: check if all have spun once
  const allSpinsComplete = eligibleSpinners.every((spinner) => {
    const eliminated = isPlayerEliminated(
      spinner.player_id,
      gameSegment,
      spinoffNumber,
    );
    const canSpin = canPlayerSpinAgain(
      spinner.player_id,
      gameSegment,
      spinoffNumber,
    );

    // Player is done if eliminated or cannot spin again
    return eliminated || !canSpin;
  });

  if (!allSpinsComplete) {
    // Update current spinner to next player who can still spin
    const currentIndex = eligibleSpinners.findIndex(
      (s) => s.player_id === playerId,
    );

    // Find the next player who is not eliminated and can still spin
    let nextIndex = (currentIndex + 1) % eligibleSpinners.length;
    let attempts = 0;
    while (attempts < eligibleSpinners.length) {
      const nextSpinner = eligibleSpinners[nextIndex];
      const eliminated = isPlayerEliminated(
        nextSpinner.player_id,
        gameSegment,
        spinoffNumber,
      );
      const canSpin = canPlayerSpinAgain(
        nextSpinner.player_id,
        gameSegment,
        spinoffNumber,
      );

      // If this player can spin, use them
      if (!eliminated && canSpin) {
        break;
      }

      // Otherwise, move to next player
      nextIndex = (nextIndex + 1) % eligibleSpinners.length;
      attempts++;
    }

    metadata.currentSpinner = eligibleSpinners[nextIndex].player_id;
    metadata.spinnerIndex = nextIndex;

    updateGameWorkflow({
      phase_metadata: JSON.stringify(metadata),
    });

    return {
      allPlayersFinished: false,
      needsSpinoff: false,
      winnerId: null,
      tiedPlayerIds: [],
    };
  }

  // All players finished - determine winner or tie
  const winner = wheelDetermineWinner(gameSegment, spinoffNumber);

  if (winner) {
    // Clear winner - update metadata
    metadata.winnerId = winner.player_id;
    metadata.needsSpinoff = false;
    // Clear current spinner since all players are done
    metadata.currentSpinner = null;
    metadata.spinnerIndex = null;

    updateGameWorkflow({
      phase_metadata: JSON.stringify(metadata),
    });

    return {
      allPlayersFinished: true,
      needsSpinoff: false,
      winnerId: winner.player_id,
      tiedPlayerIds: [],
    };
  }

  // Tie detected - need spinoff
  const tiedPlayers = getSpinOffPlayers(gameSegment, spinoffNumber);
  const tiedPlayerIds = tiedPlayers.map((p) => p.player_id);

  metadata.needsSpinoff = true;
  metadata.tiedPlayerIds = tiedPlayerIds;
  // Clear current spinner since we need to start a spinoff
  metadata.currentSpinner = null;
  metadata.spinnerIndex = null;

  updateGameWorkflow({
    phase_metadata: JSON.stringify(metadata),
  });

  return {
    allPlayersFinished: true,
    needsSpinoff: true,
    winnerId: null,
    tiedPlayerIds,
  };
}

/**
 * Start a spinoff round
 * Validates tie exists, initializes spinoff metadata
 */
export function startWheelSpinOff(
  gameSegment: string,
  spinoffNumber: number,
): GameWorkflow {
  const workflow = getGameWorkflow();

  if (workflow.phase_type !== "wheel") {
    throw new Error(
      `Cannot start spinoff - current phase is ${workflow.phase_type}`,
    );
  }

  // Get tied players from previous round
  const previousSpinoffNumber = spinoffNumber - 1;
  const tiedPlayers = getSpinOffPlayers(gameSegment, previousSpinoffNumber);

  if (tiedPlayers.length < 2) {
    throw new Error(
      `Cannot start spinoff - no tie detected (${tiedPlayers.length} players tied)`,
    );
  }

  // Initialize spinoff metadata
  const metadata = workflow.phase_metadata
    ? JSON.parse(workflow.phase_metadata)
    : {};

  metadata.spinoffNumber = spinoffNumber;
  metadata.currentSpinner = tiedPlayers[0].player_id;
  metadata.spinnerIndex = 0;
  metadata.totalSpinners = tiedPlayers.length;
  metadata.tiedPlayerIds = tiedPlayers.map((p) => p.player_id);
  metadata.needsSpinoff = false;
  metadata.winnerId = null;

  return updateGameWorkflow({
    phase_metadata: JSON.stringify(metadata),
  });
}

/**
 * Determine wheel winner for a segment
 * Returns winner info or null if tie exists
 */
export function determineWheelWinner(gameSegment: string): {
  winnerId: number | null;
  isTie: boolean;
  tiedPlayerIds: number[];
} {
  const workflow = getGameWorkflow();
  const metadata = workflow.phase_metadata
    ? JSON.parse(workflow.phase_metadata)
    : {};
  const spinoffNumber = metadata.spinoffNumber || 0;

  const winner = wheelDetermineWinner(gameSegment, spinoffNumber);

  if (winner) {
    return {
      winnerId: winner.player_id,
      isTie: false,
      tiedPlayerIds: [],
    };
  }

  // No winner - check for tie
  const tiedPlayers = getSpinOffPlayers(gameSegment, spinoffNumber);

  return {
    winnerId: null,
    isTie: tiedPlayers.length >= 2,
    tiedPlayerIds: tiedPlayers.map((p) => p.player_id),
  };
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
