import { describe, it, expect } from 'vitest';
import {
  sanitizeFilename,
  generatePlayerPhotoFilename,
  getFileExtension,
  isValidImageType,
} from './filename.js';

describe('Filename Utilities', () => {
  describe('sanitizeFilename', () => {
    it('should convert to lowercase', () => {
      expect(sanitizeFilename('JOHN SMITH')).toBe('john-smith');
    });

    it('should replace spaces with hyphens', () => {
      expect(sanitizeFilename('John Smith')).toBe('john-smith');
      expect(sanitizeFilename('Mary Jane Watson')).toBe('mary-jane-watson');
    });

    it('should remove special characters', () => {
      expect(sanitizeFilename("John O'Brien")).toBe('john-obrien');
      expect(sanitizeFilename('José García')).toBe('jos-garca');
      expect(sanitizeFilename('John (Test) Smith')).toBe('john-test-smith');
    });

    it('should collapse multiple spaces to single hyphen', () => {
      expect(sanitizeFilename('John    Smith')).toBe('john-smith');
    });

    it('should remove leading and trailing spaces', () => {
      expect(sanitizeFilename('  John Smith  ')).toBe('john-smith');
    });

    it('should handle names with numbers', () => {
      expect(sanitizeFilename('Player 123')).toBe('player-123');
    });

    it('should collapse multiple hyphens', () => {
      expect(sanitizeFilename('John--Smith')).toBe('john-smith');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(sanitizeFilename('-John Smith-')).toBe('john-smith');
    });

    it('should handle empty string', () => {
      expect(sanitizeFilename('')).toBe('');
    });

    it('should handle only special characters', () => {
      expect(sanitizeFilename('!@#$%')).toBe('');
    });
  });

  describe('generatePlayerPhotoFilename', () => {
    it('should generate filename from first and last name', () => {
      const filename = generatePlayerPhotoFilename('John', 'Smith', '.jpg');
      expect(filename).toBe('john-smith.jpg');
    });

    it('should handle extension without dot', () => {
      const filename = generatePlayerPhotoFilename('John', 'Smith', 'jpg');
      expect(filename).toBe('john-smith.jpg');
    });

    it('should handle different extensions', () => {
      expect(generatePlayerPhotoFilename('John', 'Smith', '.png')).toBe('john-smith.png');
      expect(generatePlayerPhotoFilename('John', 'Smith', 'gif')).toBe('john-smith.gif');
    });

    it('should sanitize names with special characters', () => {
      const filename = generatePlayerPhotoFilename('José', "O'Brien", '.jpg');
      expect(filename).toBe('jos-obrien.jpg');
    });

    it('should handle multi-word names', () => {
      const filename = generatePlayerPhotoFilename('Mary Jane', 'Watson Parker', '.jpg');
      expect(filename).toBe('mary-jane-watson-parker.jpg');
    });
  });

  describe('getFileExtension', () => {
    it('should extract extension from filename', () => {
      expect(getFileExtension('photo.jpg')).toBe('jpg');
      expect(getFileExtension('photo.png')).toBe('png');
      expect(getFileExtension('photo.gif')).toBe('gif');
    });

    it('should handle uppercase extensions', () => {
      expect(getFileExtension('photo.JPG')).toBe('jpg');
    });

    it('should handle multiple dots in filename', () => {
      expect(getFileExtension('my.photo.jpg')).toBe('jpg');
    });

    it('should fallback to mimetype if no extension in filename', () => {
      expect(getFileExtension('photo', 'image/jpeg')).toBe('jpg');
      expect(getFileExtension('photo', 'image/png')).toBe('png');
      expect(getFileExtension('photo', 'image/gif')).toBe('gif');
    });

    it('should handle jpg vs jpeg mimetype', () => {
      expect(getFileExtension('photo', 'image/jpeg')).toBe('jpg');
      expect(getFileExtension('photo', 'image/jpg')).toBe('jpg');
    });

    it('should default to jpg if no extension or mimetype', () => {
      expect(getFileExtension('photo')).toBe('jpg');
    });

    it('should default to jpg for unknown mimetype', () => {
      expect(getFileExtension('photo', 'application/pdf')).toBe('jpg');
    });
  });

  describe('isValidImageType', () => {
    it('should accept valid image types', () => {
      expect(isValidImageType('image/jpeg')).toBe(true);
      expect(isValidImageType('image/jpg')).toBe(true);
      expect(isValidImageType('image/png')).toBe(true);
      expect(isValidImageType('image/gif')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isValidImageType('IMAGE/JPEG')).toBe(true);
      expect(isValidImageType('Image/Png')).toBe(true);
    });

    it('should reject invalid types', () => {
      expect(isValidImageType('application/pdf')).toBe(false);
      expect(isValidImageType('text/plain')).toBe(false);
      expect(isValidImageType('image/svg+xml')).toBe(false);
      expect(isValidImageType('video/mp4')).toBe(false);
    });
  });
});
