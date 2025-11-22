import { describe, it, expect } from 'vitest';
import { selectWeightedRandom, selectWeightedRandomMultiple } from './weighted-selection';

interface TestItem {
  id: number;
  weight: number;
}

describe('Weighted Selection', () => {
  describe('selectWeightedRandom', () => {
    it('should return null for empty array', () => {
      const result = selectWeightedRandom([]);
      expect(result).toBeNull();
    });

    it('should select single item', () => {
      const items: TestItem[] = [{ id: 1, weight: 1.0 }];
      const result = selectWeightedRandom(items);
      expect(result).toEqual({ id: 1, weight: 1.0 });
    });

    it('should select from primary tier (weight > 0)', () => {
      const items: TestItem[] = [
        { id: 1, weight: 1.0 },
        { id: 2, weight: 0.5 },
        { id: 3, weight: 0 }, // backup tier
      ];

      // Run 100 times to ensure we never select weight=0 when others available
      for (let i = 0; i < 100; i++) {
        const result = selectWeightedRandom(items);
        expect(result).toBeDefined();
        expect(result!.id).not.toBe(3); // Should never select id:3 (weight=0)
        expect([1, 2]).toContain(result!.id);
      }
    });

    it('should fall back to weight=0 items when no primary tier', () => {
      const items: TestItem[] = [
        { id: 1, weight: 0 },
        { id: 2, weight: 0 },
        { id: 3, weight: 0 },
      ];

      const result = selectWeightedRandom(items);
      expect(result).toBeDefined();
      expect([1, 2, 3]).toContain(result!.id);
    });

    it('should handle all items having same weight', () => {
      const items: TestItem[] = [
        { id: 1, weight: 1.0 },
        { id: 2, weight: 1.0 },
        { id: 3, weight: 1.0 },
      ];

      const selectedIds = new Set();
      // Run many times to check distribution
      for (let i = 0; i < 300; i++) {
        const result = selectWeightedRandom(items);
        expect(result).toBeDefined();
        selectedIds.add(result!.id);
      }

      // All items should have been selected at least once
      expect(selectedIds.size).toBe(3);
      expect(selectedIds.has(1)).toBe(true);
      expect(selectedIds.has(2)).toBe(true);
      expect(selectedIds.has(3)).toBe(true);
    });

    it('should respect weight probabilities (higher weight = more likely)', () => {
      const items: TestItem[] = [
        { id: 1, weight: 0.1 }, // 10% of total
        { id: 2, weight: 0.9 }, // 90% of total
      ];

      const counts = { 1: 0, 2: 0 };
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const result = selectWeightedRandom(items);
        expect(result).toBeDefined();
        counts[result!.id as keyof typeof counts]++;
      }

      // id:2 should be selected significantly more often than id:1
      // With 1000 iterations, id:2 should be ~900, id:1 should be ~100
      // Allow some variance: id:2 should be at least 750 (75%)
      expect(counts[2]).toBeGreaterThan(750);
      expect(counts[1]).toBeLessThan(250);
    });

    it('should handle very small weights', () => {
      const items: TestItem[] = [
        { id: 1, weight: 0.01 },
        { id: 2, weight: 0.01 },
        { id: 3, weight: 0.98 },
      ];

      const counts = { 1: 0, 2: 0, 3: 0 };

      for (let i = 0; i < 1000; i++) {
        const result = selectWeightedRandom(items);
        expect(result).toBeDefined();
        counts[result!.id as keyof typeof counts]++;
      }

      // id:3 should dominate
      expect(counts[3]).toBeGreaterThan(900);
    });

    it('should handle missing/null/undefined weights by treating as 1.0', () => {
      const items = [
        { id: 1, weight: 1.0 },
        { id: 2, weight: undefined as any },
        { id: 3, weight: null as any },
      ];

      // Should not throw and should select items
      for (let i = 0; i < 100; i++) {
        const result = selectWeightedRandom(items);
        expect(result).toBeDefined();
        expect([1, 2, 3]).toContain(result!.id);
      }
    });
  });

  describe('selectWeightedRandomMultiple', () => {
    it('should return empty array for empty input', () => {
      const result = selectWeightedRandomMultiple([], 5);
      expect(result).toEqual([]);
    });

    it('should return empty array when count is 0', () => {
      const items: TestItem[] = [{ id: 1, weight: 1.0 }];
      const result = selectWeightedRandomMultiple(items, 0);
      expect(result).toEqual([]);
    });

    it('should select multiple unique items', () => {
      const items: TestItem[] = [
        { id: 1, weight: 1.0 },
        { id: 2, weight: 1.0 },
        { id: 3, weight: 1.0 },
        { id: 4, weight: 1.0 },
        { id: 5, weight: 1.0 },
      ];

      const result = selectWeightedRandomMultiple(items, 5);

      expect(result).toHaveLength(5);

      // All should be unique
      const ids = result.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);

      // All should be from original items
      ids.forEach((id) => {
        expect([1, 2, 3, 4, 5]).toContain(id);
      });
    });

    it('should handle selecting fewer items than available', () => {
      const items: TestItem[] = [
        { id: 1, weight: 1.0 },
        { id: 2, weight: 1.0 },
        { id: 3, weight: 1.0 },
      ];

      const result = selectWeightedRandomMultiple(items, 2);
      expect(result).toHaveLength(2);

      const ids = result.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(2);
    });

    it('should return all items when requesting more than available', () => {
      const items: TestItem[] = [
        { id: 1, weight: 1.0 },
        { id: 2, weight: 1.0 },
      ];

      const result = selectWeightedRandomMultiple(items, 5);
      expect(result).toHaveLength(2); // Can only select 2
    });

    it('should select without replacement (no duplicates)', () => {
      const items: TestItem[] = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        weight: 1.0,
      }));

      const result = selectWeightedRandomMultiple(items, 10);
      expect(result).toHaveLength(10);

      const ids = result.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10); // All unique
    });

    it('should prioritize primary tier over backup tier', () => {
      const items: TestItem[] = [
        { id: 1, weight: 1.0 },
        { id: 2, weight: 0.5 },
        { id: 3, weight: 0 }, // backup
        { id: 4, weight: 0 }, // backup
        { id: 5, weight: 0 }, // backup
      ];

      const result = selectWeightedRandomMultiple(items, 2);
      expect(result).toHaveLength(2);

      // Should select from primary tier first
      const ids = result.map((r) => r.id);
      expect(ids).toContain(1);
      expect(ids).toContain(2);
    });

    it('should use backup tier when primary tier exhausted', () => {
      const items: TestItem[] = [
        { id: 1, weight: 1.0 },
        { id: 2, weight: 0.5 },
        { id: 3, weight: 0 }, // backup
        { id: 4, weight: 0 }, // backup
        { id: 5, weight: 0 }, // backup
      ];

      const result = selectWeightedRandomMultiple(items, 5);
      expect(result).toHaveLength(5);

      // All items should be selected
      const ids = result.map((r) => r.id);
      expect(ids.sort()).toEqual([1, 2, 3, 4, 5]);
    });
  });
});
