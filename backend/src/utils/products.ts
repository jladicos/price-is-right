import fs from 'fs';
import path from 'path';
import type { ProductConfig, Product } from '../types/product.js';

let cachedConfig: ProductConfig | null = null;

/**
 * Get the path to the products.json file
 */
function getProductsJsonPath(): string {
  // Use process.cwd() to get the project root
  const cwd = process.cwd();

  // Try to load from root directory first
  const rootPath = path.join(cwd, 'products.json');
  if (fs.existsSync(rootPath)) {
    return rootPath;
  }

  // Fall back to example file
  const examplePath = path.join(cwd, 'products.example.json');
  if (fs.existsSync(examplePath)) {
    console.warn('products.json not found, using products.example.json');
    return examplePath;
  }

  throw new Error('No products.json or products.example.json file found');
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

    if (!config.assignments || typeof config.assignments !== 'object') {
      throw new Error("products.json must contain an 'assignments' object");
    }

    // Validate assignments reference existing products
    const productIds = Object.keys(config.products);
    const allAssignedIds = [
      ...config.assignments.bidding_set_1,
      ...config.assignments.bidding_set_2,
      ...config.assignments.showcase_showdown,
    ];

    for (const id of allAssignedIds) {
      if (!productIds.includes(id)) {
        throw new Error(`Assignment references non-existent product: ${id}`);
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
 * Get products for a specific game segment
 */
export function getProductsForSegment(
  segment: 'bidding_set_1' | 'bidding_set_2' | 'showcase_showdown',
): Array<{ id: string; product: Product }> {
  const config = loadProductConfig();
  const ids = config.assignments[segment];

  return ids.map((id) => ({
    id,
    product: config.products[id],
  }));
}

/**
 * Clear the cached configuration (useful for testing)
 */
export function clearProductCache(): void {
  cachedConfig = null;
}
