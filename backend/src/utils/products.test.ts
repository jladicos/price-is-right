import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadProductConfig,
  getProduct,
  getProductsForSegment,
  clearProductCache,
} from './products';

describe('Product Utilities', () => {
  beforeEach(() => {
    clearProductCache();
  });

  describe('loadProductConfig', () => {
    it('should load product configuration successfully', () => {
      const config = loadProductConfig();

      expect(config).toBeDefined();
      expect(config.products).toBeDefined();
      expect(config.assignments).toBeDefined();
    });

    it('should have all required assignment sections', () => {
      const config = loadProductConfig();

      expect(config.assignments.bidding_set_1).toBeInstanceOf(Array);
      expect(config.assignments.bidding_set_2).toBeInstanceOf(Array);
      expect(config.assignments.showcase_showdown).toBeInstanceOf(Array);
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

      const allAssignedIds = [
        ...config.assignments.bidding_set_1,
        ...config.assignments.bidding_set_2,
        ...config.assignments.showcase_showdown,
      ];

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

      expect(product).toBeDefined();
      expect(product?.name).toBeDefined();
      expect(product?.price).toBeGreaterThan(0);
      expect(product?.images).toBeInstanceOf(Array);
    });

    it('should return undefined for non-existent product', () => {
      const product = getProduct('nonexistent-id');
      expect(product).toBeUndefined();
    });
  });

  describe('getProductsForSegment', () => {
    it('should return products for bidding_set_1', () => {
      const products = getProductsForSegment('bidding_set_1');

      expect(products).toBeInstanceOf(Array);
      expect(products.length).toBeGreaterThan(0);
      expect(products[0]).toHaveProperty('id');
      expect(products[0]).toHaveProperty('product');
    });

    it('should return products for bidding_set_2', () => {
      const products = getProductsForSegment('bidding_set_2');

      expect(products).toBeInstanceOf(Array);
      expect(products.length).toBeGreaterThan(0);
    });

    it('should return products for showcase_showdown', () => {
      const products = getProductsForSegment('showcase_showdown');

      expect(products).toBeInstanceOf(Array);
      expect(products.length).toBeGreaterThan(0);
    });

    it('should return products in correct order', () => {
      const config = loadProductConfig();
      const products = getProductsForSegment('bidding_set_1');

      // First product ID should match first in assignment
      expect(products[0].id).toBe(config.assignments.bidding_set_1[0]);
    });
  });
});
