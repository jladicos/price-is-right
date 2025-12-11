import { getWinnersForSegment, type BidWithPlayer } from "../db/bids.js";
import { getShowcaseStateWithPlayers } from "../db/showcase.js";

export interface BiddingWinner {
  roundNumber: number;
  playerName: string;
  productId: string;
}

export interface ShowcaseWinner {
  playerName: string;
  bonusWon: boolean;
}

export interface GameWinners {
  section1BiddingWinners: BiddingWinner[];
  section2BiddingWinners: BiddingWinner[];
  showcaseWinner: ShowcaseWinner | null;
}

/**
 * Get all winners from the current game
 * Includes bidding winners from both sections and the showcase winner (if determined)
 */
export function getGameWinners(): GameWinners {
  // Get bidding winners for each section
  const section1Winners = getWinnersForSegment("section_1");
  const section2Winners = getWinnersForSegment("section_2");

  // Transform to simpler format
  const formatBiddingWinners = (winners: BidWithPlayer[]): BiddingWinner[] => {
    return winners.map((w) => ({
      roundNumber: w.round_number,
      playerName: `${w.first_name} ${w.last_name}`,
      productId: w.product_id,
    }));
  };

  // Get showcase winner
  let showcaseWinner: ShowcaseWinner | null = null;
  const showcaseState = getShowcaseStateWithPlayers(1); // Game ID is always 1

  if (showcaseState && showcaseState.finale_winner_id) {
    // Determine which player won
    const winnerId = showcaseState.finale_winner_id;
    let winnerName: string;

    if (winnerId === showcaseState.finale_player1_id) {
      winnerName = `${showcaseState.finale_player1_first_name} ${showcaseState.finale_player1_last_name}`;
    } else {
      winnerName = `${showcaseState.finale_player2_first_name} ${showcaseState.finale_player2_last_name}`;
    }

    showcaseWinner = {
      playerName: winnerName,
      bonusWon: showcaseState.finale_bonus_won === 1,
    };
  }

  return {
    section1BiddingWinners: formatBiddingWinners(section1Winners),
    section2BiddingWinners: formatBiddingWinners(section2Winners),
    showcaseWinner,
  };
}

/**
 * Format game winners as markdown
 */
export function formatWinnersAsMarkdown(winners: GameWinners): string {
  const lines: string[] = [];

  lines.push("# Game Winners");
  lines.push("");

  // Section 1
  lines.push("## Section 1 - Bidding Winners");
  if (winners.section1BiddingWinners.length === 0) {
    lines.push("- No winners yet");
  } else {
    for (const winner of winners.section1BiddingWinners) {
      lines.push(`- Round ${winner.roundNumber}: ${winner.playerName}`);
    }
  }
  lines.push("");

  // Section 2
  lines.push("## Section 2 - Bidding Winners");
  if (winners.section2BiddingWinners.length === 0) {
    lines.push("- No winners yet");
  } else {
    for (const winner of winners.section2BiddingWinners) {
      lines.push(`- Round ${winner.roundNumber}: ${winner.playerName}`);
    }
  }
  lines.push("");

  // Showcase
  lines.push("## Showcase Showdown Winner");
  if (winners.showcaseWinner) {
    const bonusText = winners.showcaseWinner.bonusWon ? " (Bonus: Yes)" : "";
    lines.push(`- ${winners.showcaseWinner.playerName}${bonusText}`);
  } else {
    lines.push("- Not yet determined");
  }
  lines.push("");

  return lines.join("\n");
}
