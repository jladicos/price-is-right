import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadProductConfig,
  getProduct,
  getPhasesForSegment,
  getBiddingPhasesForSegment,
  getShowcaseProducts,
  getProductForPhase,
  getGameStructure,
  clearProductCache,
} from './products';
import type { BiddingPhase, MiniGamePhase } from '../types/product';

describe('Product Utilities', () => {
  beforeEach(() => {
    clearProductCache();
  });

  describe('loadProductConfig', () => {
    it('should load product configuration successfully', () => {
      const config = loadProductConfig();

      // Verify structure exists and has content
      expect(typeof config).toBe('object');
      expect(typeof config.products).toBe('object');
      expect(Object.keys(config.products).length).toBeGreaterThan(0);
      expect(typeof config.game_structure).toBe('object');
    });

    it('should have all required game structure sections', () => {
      const config = loadProductConfig();

      expect(config.game_structure.section_1).toBeInstanceOf(Array);
      expect(config.game_structure.section_1.length).toBeGreaterThan(0);
      expect(config.game_structure.section_2).toBeInstanceOf(Array);
      expect(config.game_structure.section_2.length).toBeGreaterThan(0);

      expect(config.game_structure.section_1_finale).toEqual({ type: 'wheel' });
      expect(config.game_structure.section_2_finale).toEqual({ type: 'wheel' });

      expect(config.game_structure.finale.type).toBe('showcase');
      expect(Array.isArray(config.game_structure.finale.products)).toBe(true);
      expect(config.game_structure.finale.products.length).toBeGreaterThan(0);
    });

    it('should validate all products have required fields', () => {
      const config = loadProductConfig();

      for (const product of Object.values(config.products)) {
        expect(product.name).toBeDefined();
        expect(typeof product.name).toBe('string');
        expect(product.name.length).toBeGreaterThan(0);

        expect(product.price).toBeDefined();
        expect(typeof product.price).toBe('number');
        expect(product.price).toBeGreaterThan(0);

        expect(product.images).toBeDefined();
        expect(Array.isArray(product.images)).toBe(true);
        expect(product.images.length).toBeGreaterThan(0);
      }
    });

    it('should validate all assigned products exist in products object', () => {
      const config = loadProductConfig();
      const productIds = Object.keys(config.products);

      // Extract product IDs from all phases
      const section1Ids = config.game_structure.section_1
        .filter(
          (phase): phase is BiddingPhase | MiniGamePhase =>
            phase.type === 'bidding' || phase.type === 'mini_game',
        )
        .map((phase) => phase.product_id);

      const section2Ids = config.game_structure.section_2
        .filter(
          (phase): phase is BiddingPhase | MiniGamePhase =>
            phase.type === 'bidding' || phase.type === 'mini_game',
        )
        .map((phase) => phase.product_id);

      const showcaseIds = config.game_structure.finale.products;

      const allAssignedIds = [...section1Ids, ...section2Ids, ...showcaseIds];

      for (const assignedId of allAssignedIds) {
        expect(productIds).toContain(assignedId);
      }
    });

    it('should cache the configuration', () => {
      const config1 = loadProductConfig();
      const config2 = loadProductConfig();

      expect(config1).toBe(config2); // Same object reference
    });

    it('should clear cache when requested', () => {
      const config1 = loadProductConfig();
      clearProductCache();
      const config2 = loadProductConfig();

      // Different object references (cache was cleared)
      expect(config1).not.toBe(config2);
      // But same content
      expect(config1).toEqual(config2);
    });
  });

  describe('getProduct', () => {
    it('should return a product by ID', () => {
      const config = loadProductConfig();
      const firstProductId = Object.keys(config.products)[0];
      const product = getProduct(firstProductId);

      // Verify it returns the exact product object from config
      expect(product).toEqual(config.products[firstProductId]);
    });

    it('should return undefined for non-existent product', () => {
      const product = getProduct('nonexistent-id');
      expect(product).toBeUndefined();
    });
  });

  describe('getPhasesForSegment', () => {
    it('should return phases for section_1', () => {
      const config = loadProductConfig();
      const phases = getPhasesForSegment('section_1');

      expect(phases).toBeInstanceOf(Array);
      expect(phases.length).toBe(config.game_structure.section_1.length);
      // Verify all phases have type property
      for (const phase of phases) {
        expect(phase).toHaveProperty('type');
      }
    });

    it('should return phases for section_2', () => {
      const config = loadProductConfig();
      const phases = getPhasesForSegment('section_2');

      expect(phases).toBeInstanceOf(Array);
      expect(phases.length).toBe(config.game_structure.section_2.length);
    });

    it('should preserve phase order', () => {
      const config = loadProductConfig();
      const phases = getPhasesForSegment('section_1');

      expect(phases).toEqual(config.game_structure.section_1);
    });
  });

  describe('getBiddingPhasesForSegment', () => {
    it('should return only bidding phases', () => {
      const phases = getBiddingPhasesForSegment('section_1');

      expect(phases).toBeInstanceOf(Array);
      for (const phase of phases) {
        expect(phase.type).toBe('bidding');
        expect(phase).toHaveProperty('product_id');
      }
    });

    it('should filter out non-bidding phases', () => {
      const allPhases = getPhasesForSegment('section_1');
      const biddingPhases = getBiddingPhasesForSegment('section_1');

      const biddingCount = allPhases.filter((p) => p.type === 'bidding').length;
      expect(biddingPhases.length).toBe(biddingCount);
    });
  });

  describe('getShowcaseProducts', () => {
    it('should return showcase products', () => {
      const products = getShowcaseProducts();

      expect(products).toBeInstanceOf(Array);
      expect(products.length).toBeGreaterThan(0);
      expect(products[0]).toHaveProperty('id');
      expect(products[0]).toHaveProperty('product');
    });

    it('should return products in correct order', () => {
      const config = loadProductConfig();
      const products = getShowcaseProducts();

      expect(products[0].id).toBe(config.game_structure.finale.products[0]);
      // Verify full array order
      expect(products.map((p) => p.id)).toEqual(config.game_structure.finale.products);
    });
  });

  describe('getProductForPhase', () => {
    it('should return product for bidding phase', () => {
      const config = loadProductConfig();
      const firstBiddingPhase = config.game_structure.section_1.find(
        (p) => p.type === 'bidding',
      ) as BiddingPhase;

      expect(firstBiddingPhase).toBeDefined();

      const result = getProductForPhase(firstBiddingPhase);

      expect(result.id).toBe(firstBiddingPhase.product_id);
      expect(result.product).toEqual(config.products[firstBiddingPhase.product_id]);
    });

    it('should return correct product object structure', () => {
      const config = loadProductConfig();
      const firstBiddingPhase = config.game_structure.section_1.find(
        (p) => p.type === 'bidding',
      ) as BiddingPhase;

      const result = getProductForPhase(firstBiddingPhase);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('product');
      expect(result.product).toHaveProperty('name');
      expect(result.product).toHaveProperty('price');
      expect(result.product).toHaveProperty('images');
    });
  });

  describe('getGameStructure', () => {
    it('should return the complete game structure', () => {
      const config = loadProductConfig();
      const structure = getGameStructure();

      expect(structure).toEqual(config.game_structure);
    });

    it('should return structure with all required sections', () => {
      const structure = getGameStructure();

      expect(structure).toHaveProperty('section_1');
      expect(structure).toHaveProperty('section_2');
      expect(structure).toHaveProperty('section_1_finale');
      expect(structure).toHaveProperty('section_2_finale');
      expect(structure).toHaveProperty('finale');
    });
  });
});
