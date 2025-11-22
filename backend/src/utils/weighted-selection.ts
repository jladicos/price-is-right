/**
 * Weighted Random Selection Utility
 *
 * Implements two-tier weighted selection:
 * 1. First tries to select from players with weight > 0
 * 2. Falls back to weight = 0 players only if not enough eligible players
 *
 * Algorithm uses cumulative probability:
 * - Total weight = sum of all weights
 * - Each player's probability = their_weight / total_weight
 */

export interface WeightedItem {
  weight: number;
}

/**
 * Select a single random item using weighted probability
 * @param items Array of items with weight property
 * @returns Selected item or null if no valid items
 */
export function selectWeightedRandom<T extends WeightedItem>(items: T[]): T | null {
  if (items.length === 0) {
    return null;
  }

  // Normalize weights: treat undefined/null/NaN as 1.0 (default)
  const normalizedItems = items.map((item) => ({
    ...item,
    weight: item.weight != null && !isNaN(item.weight) ? item.weight : 1.0,
  }));

  // Separate into two tiers
  const primaryTier = normalizedItems.filter((item) => item.weight > 0);
  const backupTier = normalizedItems.filter((item) => item.weight === 0);

  // Try primary tier first
  if (primaryTier.length > 0) {
    return selectFromTier(primaryTier);
  }

  // Fallback to backup tier
  if (backupTier.length > 0) {
    // For weight=0 items, use equal probability
    const randomIndex = Math.floor(Math.random() * backupTier.length);
    return backupTier[randomIndex];
  }

  return null;
}

/**
 * Select multiple unique items using weighted probability
 * @param items Array of items with weight property
 * @param count Number of items to select
 * @returns Array of selected items (may be less than count if not enough items)
 */
export function selectWeightedRandomMultiple<T extends WeightedItem>(
  items: T[],
  count: number,
): T[] {
  if (items.length === 0 || count <= 0) {
    return [];
  }

  // Normalize weights once and keep track of original indices
  const indexedItems = items.map((item, index) => ({
    original: item,
    index,
    weight: item.weight != null && !isNaN(item.weight) ? item.weight : 1.0,
  }));

  const selected: T[] = [];
  const remaining = [...indexedItems];

  while (selected.length < count && remaining.length > 0) {
    // Separate into two tiers
    const primaryTier = remaining.filter((item) => item.weight > 0);
    const backupTier = remaining.filter((item) => item.weight === 0);

    let selectedItem: (typeof indexedItems)[0] | null = null;

    // Try primary tier first
    if (primaryTier.length > 0) {
      selectedItem = selectFromIndexedTier(primaryTier);
    } else if (backupTier.length > 0) {
      // Fallback to backup tier
      const randomIndex = Math.floor(Math.random() * backupTier.length);
      selectedItem = backupTier[randomIndex];
    }

    if (!selectedItem) {
      break;
    }

    selected.push(selectedItem.original);

    // Remove from remaining
    const index = remaining.findIndex((item) => item.index === selectedItem!.index);
    if (index !== -1) {
      remaining.splice(index, 1);
    }
  }

  return selected;
}

/**
 * Internal: Select from indexed items
 */
function selectFromIndexedTier<T>(
  items: Array<{ original: T; index: number; weight: number }>,
): (typeof items)[0] {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const random = Math.random() * totalWeight;

  let cumulativeWeight = 0;
  for (const item of items) {
    cumulativeWeight += item.weight;
    if (random < cumulativeWeight) {
      return item;
    }
  }

  return items[items.length - 1];
}

/**
 * Internal: Select one item from a tier using cumulative probability
 */
function selectFromTier<T extends WeightedItem>(items: T[]): T {
  // Calculate total weight
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

  // Generate random number in [0, totalWeight)
  const random = Math.random() * totalWeight;

  // Find the item corresponding to this random value
  let cumulativeWeight = 0;
  for (const item of items) {
    cumulativeWeight += item.weight;
    if (random < cumulativeWeight) {
      return item;
    }
  }

  // Fallback to last item (shouldn't happen due to floating point, but just in case)
  return items[items.length - 1];
}
