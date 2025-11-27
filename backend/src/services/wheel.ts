import {
  createWheelSpin as dbCreateWheelSpin,
  getPlayerWheelTotal as dbGetPlayerWheelTotal,
  getPlayerSpinCount as dbGetPlayerSpinCount,
  getPlayerTotalsForSegment as dbGetPlayerTotalsForSegment,
  type WheelSpin,
} from "../db/wheel-spins.js";
import { getWinnersForSegment } from "../db/bids.js";
import { getAllActiveContestants } from "../db/contestants.js";

/**
 * Valid wheel values ($.05 to $1.00 in $.05 increments)
 */
export const WHEEL_VALUES = [
  0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7,
  0.75, 0.8, 0.85, 0.9, 0.95, 1.0,
];

/**
 * Generate a random wheel value
 * Pure random selection: equal 1/20 probability for each value
 */
export function generateRandomWheelValue(): number {
  const randomIndex = Math.floor(Math.random() * WHEEL_VALUES.length);
  return WHEEL_VALUES[randomIndex];
}

/**
 * Record a spin for a player
 * Generates random value, stores in database, returns spin data
 */
export function recordSpin(
  playerId: number,
  gameSegment: string,
  spinNumber: number,
  spinoffNumber: number = 0,
): WheelSpin {
  // Generate random value
  const value = generateRandomWheelValue();

  // Store in database
  const spin = dbCreateWheelSpin(
    playerId,
    gameSegment,
    spinNumber,
    value,
    spinoffNumber,
  );

  return spin;
}

/**
 * Get player's combined spin total for a segment
 * Sums all spins for the player in this segment/spinoff
 */
export function getPlayerTotal(
  playerId: number,
  gameSegment: string,
  spinoffNumber: number = 0,
): number {
  return dbGetPlayerWheelTotal(playerId, gameSegment, spinoffNumber);
}

/**
 * Check if player is eliminated (total > $1.00)
 */
export function isPlayerEliminated(
  playerId: number,
  gameSegment: string,
  spinoffNumber: number = 0,
): boolean {
  const total = getPlayerTotal(playerId, gameSegment, spinoffNumber);
  return total > 1.0;
}

/**
 * Check if player can spin again
 * Players can spin up to 2 times in regular rounds, only 1 time in spinoffs
 */
export function canPlayerSpinAgain(
  playerId: number,
  gameSegment: string,
  spinoffNumber: number = 0,
): boolean {
  const spinCount = dbGetPlayerSpinCount(playerId, gameSegment, spinoffNumber);

  // Spinoff rounds: only 1 spin allowed
  if (spinoffNumber > 0) {
    return spinCount < 1;
  }

  // Regular rounds: up to 2 spins
  return spinCount < 2;
}

/**
 * Get current leader (player with highest total ≤ $1.00)
 * Returns null if no valid players exist
 */
export function getCurrentLeader(
  gameSegment: string,
  spinoffNumber: number = 0,
): {
  player_id: number;
  first_name: string;
  last_name: string;
  photo_filename: string;
  total: number;
} | null {
  const totals = dbGetPlayerTotalsForSegment(gameSegment, spinoffNumber);

  // Filter to only valid totals (≤ $1.00)
  const validPlayers = totals.filter((p) => p.total <= 1.0);

  if (validPlayers.length === 0) {
    return null;
  }

  // Already sorted by total DESC, so first valid player is the leader
  return validPlayers[0];
}

/**
 * Detect if there's a tie at the highest valid total
 * Returns true if multiple players share the highest total ≤ $1.00
 */
export function detectTie(
  gameSegment: string,
  spinoffNumber: number = 0,
): boolean {
  const totals = dbGetPlayerTotalsForSegment(gameSegment, spinoffNumber);

  // Filter to only valid totals (≤ $1.00)
  const validPlayers = totals.filter((p) => p.total <= 1.0);

  if (validPlayers.length < 2) {
    return false;
  }

  // Check if top two have the same total
  return validPlayers[0].total === validPlayers[1].total;
}

/**
 * Get list of players tied for the lead
 * Returns players who share the highest valid total
 */
export function getSpinOffPlayers(
  gameSegment: string,
  spinoffNumber: number = 0,
): Array<{
  player_id: number;
  first_name: string;
  last_name: string;
  photo_filename: string;
  total: number;
}> {
  const totals = dbGetPlayerTotalsForSegment(gameSegment, spinoffNumber);

  // Filter to only valid totals (≤ $1.00)
  const validPlayers = totals.filter((p) => p.total <= 1.0);

  if (validPlayers.length === 0) {
    return [];
  }

  // Get the highest total
  const highestTotal = validPlayers[0].total;

  // Return all players with that total
  return validPlayers.filter((p) => p.total === highestTotal);
}

/**
 * Determine wheel winner
 * Returns winner if there's a clear winner (no tie)
 * Returns null if there's a tie (spinoff needed)
 */
export function determineWheelWinner(
  gameSegment: string,
  spinoffNumber: number = 0,
): {
  player_id: number;
  first_name: string;
  last_name: string;
  photo_filename: string;
  total: number;
} | null {
  // Check for tie
  if (detectTie(gameSegment, spinoffNumber)) {
    return null; // Spinoff needed
  }

  // Return the leader
  return getCurrentLeader(gameSegment, spinoffNumber);
}

/**
 * Get eligible spinners for a wheel segment
 * Returns players who won bidding rounds in the current section
 */
export function getEligibleSpinners(gameSegment: string): Array<{
  player_id: number;
  first_name: string;
  last_name: string;
  photo_filename: string;
  position: number;
}> {
  // Map wheel segments to their corresponding bidding segments
  // Wheel happens after bidding rounds, so section_1_finale uses section_1 bids
  let biddingSegment = gameSegment;
  if (gameSegment === "section_1_finale") {
    biddingSegment = "section_1";
  } else if (gameSegment === "section_2_finale") {
    biddingSegment = "section_2";
  }

  // Get bidding winners for the corresponding bidding segment
  const winners = getWinnersForSegment(biddingSegment);

  // If no winners found, fall back to all active contestants (for testing)
  if (winners.length === 0) {
    const contestants = getAllActiveContestants();
    return contestants.map((c) => ({
      player_id: c.player_id,
      first_name: c.first_name,
      last_name: c.last_name,
      photo_filename: c.photo_filename,
      position: c.position,
    }));
  }

  return winners.map((w) => ({
    player_id: w.player_id,
    first_name: w.first_name,
    last_name: w.last_name,
    photo_filename: w.photo_filename,
    position: w.position || 0, // position might be null if not in contestant's row
  }));
}
