import fs from 'fs';
import path from 'path';
import type {
  ProductConfig,
  Product,
  GamePhase,
  BiddingPhase,
  MiniGamePhase,
} from '../types/product.js';

let cachedConfig: ProductConfig | null = null;

/**
 * Get the path to the products.json file
 */
function getProductsJsonPath(): string {
  const cwd = process.cwd();

  // Check if we're in the backend directory and need to go up one level
  const possiblePaths = [
    // Current directory (when running from project root in Docker)
    path.join(cwd, 'data', 'products.json'),
    // Parent directory (when running from backend directory locally)
    path.join(cwd, '..', 'data', 'products.json'),
  ];

  for (const dataPath of possiblePaths) {
    if (fs.existsSync(dataPath)) {
      return dataPath;
    }
  }

  // Try example files
  const examplePaths = [
    path.join(cwd, 'data', 'products.example.json'),
    path.join(cwd, '..', 'data', 'products.example.json'),
  ];

  for (const examplePath of examplePaths) {
    if (fs.existsSync(examplePath)) {
      console.warn('products.json not found, using products.example.json');
      return examplePath;
    }
  }

  throw new Error(
    'No data/products.json or data/products.example.json file found in current or parent directory',
  );
}

/**
 * Extract all product IDs from game phases
 */
function extractProductIdsFromPhases(phases: GamePhase[]): string[] {
  const ids: string[] = [];
  for (const phase of phases) {
    if (phase.type === 'bidding' || phase.type === 'mini_game') {
      ids.push(phase.product_id);
    } else if (phase.type === 'showcase') {
      ids.push(...phase.products);
    }
  }
  return ids;
}

/**
 * Load and validate the products configuration
 */
export function loadProductConfig(): ProductConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const jsonPath = getProductsJsonPath();
  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');

  try {
    const config = JSON.parse(jsonContent) as ProductConfig;

    // Validate structure
    if (!config.products || typeof config.products !== 'object') {
      throw new Error("products.json must contain a 'products' object");
    }

    if (!config.game_structure || typeof config.game_structure !== 'object') {
      throw new Error("products.json must contain a 'game_structure' object");
    }

    // Validate game_structure has required sections
    if (!Array.isArray(config.game_structure.section_1)) {
      throw new Error("game_structure must contain 'section_1' array");
    }
    if (!Array.isArray(config.game_structure.section_2)) {
      throw new Error("game_structure must contain 'section_2' array");
    }
    if (!config.game_structure.section_1_finale) {
      throw new Error("game_structure must contain 'section_1_finale'");
    }
    if (!config.game_structure.section_2_finale) {
      throw new Error("game_structure must contain 'section_2_finale'");
    }
    if (!config.game_structure.finale) {
      throw new Error("game_structure must contain 'finale'");
    }

    // Extract all product IDs from game structure
    const productIds = Object.keys(config.products);
    const allAssignedIds = [
      ...extractProductIdsFromPhases(config.game_structure.section_1),
      ...extractProductIdsFromPhases(config.game_structure.section_2),
      ...config.game_structure.finale.products,
    ];

    // Validate all assigned products exist
    for (const id of allAssignedIds) {
      if (!productIds.includes(id)) {
        throw new Error(`Game structure references non-existent product: ${id}`);
      }
    }

    // Validate product structure
    for (const [id, product] of Object.entries(config.products)) {
      if (!product.name || typeof product.name !== 'string') {
        throw new Error(`Product ${id} missing valid 'name'`);
      }
      if (typeof product.price !== 'number' || product.price <= 0) {
        throw new Error(`Product ${id} missing valid 'price'`);
      }
      if (!Array.isArray(product.images) || product.images.length === 0) {
        throw new Error(`Product ${id} must have at least one image`);
      }
    }

    cachedConfig = config;
    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in products file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get a product by ID
 */
export function getProduct(id: string): Product | undefined {
  const config = loadProductConfig();
  return config.products[id];
}

/**
 * Get game phases for a specific segment
 */
export function getPhasesForSegment(segment: 'section_1' | 'section_2'): GamePhase[] {
  const config = loadProductConfig();
  return config.game_structure[segment];
}

/**
 * Get all bidding phases for a segment
 */
export function getBiddingPhasesForSegment(segment: 'section_1' | 'section_2'): BiddingPhase[] {
  const phases = getPhasesForSegment(segment);
  return phases.filter((phase): phase is BiddingPhase => phase.type === 'bidding');
}

/**
 * Get showcase products
 */
export function getShowcaseProducts(): Array<{ id: string; product: Product }> {
  const config = loadProductConfig();
  const productIds = config.game_structure.finale.products;

  return productIds.map((id) => ({
    id,
    product: config.products[id],
  }));
}

/**
 * Get product for a specific phase
 */
export function getProductForPhase(phase: BiddingPhase | MiniGamePhase): {
  id: string;
  product: Product;
} {
  const config = loadProductConfig();
  return {
    id: phase.product_id,
    product: config.products[phase.product_id],
  };
}

/**
 * Get the complete game structure
 */
export function getGameStructure() {
  const config = loadProductConfig();
  return config.game_structure;
}

/**
 * Clear the cached configuration (useful for testing)
 */
export function clearProductCache(): void {
  cachedConfig = null;
}
