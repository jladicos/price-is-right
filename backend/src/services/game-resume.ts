import { getGameWorkflow, type GameWorkflow } from "../db/game-workflow.js";
import {
  getActiveContestants,
  type ContestantWithPlayer,
} from "../db/contestants.js";

export interface ResumedGameState {
  workflow: GameWorkflow;
  section1Contestants: ContestantWithPlayer[];
  section2Contestants: ContestantWithPlayer[];
}

/**
 * Check if there's an in-progress game that needs to be resumed
 * Returns true if game is not in 'not_started' state
 */
export function checkForInProgressGame(): boolean {
  const workflow = getGameWorkflow();
  return workflow.phase_type !== "not_started";
}

/**
 * Resume an in-progress game
 * Loads the current workflow state and all contestants
 * Returns complete game state for clients to sync
 */
export function resumeGame(): ResumedGameState {
  const workflow = getGameWorkflow();

  // Load contestants for both sections
  const section1Contestants = getActiveContestants("section_1");
  const section2Contestants = getActiveContestants("section_2");

  return {
    workflow,
    section1Contestants,
    section2Contestants,
  };
}
