export interface Product {
  name: string;
  price: number;
  images: string[];
}

/**
 * Game phase types
 */
export type PhaseType = "bidding" | "mini_game" | "wheel" | "showcase" | "audience_bid";

/**
 * Bidding phase configuration
 */
export interface BiddingPhase {
  type: "bidding";
  product_id: string;
}

/**
 * Mini-game phase configuration (future extension)
 */
export interface MiniGamePhase {
  type: "mini_game";
  game_type: string; // e.g., "plinko", "price_tags", etc.
  product_id: string;
}

/**
 * Audience bid phase configuration
 * Displays a product for audience to bid on (outside the game)
 */
export interface AudienceBidPhase {
  type: "audience_bid";
  product_id: string;
  url?: string; // Optional clickable URL for audience bidding
}

/**
 * Wheel spin phase configuration
 */
export interface WheelPhase {
  type: "wheel";
}

/**
 * Finale phase configuration for the showcase showdown
 * Contains two showcases and bonus threshold
 */
export interface FinalePhase {
  showcase_1: string[]; // Array of product IDs for showcase 1
  showcase_2: string[]; // Array of product IDs for showcase 2
  bonus_threshold: number; // Dollar amount within which player wins both showcases
}

/**
 * Showcase phase configuration (legacy - kept for backwards compatibility)
 * Use FinalePhase for the finale showcase showdown
 */
export interface ShowcasePhase {
  type: "showcase";
  products: string[]; // Array of product IDs
}

/**
 * Union type for all game phases
 */
export type GamePhase =
  | BiddingPhase
  | MiniGamePhase
  | AudienceBidPhase
  | WheelPhase
  | ShowcasePhase;

/**
 * Game structure defining the complete game flow
 */
export interface GameStructure {
  section_1: GamePhase[];
  section_1_finale: WheelPhase;
  section_2: GamePhase[];
  section_2_finale: WheelPhase;
  finale: FinalePhase; // Showcase showdown with two showcases
}

/**
 * Product configuration file format
 */
export interface ProductConfig {
  products: Record<string, Product>;
  game_structure: GameStructure;
}
